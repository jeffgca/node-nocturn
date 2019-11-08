const usb = require('usb');
const async = require('async');
const _ = require('underscore');
const binascii = require('binascii');

let currentDevice = false;

let list = usb.getDeviceList();

const config = require("./nocturn-config.json");

const NocturnHardware = require('./lib/nocturn-hardware');

let hw = new NocturnHardware(config);

hw.on('attached', () => {
  console.log('hardware is attached, trying to initialize.');
});

hw.on('opened', () => {
  console.log('hardware is initialized and ready for use.');
});

hw.on('message', (...args) => {
  console.log(args);
});

hw.on('detached', () => {
  console.log('hardware detached.');
});
