const usb = require('usb');
const async = require('async');
const _ = require('underscore');
const binascii = require('binascii');
const EventEmitter = require('events');
// const midi = require('midi');

usb.setDebugLevel(0); // 4 is the only useful level for libusb messages

const initPackets = ["b00000","28002b4a2c002e35","2a022c722e30","7f00"];

class NocturnHardware extends EventEmitter {

  constructor(config, DEBUG_LEVEL=0) {
    super();
    this.config = config;
    this.DEBUG_LEVEL = DEBUG_LEVEL;
    this.opening = false;
    this.polling = false;
    this.nocturnVID = 0x1235;
    this.nocturnPID = 0x000a;

    var that = this;

    let _l = _.groupBy(_.map(this.config.controllers.buttons, (n) => {
      return {id: n, state: false};
    }), 'id');
    _.each(_l, (row, k) => {
      _l[k] = row[0];
    });
    this.buttons = _l;
    // console.log('Buttons: ', this.buttons);
    let _r = _.groupBy(_.map(this.config.controllers.knobs, (k) => {
      return {id: k, state: 22}; // 0 is the initial knob value
    }), 'id');
    _.each(_r, (row, k) => {
      _r[k] = row[0];
    });
    this.knobs = _r;

    // the attach event is emitted when the hardware is plugged in.
    this.on('attached', () => {
      if (this.isNocturn(this.connectedDevice)) {
        this._debug("Nocturn attached.");
        this.open((err) => {
          if (err) throw err;
          console.log('after open');
          // connect is emitted when the connection is ready to use
          this.emit('opened');
        });
      }
    });

    usb.on('attach', (device) => {
      that.connectedDevice = device;
      that.emit('attached');
    });

    usb.on('detach', function(device) {
      if (that.isNocturn(device)) {
        that.close((err) => {
          if (err) throw err;
          that.emit('detached')
          that._debug("Device closed.");
        });
      }
    });

    this.connectedDevice = usb.findByIds(this.nocturnVID, this.nocturnPID) || false;

    if (this.connectedDevice) {
      this.emit('attached');
      console.log("in constructor, found ", this.connectedDevice);
    } else {
      console.log("in constructor, didn't find a device.");
    }
  }

  open(callback) {
    this.opening = false;
    if (this.opening) {
      this._debug('open called during opening');
      callback(null);
      return;
    } else {
      this.opening = true;
      if (this.connectedDevice) {
        try {
          this.connectedDevice.open(false);
          this.connectedDevice.setConfiguration(1, (err) => {
            this.interface = this.connectedDevice.interface(0);
            try {
              this.interface.claim();
            } catch(e) {
              throw "Couldn't claim the USB device, is Automap Server running?\n\n" + e;
            }

            this._client = {};
            this._client.in = this.interface.endpoints[0];
            this._client.out = this.interface.endpoints[1];

            this._client.out.on('error', (err) => {
              this._debug('Caught OUT endpoint error!');
              if (err) throw err;
            });

            this._client.out.on('end', () => {
              this._debug('Transfer ended: ', this);
            });

            _.each(initPackets, (mesg) => {
              // this._debug(bin, mesg);
              this._client.out.transfer(binascii.unhexlify(mesg), (err) => {
                if (err) throw err;
              });
            });

            this.initialize((err) => {
              if (err) throw err;
              this.opening = false;
              this._client.in.on('data', (data/* data is a Buffer */) => {
                this.dispatch(data[1], data[2], (err) => {
                  if (err) throw err;
                });
              });

              this._client.in.on('error', (err) => {
                this.polling = false;
                this._debug('In error handler', err);
              });

              this._client.in.on('end', () => {
                this._debug('Polling ended.');
              });

              this._client.in.startPoll();
              this.emit('opened');
            });
          });
        } catch(e) {
          throw "Error connecting to the Nocturn: "+e;
        }
      } else {
        this._debug("No nocturn found, try plugging your hardware in.");
      }
    }
  }

  close(callback) {
    try {
      this.connectedDevice.close();
      this._debug("Disconnected.");
      this.connectedDevice = false;
      callback(null);
    } catch(e) {
      throw "Error disconnecting to the Nocturn: "+e;
    }
  }

  /* sets the hardware state we want for all controllers
   * and stores states locally
   * all rotary dials are set to mode 0
   */
  initialize(callback) {
    // async.map(this.config.knobs, (knob) => {
    //   this.setLEDRingMode(knob, 0);
    //   this.setLEDRingValue(knob, 0);
    // });

    let btnFuncs = _.map(this.config.controllers.buttons, (button) => {
      return (step) => {
        setTimeout(() => {
          this.toggleButton(button, (err) => {
            if (err) throw err;
            // this._debug(`Toggled ${button}: ${hw.topButtons[button].state}`);
            setTimeout(() => {
              this.toggleButton(button, (err) => {
                if (err) throw err;
              })
            }, 300);
          });
          step();
        }, 150);
      };
    });

    let dialFuncs = _.map(this.config.controllers.knobs, (ring) => {
      return (step) => {
        let ledValues = _.map(_.range(12), (i) => { return i * 11; });
        let revValues = [].slice.call(ledValues);
        revValues.reverse()
        ledValues = ledValues.concat(revValues);
        // console.log(ledValues);
        let ledFuncs = _.map(ledValues, (val) => {
          return (cb) => {
            setTimeout(() => {
              hw.write(hw._formatMessage(ring, val), cb);
            }, 50);
          };
        });
        ledFuncs.push(step);
        async.series(ledFuncs);

      };

    });

    // btnFuncs.concat(dialFuncs);
    // btnFuncs.push();
    async.series(btnFuncs);

    callback(null);
  }

