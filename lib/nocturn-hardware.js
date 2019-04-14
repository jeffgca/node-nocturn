

class NocturnHardware {

  constructor(usb) {
    this.usb = usb;
    this.nocturnVID = 0x1235;
    this.nocturnPID = 0x000a;
    this.connectedDevice = this.usb.findByIds(nocturnVID, nocturnPID) || false;

    usb.on('attach', function(device) {
      if (this.isNocturn(device)) {
        // console.log("got a Nocturn!");
        this.connectedDevice = device;
      }
    });

    usb.on('detach', function(device) {
      if (this.isNocturn(device)) {
        this.connectedDevice = false;
      }
    });
  }

  open(callback) {
    try {
      this.connectedDevice.open();
      callback(null); // success
    } catch(e) {
      throw "Error connecting to the Nocturn: "+e;

    }
  }

  close(callback) {
    try {
      this.connectedDevice.close();
      callback(null);
    } catch(e) {
      throw "Error disconnecting to the Nocturn: "+e;
    }
  }

  read() {
    
  }
}

class NocturnLayer {}

class NocturnSurface {}
