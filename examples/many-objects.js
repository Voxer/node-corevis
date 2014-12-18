#!/usr/bin/env node
/**
 * create many objects
 */

console.log('pid %d', process.pid);

function CustomObject() {
}

var arr = [];

for (var i = 0; i < 10000; i++) {
  var co = new CustomObject();
  co.name = 'Custom Object ' + i;
  arr.push(co);
}

process.abort();
