const midi = require('midi');
const maxApi = require("max-api");

// Set up a new input.
var input = new midi.input();

var output = new midi.output();

console.log("Ports: ", output.getPortCount());
console.log("First port: ", output.getPortName(0));

output.openPort(0);
let loop = setInterval(() => {
  output.sendMessage([176,22,1]);
}, 2000);


// Configure a callback.
input.on('message', function(deltaTime, message) {
    console.log('m:' + message + ' d:' + deltaTime);
});

// Create a virtual input port.
input.openVirtualPort("Test Input");

process.stdin.resume();

process.on('SIGINT', function () {
  console.log('Got SIGINT, closing midi port.');
  clearInterval(loop);
  input.closePort();
  process.exit();
});
