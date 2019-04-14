const usb = require('usb');
const async = require('async');
const _ = require('underscore');
const binascii = require('binascii');

usb.setDebugLevel(0); // 4 is the only useful level for libusb messages

let currentDevice = false;

let list = usb.getDeviceList();

// console.log(list);

// const initPackets = ["b00000","28002b4a2c002e35","2a022c722e30","7f00"];

const config = require("./nocturn-config.json");

const NocturnHardware = require('./lib/nocturn-hardware');

// console.log(typeof NocturnHardware);

let hw = new NocturnHardware(config);

function dispatch(controller, value) {
  // console.log(controller, hw.config.controllers);

// knobs
  if (_.contains(hw.config.controllers.knobs, controller)) {
    // console.log("Knob: ", controller, value);
    // if (value === 0)
    hw.setLEDRingValue(controller, value, (err) => {
      if (err) throw err;
    });
  }
  else if (_.contains(hw.config.controllers.buttons, controller)) {
    console.log("Button: ", controller, value);
    if (value === 127) {
      hw.toggleButton(controller, (err) => {
        if (err) throw err;
      });
    }
  }
  else if (_.contains(hw.config.controllers.faders, controller)) {
    // no hw lights to set here, nothing to do
    console.log("Fader: ", controller, value);
  }
  else {
    console.log("Unidentified: ", controller, value);
  }

}

hw.open((err) => {
  if (err) throw err;
  console.log("opened?");
  hw.poll(dispatch, (err) => {
    if (err) throw err;
    console.log('...polling.');
  });

  let topFuncs = _.map(hw.config.controllers.buttons, (button) => {
    return (step) => {

      setTimeout(() => {
        hw.toggleButton(button, (err) => {
          if (err) throw err;
          // console.log(`Toggled ${button}: ${hw.topButtons[button].state}`);
          setTimeout(() => {
            hw.toggleButton(button, (err) => {
              if (err) throw err;
            })
          }, 300);
        });
        step();
      }, 150);
    };
  });

  async.series(topFuncs);
  //
  // setInterval(() => {
  //   hw.toggleButton(112, () => {
  //     setTimeout(() => {
  //       hw.toggleButton(112, () => {
  //         //
  //       });
  //     }, 100);
  //   });
  // }, 2000);

  hw.initialize(() => {
    console.log('completed initialize()');
  })

});



