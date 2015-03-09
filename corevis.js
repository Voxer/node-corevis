#!/usr/bin/env node
/**
 * generate an html file based on infromation
 * gathered from mdb(1) arond a node.js core file
 *
 * Author: Dave Eddy <dave@daveeddy.com>
 * Date: December 15, 2014
 * License: MIT
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var os = require('os');
var util = require('util');

var ejs = require('ejs');
var getopt = require('posix-getopt');

var package = require('./package.json');
var MDB = require('./lib/mdb');

var usage = [
  'Usage: corevis [options] <node coredump>',
  '',
  'Generate HTML based on information gathered with mdb(1) from',
  'a node.js core dump',
  '',
  'Examples',
  '    $ corevis core.node.1234 > vis.html',
  '    $ corevis --load /var/tmp/v8-new.so core.node.1234 > vis.html',
  '',
  'Options',
  '  -h, --help       print this message and exit',
  '  -l, --load <v8>  argument to pass to `::load` in mdb(1), defaults to "v8"',
  '  -u, --updates    check npm for available updates to this program',
  '  -v, --version    print the version number and exit',
].join('\n');

// command line arguments
var options = [
  'h(help)',
  'l:(load)',
  'u(updates)',
  'v(version)',
].join('');
var parser = new getopt.BasicParser(options, process.argv);

var option;
var opts = {
  load: 'v8',
};
while ((option = parser.getopt()) !== undefined) {
  switch (option.option) {
    case 'h': console.log(usage); process.exit(0);
    case 'l': opts.load = option.optarg; break;
    case 'u': // check for updates
      require('latest').checkupdate(package, function(ret, msg) {
        console.log(msg);
        process.exit(ret);
      });
      return;
    case 'v': console.log(package.version); process.exit(0);
    default: console.error(usage); process.exit(1); break;
  }
}
var args = process.argv.slice(parser.optind());
var core = args[0];

if (!core) {
  console.error('core file must be passed as the first argument');
  process.exit(1);
}

// this function should be used for all logging. it'll write to stderr
// (to not interfere with the pipeline) and time each call
var _logt;
function log() {
  var now = Date.now();
  if (_logt) {
    var delta = now - _logt;
    process.stderr.write(util.format('%dms\n', delta));
  }
  _logt = now;

  var s = util.format('> %s... ', util.format.apply(util, arguments));
  process.stderr.write(s);
}

var started = Date.now();

log('loading %s', core);
var mdb = new MDB(core);

// start the info gathering process
getstatus();

var status;
function getstatus() {
  log('getting status');
  mdb.run('::status', function(err, stdout, stderr) {
    assert.ifError(err);
    if (stderr)
      console.error(stderr);
    status = stdout.trim();
    loadv8();
  });
}

var v8so;
function loadv8() {
  log('loading v8');
  mdb.run(util.format('::load %s', opts.load), function(err, stdout, stderr) {
    assert.ifError(err);
    if (stderr)
      console.error(stderr);
    v8so = stdout.trim();
    getjsstack();
  });
}

var jsstack = '';
var jsstackv = '';
function getjsstack() {
  log('getting stack trace');
  mdb.run('::jsstack -v', function(err, stdout, stderr, all) {
    assert.ifError(err);

    jsstackv = cleanjsstack(all.trim());
    mdb.run('::jsstack', function(err, stdout, stderr, all) {
      assert.ifError(err);

      jsstack = cleanjsstack(all.trim());
      findjsobjects();
    });
  });
}

// mdb(1) will only output a mox of 80 columns per line if !isatty(stdout) -
// because of this we have to go through the stack ourself with this janky
// regex algorithm to rebuild the stack
function cleanjsstack(jsstack) {
  var lines = jsstack.split('\n');
  jsstack = [];
  var lastline;
  lines.forEach(function(line) {
    // line nmubers, positions, etc.
    if (line.match(/^    [^ ]/)) {
      if (lastline)
        jsstack.push(lastline);
      jsstack.push(line);
      lastline = null;
      return;
    }

    // start of new function
    if (line.match(/^ *[0-9a-f]+ /)) {
      if (lastline)
        jsstack.push(lastline);
      lastline = line;
      return;
    }

    // continuation due to 80 column limit
    lastline += line;
  });
  return jsstack.join('\n');
}

var debug = {};
var objects = [];
var objectmap = {};
function findjsobjects() {
  log('finding jsobjects (this can take a while)');
  mdb.run('::findjsobjects -v', function(err, stdout, stderr) {
    assert.ifError(err);
    assert.equal(stderr, '');

    // parse the output from ::findjsobjects -v and the objects into
    // the `objects` array.  also, use the `objectmap` object to store
    // a map from hex address to the object
    var lines = stdout.trim().split('\n');
    lines.forEach(function(line) {
      var match;
      if ((match = line.match(/^findjsobjects:\s+([^=]+) => (\d*)$/))) {
        // debug findjsobjects output
        debug[match[1]] = +match[2];
      } else if ((match = line.match(/^ *([0-9a-f]+)\s+(\d+)\s+(\d+)\s+([^:]+):? ?(.*)$/))) {
        // actual objects
        var addr = match[1];
        objectmap[addr] = objects.push({
          addr: addr,
          objects: +match[2],
          props: +match[3],
          constructor: match[4],
          args: match[5]
        }) - 1;
      }
    });

    log('calling ::jsprint -a on all objects found');

    var i = 0;
    var addrs = Object.keys(objectmap);
    // call <addr>::jsprint -a for each addr that was found one-at-a-time
    function jsprint() {
      mdb.run(addrs[i] + '::jsprint -a', function(err, stdout, stderr, all) {
        assert.ifError(err);
        // we ignore stderr as some objects may be corrupted

        objects[objectmap[addrs[i]]].jsprint = all.trim();

        if (++i === addrs.length) {
          i = 0;

          // XXX don't findjsobjects every object now because we don't use the info
          analyze();
          return;

          log('calling ::findjsobjects on all objects found');
          findjs();
          return;
        }

        jsprint();
      });
    }
    jsprint();

    // call <addr>::findjsobjects for each addr that was found one-at-a-time
    function findjs() {
      mdb.run(addrs[i] + '::findjsobjects', function(err, stdout, stderr) {
        assert.ifError(err);

        var addresses = stdout.trim().split('\n');
        addresses.forEach(function(addr) {
          objectmap[addr] = i;
        });

        if (++i === addrs.length)
          analyze();
        else
          findjs();
      });
    }
  });
}

function analyze() {
  log('analyzing data');

  // do the equivalent of `<addr>::findjsobjects -r` for each object
  // to determine which objects reference which
  objects.forEach(function(object) {
    var addr = object.addr;
    var re = new RegExp(' ' + addr + ': ');
    object.referencedby = [];
    objects.forEach(function(o) {
      if (addr === o.addr)
        return;
      if (o.jsprint.match(re))
        object.referencedby.push(o.addr);
    });
  });

  // the data used when rendering the EJS template
  var data = {
    core: core,
    status: status,
    package: package,
    v8so: v8so,
    objects: objects,
    objectmap: objectmap,
    _debug: debug,
    jsstack: jsstack,
    jsstackv: jsstackv,
    opts: opts,
    hostname: os.hostname(),
    assets: {}
  };

  log('loading assets');
  var index = fs.readFileSync(path.join(__dirname, 'index.html.ejs'), 'utf-8');

  var d = path.join(__dirname, 'assets');
  var assets = fs.readdirSync(d);
  assets.sort().forEach(function(asset) {
    var ext = path.extname(asset).replace('.', '');
    data.assets[ext] = data.assets[ext] || [];
    data.assets[ext].push(fs.readFileSync(path.join(d, asset), 'utf-8'));
  });

  log('generating HTML');
  process.stdout.write(ejs.render(index, data));

  log('killing mdb');
  mdb.child.kill();

  log('done. took %d seconds', (Date.now() - started) / 1000);
  process.stderr.write('\n');
}
