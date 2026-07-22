const { app, BrowserWindow, Menu, dialog, shell, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let appConfig = { appUrl: 'http://localhost' };

// Load config.json if available
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    appConfig = JSON.parse(rawConfig);
  } catch (err) {
    console.error('Failed to parse config.json:', err);
  }
}

function getAppHost(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.host;
  } catch (e) {
    return 'localhost';
  }
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              loadAppUrlWithCheck();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About PW Office',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About PW Office',
              message: 'PW Office Desktop',
              detail: `Version: 1.0.0\nEnvironment: Desktop Client\nTarget URL: ${appConfig.appUrl}\n\nPW Office Native Wrapper`,
              buttons: ['OK'],
              icon: path.join(__dirname, 'build', 'icon.ico')
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function checkServerReachable(url, callback) {
  try {
    const request = net.request({
      method: 'GET',
      url: url,
      redirect: 'follow'
    });

    request.on('response', (response) => {
      // 2xx or 3xx or 4xx means HTTP server is responding
      callback(true);
    });

    request.on('error', (error) => {
      console.log('Server reachability check failed:', error.message);
      callback(false);
    });

    request.end();
  } catch (err) {
    console.log('Error creating net request:', err);
    callback(false);
  }
}

function loadAppUrlWithCheck() {
  if (!mainWindow) return;

  // First load splash screen
  const splashPath = path.join(__dirname, 'splash.html');
  mainWindow.loadFile(splashPath);

  // Perform server reachability check with a slight delay for smooth UI feedback
  setTimeout(() => {
    checkServerReachable(appConfig.appUrl, (isReachable) => {
      if (isReachable) {
        mainWindow.loadURL(appConfig.appUrl);
      } else {
        const errorPath = path.join(__dirname, 'error.html');
        mainWindow.loadFile(errorPath);
      }
    });
  }, 1000);
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    resizable: true,
    title: 'PW Office',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  buildMenu();

  // Load initial URL via resilience check
  loadAppUrlWithCheck();

  // Intercept failed page loads (e.g. server crash, dropped connection)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Ignore user-initiated aborts (-3)
    if (isMainFrame && errorCode !== -3) {
      console.log(`Failed loading main frame (${errorCode}): ${errorDescription}`);
      const errorPath = path.join(__dirname, 'error.html');
      mainWindow.loadFile(errorPath);
    }
  });

  // Handle render process crash / gone
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
    const errorPath = path.join(__dirname, 'error.html');
    mainWindow.loadFile(errorPath);
  });

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const targetHost = getAppHost(url);
    const configuredHost = getAppHost(appConfig.appUrl);

    if (targetHost !== configuredHost && targetHost !== '127.0.0.1') {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const targetHost = getAppHost(url);
    const configuredHost = getAppHost(appConfig.appUrl);

    // If navigating to external site, prevent in-app navigation and open in browser
    if (targetHost !== configuredHost && targetHost !== '127.0.0.1' && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC listener for "Retry Connection" button on error page
ipcMain.on('retry-connection', () => {
  if (mainWindow) {
    loadAppUrlWithCheck();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