// let nocturnVID = 0x1235;
// let nocturnPID = 0x000a;
//
// usb.on('attach', function(device) {
//   if (isNocturn(device)) {
//     // console.log("got a Nocturn!");
//     console.log("Nocturn connected.");
//     connectedDevice = device;
//     testDevice(connectedDevice, (err, result) => {
//       if (err) throw err;
//       console.log("testDevice>", result);
//     });
//   }
// });
//
// usb.on('detach', function(device) {
//   if (isNocturn(device)) {
//     clearInterval(interval);
//     console.log("Nocturn disconnected.");
//     connectedDevice = false;
//   }
// });
//
// function isNocturn(device) {
//   // console.log(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
//   let gotVendor = (device.deviceDescriptor.idVendor === nocturnVID);
//   let gotProduct = (device.deviceDescriptor.idProduct === nocturnPID);
//   if (gotVendor && gotProduct) {
//     return true;
//   }
//   else {
//     return false;
//   }
// }
//
// // Sets the LED ring mode for a specific LED ring
// // possible modes:
// //   0 = Start from MIN value,
// //   1 = Start from MAX value,
// //   2 = Start from MID value, single direction,
// //   3 = Start from MID value, both directions,
// //   4 = Single Value,
// //   5 = Single Value inverted
// // The center LED ring can't be set to a mode (or I haven't found out how)
// var interval;
//
// class Button {
//   constructor(id) {
//     this.id = id;
//   }
//
//   on(cb) {
//     let state = 0x01;
//     OUT.transfer(this._formatMessage(state), cb);
//   }
//
//   off(cb) {
//     let state = 0x00;
//     OUT.transfer(this._formatMessage(state), cb);
//   }
//
//   _formatMessage(state) {
//     return [`${String.fromCharCode(this.id)}`, `${String.fromCharCode(state)}`].join('');
//   }
// }
//
// function blink(step) {
//
//   // let controller = 113;
//   // setTimeout(() => {
//   //   console.log("timeout!");
//   //   step();
//   // }, 4000);
//
//   let buttons = config.controllers.topbuttons;
//
//   let onFuncs = _.map(buttons, (btn) => {
//     return (step) => {
//       let _b = new Button(btn);
//       _b.on(() => {
//         console.log(`turned ${btn} on`);
//         setTimeout(step, 150);
//         setTimeout(() => {
//           _b.off(() => {
//             console.log(`turned ${btn} off`);
//           });
//         }, 300);
//       });
//     };
//   });
//
//
//   async.series(onFuncs);
//
//   // var state = true;
//   // interval = setTimeout(() => {
//   //   if (state) {
//   //     bit = 0x01;
//   //   } else {
//   //     bit = 0x00;
//   //   }
//   //
//   //   console.log(controller, state);
//   //   let msg = [`${String.fromCharCode(controller)}`, `${String.fromCharCode(bit)}`];
//   //
//   //   // console.log('hex: ', Buffer.from(msg[0]).toString('hex'));
//   //   console.log("in interval", msg.join(''));
//   //   OUT.transfer(msg.join(''), (err) => {
//   //     if (err) throw err;
//   //     state = !state;
//   //   });
//   // }, 250);
//   step();
// }
//
// function blinkAllButtons(callback) {
//
// }
//
// var iFace, endpoint, IN, OUT;
//
// function testDevice(dev, callback) {
//   async.series([
//     (step) => {
//         console.log('Opening...');
//         dev.open(false);
//         dev.setConfiguration(1, step);
//         // step();
//     },
//     (step) => {
//       // console.log(dev.interfaces);
//       // console.log(_.keys(dev));
//       // console.log(dev.configDescriptor);
//       iFace = dev.interface(0)
//       iFace.claim();
//       // endpoint = iFace.endpoint(1);
//       // console.log(iFace.endpoints);
//
//       IN = iFace.endpoints[0];
//       OUT = iFace.endpoints[1];
//       // console.log(in.direction);
//
//       OUT.on('error', (err) => {
//         console.log('Caught OUT endpoint error!');
//         if (err) throw err;
//       });
//
//       OUT.on('end', () => {
//         console.log('Transfer ended: ', this);
//       });
//
//
//       var typeConfg = {
//         LIBUSB_TRANSFER_TYPE_BULK: usb.LIBUSB_TRANSFER_TYPE_BULK,
//         LIBUSB_TRANSFER_TYPE_INTERRUPT: usb.LIBUSB_TRANSFER_TYPE_INTERRUPT,
//         LIBUSB_TRANSFER_TYPE_ISOCHRONOUS: usb.LIBUSB_TRANSFER_TYPE_ISOCHRONOUS
//       };
//       console.log('types>', typeConfg);
//       console.log('transferType>', OUT.transferType);
//       _.each(initPackets, (mesg) => {
//         let bin = binascii.unhexlify(mesg)
//         // console.log(bin, mesg);
//         OUT.transfer(bin, (err) => {
//           if (err) throw err;
//         });
//       });
//       step();
//     },
//     blink,
//     (step) => {
//       IN.on('data', (data/* data is a Buffer */) => {
//         // console.log(data.data);
//         // console.log(data.length);
//         console.log(data[0], data[1], data[2], data[3]);
//       });
//
//       IN.on('error', (err) => {
//         console.log('In error handler');
//       });
//       IN.startPoll();
//       step();
//     },
//     // ,(step) => {
//     //   setTimeout(() => {
//     //     console.log('...closing.');
//     //     dev.close()
//     //   }, 2000);
//     // },
//   ]);
// }
//
// currentDevice = usb.findByIds(nocturnVID, nocturnPID);
//
// if (currentDevice) {
//   console.log("Nocturn discovered.");
//   testDevice(currentDevice, (err, result) => {
//     if (err) throw err;
//     console.log("testDevice>", result);
//   });
// }
