// app/main.js - Electron main process
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
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
    height: 680,
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
    return path.join(process.resourcesPath, 'app.asar', 'server.js');
  }
  return path.join(__dirname, '..', 'server.js');
}

async function startServer() {
  if (STATE.running) return;
  
  const serverPath = getServerPath();
  console.log('Starting server:', serverPath);
  
  try {
    // Spawn Node.js to run server.js
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe']
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
      STATE.running = false;
      STATE.serverProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('server-event', { event: 'error', message: err.message });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('server-event', { event: 'stderr', data: data.toString() });
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
    STATE.serverProcess.kill();
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
  createTray();
  createWindow();
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