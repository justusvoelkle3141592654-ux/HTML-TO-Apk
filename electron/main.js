// NovaChat – Desktop-App (Electron)
const { app, BrowserWindow, shell, Menu, session, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

if (!app.requestSingleInstanceLock()) app.quit();

const WWW = path.join(__dirname, '..', 'www');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gguf': 'application/octet-stream'
};

// Eigenes Protokoll app:// – sicherer Ursprung, damit Offline-KI (WebAssembly, Threads) und Speicher funktionieren
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true }
}]);

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(WWW, rel));
    if (!file.startsWith(WWW)) return new Response('Verboten', { status: 403 });
    try {
      const res = await net.fetch(pathToFileURL(file).toString());
      if (!res.ok) return new Response('Nicht gefunden', { status: 404 });
      return new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          // Ermöglicht SharedArrayBuffer -> Offline-KI nutzt mehrere Prozessorkerne
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Resource-Policy': 'same-origin'
        }
      });
    } catch (e) {
      return new Response('Nicht gefunden', { status: 404 });
    }
  });
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 380,
    minHeight: 520,
    backgroundColor: '#212121',
    title: 'NovaChat',
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  win.loadURL('app://novachat/index.html');
  win.once('ready-to-show', () => win.show());

  // Externe Links im Standardbrowser öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  registerAppProtocol();
  // Nur Mikrofon und Zwischenablage erlauben
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'clipboard-sanitized-write', 'clipboard-read', 'persistent-storage'].includes(permission));
  });
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
