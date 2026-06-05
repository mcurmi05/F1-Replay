const { app, BrowserWindow, dialog, ipcMain, session } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const http = require('node:http')

const PORT = 8000
const BASE_URL = `http://127.0.0.1:${PORT}`

let serverProcess = null

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose a directory for the F1-Replay cache',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

function startServer() {
  const env = { ...process.env, F1_NO_BROWSER: '1', PORT: String(PORT) }
  if (app.isPackaged) {
    const binary = path.join(process.resourcesPath, 'server', 'f1-replay')
    serverProcess = spawn(binary, [], { env })
  } else {
    const serverDir = path.join(__dirname, '..', 'server')
    const python = path.join(serverDir, '.venv', 'bin', 'python')
    serverProcess = spawn(python, ['launcher.py'], { cwd: serverDir, env })
  }
  serverProcess.stdout.on('data', (data) => console.log(`[server] ${data}`))
  serverProcess.stderr.on('data', (data) => console.error(`[server] ${data}`))
}

function waitForServer(onReady, attempts) {
  const request = http.get(`${BASE_URL}/`, (response) => {
    response.resume()
    onReady()
  })
  request.on('error', () => {
    if (attempts <= 0) {
      onReady()
      return
    }
    setTimeout(() => waitForServer(onReady, attempts - 1), 500)
  })
}

function allowF1Cors() {
  const filter = { urls: ['https://*.formula1.com/*'] }
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = Object.assign({}, details.responseHeaders)
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'access-control-allow-origin') {
        delete responseHeaders[key]
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*']
    callback({ responseHeaders })
  })
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0a0a0f',
    title: 'F1 Replay',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  waitForServer(() => window.loadURL(BASE_URL), 120)
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

app.whenReady().then(() => {
  allowF1Cors()
  startServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopServer()
  app.quit()
})

app.on('quit', stopServer)
