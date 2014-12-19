corevis
=======

Generate HTML based on information gathered with `mdb(1)` from
a [node.js](http://nodejs.org) core dump

Installation
------------

    [sudo] npm install -g corevis

Usage
-----

At Voxer, we use commands similar to the ones below to ensure that all
core dumps go to a specific directory

    mkdir /core
    coreadm -g /core/core.%f.%p -G all -e global -d process -e global-setid -d proc-setid -I all -e log

Run any of the [examples](examples) to generate a core dump, then use `corevis`
to make an HTML file with analysis.

    [root@test1 ~/node-corevis]# node examples/big-objects.js
    pid 9986
    Abort (core dumped)
    [root@test1 ~/node-corevis]# ./corevis.js /core/core.node.9986 > example.html
    > loading /core/core.node.9986... 147ms
    > getting status... 896ms
    > loading v8... 66ms
    > getting stack trace... 37ms
    > finding jsobjects (this can take a while)... 13585ms
    > calling ::jsprint -a on all objects found... 21975ms
    > analyzing data... 631ms
    > loading assets... 15ms
    > generating HTML... 167ms
    > killing mdb... 10ms
    > done. took 37.53 seconds...

And see the example here

http://us-east.manta.joyent.com/devops@voxer.com/public/corevis/example.html

### CLI Usage

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
