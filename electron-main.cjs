const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const ALLOWED_POPUP_HOSTS = ['accounts.google.com', 'content.googleapis.com'];

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // A pagina carrega scripts do Google; com Node exposto, qualquer script
    // injetado teria acesso total ao computador. O app nao usa APIs do Node.
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public/icons/icon-512.png'),
  });

  // Janelas do login Google abrem no app; qualquer outro link vai para o
  // navegador padrao em vez de virar uma janela com acesso ao app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (ALLOWED_POPUP_HOSTS.includes(new URL(url).hostname)) return { action: 'allow' };
    } catch {
      return { action: 'deny' };
    }
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, 'dist/index.html'));
}

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
