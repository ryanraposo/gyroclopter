// app/main.js - Electron main process
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { createInterface } = require('readline');
const os = require('os');
const { networkInterfaces } = require('os');

const STATE = {
  serverPid: null,
  running: false,
  connectedCount: 0,
  tray: null,
  stopping: false,
  starting: false
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
    // Server is inside app.asar
    return path.join(process.resourcesPath, 'app.asar', 'server.js');
  }
  return path.join(__dirname, '..', 'server.js');
}

async function startServer() {
  if (STATE.running || STATE.starting || STATE.stopping) {
    console.log('Skipping start - server is running:', STATE.running, ', starting:', STATE.starting, ', stopping:', STATE.stopping);
    return;
  }
  
  STATE.starting = true;
  const serverPath = getServerPath();
  console.log('Starting server:', serverPath);
  console.log('Is packaged:', require('electron').app.isPackaged);
  console.log('Resources path:', process.resourcesPath);
  
  try {
    // Spawn server.js using Electron's Node binary with ELECTRON_RUN_AS_NODE
    // This enables asar archive support while running as Node.js
    // Note: --no-sandbox is NOT needed when running as Node.js (only for Electron renderer)
    const serverProcess = spawn(process.execPath, [
      serverPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'  // Run as Node.js with asar support
      }
    });
    
    STATE.serverProcess = serverProcess;
    STATE.running = true;
    
    const statusLines = createInterface({ input: serverProcess.stdout });
    statusLines.on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (_) {
        return;
      }
      if (msg.event === 'started') {
        STATE.running = true;
        STATE.starting = false;
      } else if (msg.event === 'connection' || msg.event === 'disconnection') {
        STATE.connectedCount = msg.count;
      }
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('server-event', msg);
    });
    serverProcess.stdin.on('error', (err) => {
      console.error('Server control pipe:', err.message);
    });

    serverProcess.on('error', (err) => {
      console.error('Server process error:', err);
      STATE.running = false;
      STATE.starting = false;
      STATE.serverProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-event', { event: 'error', message: err.message });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const stderr = data.toString();
      console.error('Server stderr:', stderr);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-event', { event: 'stderr', data: stderr });
      }
    });
    
    serverProcess.on('close', (code) => {
      console.log('Server process exited with code:', code);
      STATE.running = false;
      STATE.stopping = false;
      STATE.starting = false;
      STATE.serverProcess = null;
      STATE.serverPid = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-exit');
        mainWindow.webContents.send('server-event', { event: 'stopped' });
      }
      updateTrayMenu();
    });
    
    updateTrayMenu();
  } catch (err) {
    console.error('Failed to start server', err);
    STATE.starting = false;
    STATE.running = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-event', { 
        event: 'error', 
        message: err.message 
      });
    }
    updateTrayMenu();
  }
}

function stopServer() {
  if (STATE.stopping) {
    console.log('Stop already in progress, ignoring');
    return;
  }
  if (STATE.serverProcess) {
    console.log('Stopping server process (PID:', STATE.serverProcess.pid, ')...');
    STATE.stopping = true;
    const serverProcess = STATE.serverProcess;
    serverProcess.stdin.end();
    // Windows terminates the child immediately on a signal. Give EOF a chance
    // to release any held input and close sockets on all platforms.
    const timeout = setTimeout(() => serverProcess.kill('SIGKILL'), 3000);
    timeout.unref();
    serverProcess.once('close', () => clearTimeout(timeout));
  } else {
    console.log('No server process to stop');
    STATE.stopping = false;
  }
  // Don't set STATE.running = false here - let the exit handler do it
  // This ensures UI stays in "running" state until process actually exits
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
  // On Windows, use ICO format for best tray icon support
  // On Linux, use PNG from the icons directory
  const iconPath = process.platform === 'win32' 
    ? path.join(__dirname, '..', 'build', 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icons', '16x16.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
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
  if (mainWindow && !mainWindow.isDestroyed()) {
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