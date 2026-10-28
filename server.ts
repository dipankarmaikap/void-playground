import { router } from './app/router.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const hmrProxyPort = process.env.HMR_PROXY_PORT

Bun.serve({ port, fetch: (request) => router.fetch(request) })

console.log(`Server listening on http://localhost:${hmrProxyPort ?? port}`)
