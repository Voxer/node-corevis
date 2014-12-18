corevis
=======

Generate HTML based on information gathered with `mdb(1)` from
a [node.js](http://nodejs.org) core dump

Installation
------------

    [sudo] npm install -g corevis

Examples
--------

Run any of the [examples](examples) to generate a core dump, then use `corevis`
to make an HTML file with analysis.

    $ node ./examples/many-objects.js
    pid 82310
    Abort (core dumped)
    $ corevis core.node.82310 > index.html
    > loading core.node.82310
    > getting status
    > loading v8
    > getting stack trace
    > finding jsobjects (this can take a while)
    > calling ::jsprint -a on all objects found
    > analyzing data
    > loading assets
    > generating HTML
    > killing mdb
    > done. took 7.864 seconds

Usage
-----

    Usage: corevis [options] <node coredump>

    Generate HTML based on information gathered with mdb(1) from
    a node.js core dump

    Examples
        $ corevis core.node.1234 > vis.html
        $ corevis --load /var/tmp/v8-new.so core.node.1234 > vis.html

    Options
      -h, --help       print this message and exit
      -l, --load <v8>  argument to pass to `::load` in mdb(1), defaults to "v8"
      -u, --updates    check npm for available updates to this program
      -v, --version    print the version number and exit

License
-------

MIT License
