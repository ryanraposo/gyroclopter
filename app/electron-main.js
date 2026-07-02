// app/main.js - Electron main process
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, utilityProcess } = require('electron');
const path = require('path');
const os = require('os');
const { networkInterfaces } = require('os');

const STATE = {
  serverPid: null,
  running: false,
  connectedCount: 0,
  tray: null
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Gyroclopter',
    icon: path.join(__dirname, 'favicon.ico'),
    width: 420,
    height: 700,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setMenu(null);

  // Minimize to tray on close
  mainWindow.on('close', (event) => {
    if (process.appClosing) {
      return;
    }
    event.preventDefault();
    mainWindow.hide();
    return false;
  });

  // Auto-start server on launch
  mainWindow.once('ready-to-show', () => {
    startServer();
  });
}

function getServerPath() {
  const { app } = require('electron');
  if (app.isPackaged) {
    // Server is extracted to extraResources, not in asar
    return path.join(process.resourcesPath, 'server.js');
  }
  return path.join(__dirname, '..', 'server.js');
}

async function startServer() {
  if (STATE.running) return;
  
  const serverPath = getServerPath();
  console.log('Starting server:', serverPath);
  console.log('Is packaged:', require('electron').app.isPackaged);
  console.log('Resources path:', process.resourcesPath);
  
  try {
    // Use utilityProcess.fork for better Electron integration
    // This handles asar archives automatically and has better lifecycle management
    const serverProcess = utilityProcess.fork(serverPath, [], {
      stdio: 'pipe',
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      }
    });
    
    STATE.serverProcess = serverProcess;
    STATE.running = true;
    
    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (mainWindow) {
            mainWindow.webContents.send('server-event', msg);
          }
          switch (msg.event) {
            case 'started':
              STATE.running = true;
              break;
            case 'connection':
            case 'disconnection':
              STATE.connectedCount = msg.count;
              break;
          }
        } catch (_) {
          // Ignore non-JSON lines
        }
      }
    });
    
    serverProcess.on('error', (err) => {
      console.error('Server process error:', err);
      STATE.running = false;
      STATE.serverProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('server-event', { event: 'error', message: err.message });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const stderr = data.toString();
      console.error('Server stderr:', stderr);
      if (mainWindow) {
        mainWindow.webContents.send('server-event', { event: 'stderr', data: stderr });
      }
    });
    
    serverProcess.on('exit', (code) => {
      STATE.running = false;
      STATE.serverProcess = null;
      STATE.serverPid = null;
      if (mainWindow) {
        mainWindow.webContents.send('server-exit');
        mainWindow.webContents.send('server-event', { event: 'stopped' });
      }
      updateTrayMenu();
    });
    
    updateTrayMenu();
  } catch (err) {
    console.error('Failed to start server', err);
    if (mainWindow) {
      mainWindow.webContents.send('server-event', { 
        event: 'error', 
        message: err.message 
      });
    }
    STATE.running = false;
    updateTrayMenu();
  }
}

function stopServer() {
  if (STATE.serverProcess) {
    console.log('Stopping server process...');
    // utilityProcess has a kill() method that sends SIGTERM
    STATE.serverProcess.kill();
    
    // Clear references immediately
    STATE.serverProcess = null;
    STATE.serverPid = null;
  }
  STATE.running = false;
  updateTrayMenu();
}

function updateTrayMenu() {
  const trayMenu = Menu.buildFromTemplate([
    { 
      label: 'Show', 
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: STATE.running ? 'Stop Server' : 'Start Server',
      click: () => {
        if (STATE.running) {
          stopServer();
        } else {
          startServer();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (STATE.running) stopServer();
        process.appClosing = true;
        app.quit();
      }
    }
  ]);
  
  if (STATE.tray) {
    STATE.tray.setContextMenu(trayMenu);
  }
}

function createTray() {
  // Use the icon from app directory
  const iconPath = path.join(__dirname, 'favicon.ico');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  STATE.tray = new Tray(trayIcon);
  updateTrayMenu();
  
  STATE.tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// IPC handlers
ipcMain.on('start-server', () => {
  startServer();
});

ipcMain.on('stop-server', () => {
  stopServer();
});

app.whenReady().then(() => {
  // Request single instance lock - if we can't get it, quit immediately
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log('Another instance is already running. Exiting.');
    app.quit();
    return;
  }
  
  createTray();
  createWindow();
});

app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Another instance tried to start - focus our window instead
  console.log('Second instance detected, focusing existing window');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();
  }
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
  // Keep app running in tray
});

app.on('will-quit', () => {
  stopServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});