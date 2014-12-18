#!/usr/bin/env node
/**
 * create some big objects
 */

console.log('pid %d', process.pid);

function CustomObject() {
}

var o = {
  array: [],
  object: {},
  co: new CustomObject()
};

for (var i = 0; i < 10000; i++) {
  o.array.push('hello world ' + i);
  o.object['prop ' + i] = 'hello world ' + i;
  o.co['prop ' + i] = 'hello world ' + i;
}

process.abort();
