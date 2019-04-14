# node-nocturn

The goal is to create a node server that can be used by Max4Live to allow the nocturn to be used in Ableton without having to use Novation's Automap Server. Why? For science! Also I assume Automap will stop working eventually.

* JS Implementation of a Novation Nocturn USB driver, leveraging libusb and node-usb
* Heavily inspired by [the Python implementation](https://github.com/dewert/nocturn-linux-midi/) by [De Wet van Niekerk](https://github.com/dewert).

## Status


### TODO
* hardware initialization
* prototype turning buttons and led ring lights on and off
* logical control surface definition and object model
* implement Max4Live-compatible node script


### DONE
* <del>initial USB device detection
* <del>basic event loop catching connections
* <del>reading Nocturn's raw data from the USB connection
* <del>Nocturn device configuration data
