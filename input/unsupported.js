class UnsupportedInputController {
  constructor(platform = process.platform) {
    this.name = `unsupported-${platform}`;
    this.available = false;
    this.platform = platform;
    console.warn(`Gyroclopter input is not implemented for platform: ${platform}`);
  }

  sendCommand() {}

  dispose() {}
}

module.exports = UnsupportedInputController;
