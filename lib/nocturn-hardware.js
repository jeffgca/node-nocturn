const usb = require('usb');
const async = require('async');
const _ = require('underscore');
const binascii = require('binascii');

const initPackets = ["b00000","28002b4a2c002e35","2a022c722e30","7f00"];

class NocturnHardware {

  constructor(config, DEBUG_LEVEL=0) {
    this.config = config;
    this.opening = false;
    this.polling = false;
    this.nocturnVID = 0x1235;
    this.nocturnPID = 0x000a;
    this.connectedDevice = usb.findByIds(this.nocturnVID, this.nocturnPID) || false;

    var that = this;

    usb.on('attach', function(device) {
      if (that.isNocturn(device)) {
        console.log("got a Nocturn!");
        that.connectedDevice = device;
        that.open((err) => {
          if (err) throw err;
          console.log('completed opening in attach handler');
        });
      }
    });

    usb.on('detach', function(device) {
      if (that.isNocturn(device)) {
        that.close((err) => {
          if (err) throw err;
          console.log("Device closed.");
        });
      }
    });

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
    // console.log('Knobs: ', this.knobs);
  }

  open(callback) {
    if (this.opening) {
      console.log('open called during opening');
      callback(null);
      return;
    }
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
            console.log('Caught OUT endpoint error!');
            if (err) throw err;
          });

          this._client.out.on('end', () => {
            console.log('Transfer ended: ', this);
          });

          _.each(initPackets, (mesg) => {
            // console.log(bin, mesg);
            this._client.out.transfer(binascii.unhexlify(mesg), (err) => {
              if (err) throw err;
            });
          });
          callback(null); // success
        });
      } catch(e) {
        throw "Error connecting to the Nocturn: "+e;
      }
    } else {
      console.log("No nocturn found, try plugging your hardware in.");
    }
  }

  close(callback) {
    try {
      this.connectedDevice.close();
      console.log("Disconnected.");
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
    async.map(this.config.knobs, (knob) => {
      this.setLEDRingMode(knob, 0);
      this.setLEDRingValue(knob, 0);
    });
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
  poll(handler, callback) {
    if (this.polling) {
      console.log('poll>', 'called while polling is true');
      callback(null);
    }
    this._client.in.startPoll();
    this.polling = true;
    this._client.in.on('data', (data/* data is a Buffer */) => {
      console.log(data[1], data[2], data[3]);
      handler(data[1], data[2], data[3]);
    });

    this._client.in.on('error', (err) => {
      this.polling = false;
      console.error('In error handler');
    });
    callback(null);
  }

  _formatMessage(controller, state) {
    return [`${String.fromCharCode(controller)}`, `${String.fromCharCode(state)}`].join('');
  }

  write(message, callback) {
    this._client.out.transfer(message, callback);
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
    if (direction < 2) {
      this.knobs[ring].state++; // decrement and assign?
    }
    else if (direction === 127) {
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
    // console.log(this.buttons[controller], _state);
    this.write(this._formatMessage(controller, _state), (err) => {
      if (err) throw err;
      // console.log("write callback");
      this.buttons[controller].state = !this.buttons[controller].state;
      cb(null);
    });
  }

  // toggle every controller to initialize state
  fireItUp() {

  }
}

module.exports = NocturnHardware;
