/**
 * wrapper around mdb(1) for Illumos
 *
 * Author: Dave Eddy <dave@daveeddy.com>
 * Date: December 12, 2014
 * License: MIT
 */

var cp = require('child_process');
var util = require('util');

// so hacky.  we print this at the end of every
// command ran with mdb using ::echo so we know
// when the command is done running.
// TODO find a cleaner way
var MARKER = '=========mdb.js===========';

module.exports = MDB;

function MDB(args) {
  // args passed to the constructor will be forwarded to mdb(1)
  args = args || [];
  if (!Array.isArray(args))
    args = [args];

  // create a single mdb instance that will be reused
  this.child = cp.spawn('mdb', args);

  // let's assume we'll get human readable data
  this.child.stderr.setEncoding('utf-8');
  this.child.stdout.setEncoding('utf-8');
}

// run a single command and capture all output
// (and possible errors)
// XXX don't run more than one of these at a time
MDB.prototype.run = function run(cmd, cb) {
  var self = this;

  // check if we are already running
  if (this.isrunning)
    return cb(new Error('already running a command'));
  this.isrunning = true;

  // hook up listeners
  this.child.stderr.on('data', onstderr);
  this.child.stdout.on('data', onstdout);
  this.child.on('close', onclose);

  // these values will be returned
  var err = null;
  var stdout = '';
  var stderr = '';
  var all = '';

  // stderr generated
  function onstderr(s) {
    stderr += s;
    all += s;
  }

  // stdout generated
  function onstdout(s) {
    // mdb appends a ' \n' to what is echo'ed
    var mark = MARKER + ' \n';
    if (endsWith(s, mark)) {
      s = s.substr(0, s.length - mark.length);
      all += s;
      stdout += s;
      done();
      return;
    }

    all += s;
    stdout += s;
  }

  // program exited... consider this an error
  function onclose(code) {
    err = new Error('mdb exited');
    err.code = code;
    done();
  }

  function done() {
    self.child.stderr.removeListener('data', onstderr);
    self.child.stdout.removeListener('data', onstdout);
    self.child.removeListener('close', onclose);

    self.isrunning = false;

    cb(err, stdout, stderr, all);
  }

  // run the command given, and also append an echo of the MARKER
  // so we know when the command has finished
  this.child.stdin.write(util.format('%s\n::echo "%s"\n', cmd, MARKER));
};

function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
