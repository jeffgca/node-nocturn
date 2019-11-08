// a control surface layer that implements what controls map to which physical controllers
class AbletonLayer {}

// a control surface that contains one or more controller mapping layers
class AbletonSurface {}

// an individual fader control
class AbletonFader {

}

// an individual knob control
class AbletonKnob {

}

// an individual button control
class AbletonButton {

}

// a collection of (typically) eight knobs that constitute a device controller
class AbletonKnobs {
  constructor(ids, client) {
    this.ids = ids;
    this.client = client;
  }
}
