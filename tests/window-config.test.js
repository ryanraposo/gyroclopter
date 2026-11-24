const { EventEmitter } = require('events');

test('Electron startup creates the illustrated window on Linux and macOS', async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  for (const platform of ['linux', 'darwin', 'win32']) {
    jest.resetModules();
    Object.defineProperty(process, 'platform', { ...platformDescriptor, value: platform });
    const createWindow = jest.fn(() => {
      const window = new EventEmitter();
      window.loadFile = jest.fn();
      window.setMenu = jest.fn();
      return window;
    });
    const createTray = jest.fn(() => {
      const tray = new EventEmitter();
      tray.setToolTip = jest.fn();
      tray.setContextMenu = jest.fn();
      return tray;
    });
    const app = new EventEmitter();
    app.whenReady = () => Promise.resolve();
    app.requestSingleInstanceLock = () => true;
    jest.doMock('electron', () => ({
      app,
      BrowserWindow: createWindow,
      ipcMain: new EventEmitter(),
      Tray: createTray,
      Menu: { buildFromTemplate: jest.fn() },
      nativeImage: { createFromPath: () => ({ resize: jest.fn() }) }
    }));
    try {
      require('../app/electron-main');
      await app.whenReady();
      const [options] = createWindow.mock.calls[0];
      expect(options.webPreferences.additionalArguments).toEqual(
        platform === 'win32' ? [] : ['--illustrated-window']
      );
      expect(options.transparent || false).toBe(platform === 'darwin');

      const window = createWindow.mock.results[0].value;
      const close = { preventDefault: jest.fn() };
      window.hide = jest.fn();
      window.emit('close', close);
      expect(close.preventDefault).toHaveBeenCalledTimes(1);
      app.emit('before-quit');
      window.emit('close', close);
      expect(close.preventDefault).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, 'platform', platformDescriptor);
    }
  }
});