  isNocturn(device) {
    let gotVendor = (device.deviceDescriptor.idVendor === this.nocturnVID);
    let gotProduct = (device.deviceDescriptor.idProduct === this.nocturnPID);
    if (gotVendor && gotProduct) {
      return true;
    }
    else {
      console.warn("What usb device is this?", gotVendor, gotProduct);
      return false;
    }
  }

  /* handled messages from the hardware */
  // poll(callback) {
  //   console.log(this);
  //   this._client.in.startPoll();
  //   this.polling = true;
  //
  //   callback(null);
  // }

  dispatch(controller, value, cb) {
    // console.log(this);
    if (_.contains(this.config.controllers.knobs, controller)) {
      this._debug("Knob: ", controller, value);
      // centre ring
      if (controller === 74) {
        // might be 80
        controller = 80;
      }
      this.emit('message', 'knob', controller, value);
      this.setLEDRingValue(controller, value, (err) => {
        if (err) throw err;
        cb(null);
      });
    } else if (_.contains(this.config.controllers.buttons, controller)) {
      this._debug("Button: ", controller, value);
      if (value === 127) {
        this.emit('message', 'button', controller, value);
        this.toggleButton(controller, (err) => {
          if (err) throw err;
          cb(null);
        });
      }
    } else if (_.contains(this.config.controllers.faders, controller)) {
      // no hw lights to set here, nothing to do
      this._debug("Fader: ", controller, value);
      this.emit('message', 'fader', controller, value);
    } else {
      this._debug("Unidentified: ", controller, value);
    }
  }

  _formatMessage(controller, state) {
    return [`${String.fromCharCode(controller)}`, `${String.fromCharCode(state)}`].join('');
  }

  write(message, callback) {
    // console.log('WRITE>', message);
    if (this._client && this._client.out) {
      this._client.out.transfer(message, callback);
    }
  }

  // Ring functions
  // Sets the LED ring mode for a specific LED ring
  // possible modes:
  //   0 = Start from MIN value,
  //   1 = Start from MAX value,
  //   2 = Start from MID value, single direction,
  //   3 = Start from MID value, both directions,
  //   4 = Single Value,
  //   5 = Single Value inverted
  // The center LED ring can't be set to a mode (or I haven't found out how)
  setLEDRingMode(ring, mode, cb) {
    if ((ring > 8) | (ring < 0)) {
      throw "The LED ring needs to be between 0 and 8"
    }
    if ((mode < 0) | (mode > 5)) {
      throw "The mode needs to be between 0 and 5"
    }

    this.write(_formatMessage(ring, (mode << 4)), (err) => {
      if (err) throw err;
      this.setLEDRingValue(ring, this.knobs[ring].state, cb);
    });
  }

  // Sets the LED ring value
  // ring = 0-8
  // value = 0-127
  setLEDRingValue (ring, direction, cb) {
    if (!_.contains(this.config.controllers.knobs, ring)) {
      throw "The LED ring needs to be between 64 and 74: "+ring
    }

    if ((direction < 0) | (direction > 127)) {
      throw "The LED ring value needs to be between 0 and 127"
    }
    if (direction <= 10) {
      this.knobs[ring].state++; // decrement and assign?
    }
    else if (direction >= 120) {
      this.knobs[ring].state--;
    }
    // clamp the values to within the range
    if (this.knobs[ring].state > 127) {
      this.knobs[ring].state = 127;
    } else if (this.knobs[ring].state < 0) {
      this.knobs[ring].state = 0;
    }
    this.write(this._formatMessage(ring, this.knobs[ring].state), cb)
  }

  // Button functions

  toggleButton(controller, cb) {
    let _state;
    this.buttons[controller].state ? _state = 0x00 : _state = 0x01;
    // this._debug(this.buttons[controller], _state);
    this.write(this._formatMessage(controller, _state), (err) => {
      if (err) throw err;
      // this._debug("write callback");
      this.buttons[controller].state = !this.buttons[controller].state;
      cb(null);
    });
  }

  _debug(message) {
    message = [].slice.call(arguments).join(' ');
    if (this.DEBUG_LEVEL > 0) {
      console.log('DEBUG>', message);
    }
  }
}

module.exports = NocturnHardware;
