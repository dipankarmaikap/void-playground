import { router } from './app/router.ts';

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

Bun.serve({ port, fetch: (request) => router.fetch(request) });

console.log(`Server listening on http://localhost:${port}`);
