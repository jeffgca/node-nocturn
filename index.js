const usb = require('usb');
const async = require('async');
const _ = require('underscore');
const binascii = require('binascii');

usb.setDebugLevel(4); // 4 is the only useful level for libusb messages

let currentDevice = false;

let list = usb.getDeviceList();

// console.log(list);

const initPackets = ["b00000","28002b4a2c002e35","2a022c722e30","7f00"];

const config = require("./nocturn-config.json");

let nocturnVID = 0x1235;
let nocturnPID = 0x000a;

usb.on('attach', function(device) {
  if (isNocturn(device)) {
    // console.log("got a Nocturn!");
    console.log("Nocturn connected.");
    connectedDevice = device;
    testDevice(connectedDevice, (err, result) => {
      if (err) throw err;
      console.log("testDevice>", result);
    });
  }
});

usb.on('detach', function(device) {
  if (isNocturn(device)) {
    clearInterval(interval);
    console.log("Nocturn disconnected.");
    connectedDevice = false;
  }
});

function isNocturn(device) {
  // console.log(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
  let gotVendor = (device.deviceDescriptor.idVendor === nocturnVID);
  let gotProduct = (device.deviceDescriptor.idProduct === nocturnPID);
  if (gotVendor && gotProduct) {
    return true;
  }
  else {
    return false;
  }
}

// Sets the LED ring mode for a specific LED ring
// possible modes:
//   0 = Start from MIN value,
//   1 = Start from MAX value,
//   2 = Start from MID value, single direction,
//   3 = Start from MID value, both directions,
//   4 = Single Value,
//   5 = Single Value inverted
// The center LED ring can't be set to a mode (or I haven't found out how)
var interval;
function blink(step) {
  console.log("in blink");
  let controller = 113;
  // setTimeout(() => {
  //   console.log("timeout!");
  //   step();
  // }, 4000);
  var state = 1;
  interval = setInterval(() => {
    if (state === 0) {
      state = 1;
    }
    else {
      state = 0;
    }
    console.log(controller, state);
    let msg = [`${String.fromCharCode(controller)}`, `${String.fromCharCode(state)}`];

    // console.log('hex: ', Buffer.from(msg[0]).toString('hex'));
    console.log("in interval", msg.join(' '));
    OUT.transfer(msg.join(' '), (err) => {
      if (err) throw err;
      console.log('in callback: ', err);
    });
  }, 1000);
  step();
}

function setAll(mode, callback) {

}

var iFace, endpoint, IN, OUT;

function testDevice(dev, callback) {
  async.series([
    (step) => {
        console.log('Opening...');
        dev.open(false);
        dev.setConfiguration(1, step);
        // step();
    },
    (step) => {
      // console.log(dev.interfaces);
      // console.log(_.keys(dev));
      // console.log(dev.configDescriptor);
      iFace = dev.interface(0)
      iFace.claim();
      // endpoint = iFace.endpoint(1);
      // console.log(iFace.endpoints);

      IN = iFace.endpoints[0];
      OUT = iFace.endpoints[1];
      // console.log(in.direction);
      _.each(initPackets, (mesg) => {
        let bin = binascii.unhexlify(mesg)
        console.log(bin, mesg);
        OUT.transfer(bin, (err) => {
          if (err) throw err;
        });
      });
      step();
    },
    // blink,
    (step) => {
      IN.on('data', (data/* data is a Buffer */) => {
        // console.log(data.data);
        // console.log(data.length);
        console.log(data[0], data[1], data[2], data[3]);
      });
      IN.startPoll();
      step();
    },
    // ,(step) => {
    //   setTimeout(() => {
    //     console.log('...closing.');
    //     dev.close()
    //   }, 2000);
    // },
  ]);
}

currentDevice = usb.findByIds(nocturnVID, nocturnPID);

if (currentDevice) {
  console.log("Nocturn discovered.");
  testDevice(currentDevice, (err, result) => {
    if (err) throw err;
    console.log("testDevice>", result);
  });
}
