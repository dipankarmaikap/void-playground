import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? Number.parseInt(process.env.HMR_PROXY_PORT, 10)
  : null
const isHmr = process.env.REMIX_NODE_HMR === '1'

// Bun serves the fetch handler directly. HMR stays on Node (remix/node-hmr spawns the entry with
// Node loader hooks), so this file has to run under both runtimes.
type BunRuntime = {
  serve(options: { port: number; fetch: typeof router.fetch }): { stop(): void }
}
const bun = (globalThis as { Bun?: BunRuntime }).Bun

function onListening() {
  if (isHmr) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }

  console.log(`Server listening on http://localhost:${hmrProxyPort ?? port}`)
}

let shuttingDown = false
let close: () => void

if (bun && !isHmr) {
  const server = bun.serve({ port, fetch: router.fetch })
  close = () => {
    server.stop()
    process.exit(0)
  }
  onListening()
} else {
  const server = http.createServer(createRequestListener(router.fetch, { trustProxy: isHmr }))
  server.listen(port, onListening)
  close = () => {
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }
}

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  close()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
