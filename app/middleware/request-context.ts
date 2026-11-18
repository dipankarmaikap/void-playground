import { type Middleware } from 'remix/router';

import { sessionRequestContext } from '../data/session/storage.ts';

// Display-only metadata; without a trusted proxy these headers are client-controlled.
export const requestContextMiddleware: Middleware = async (context, next) => {
  let ip =
    context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    context.request.headers.get('x-real-ip') ||
    'unknown';
  let userAgent = context.request.headers.get('user-agent') ?? 'unknown';
  return sessionRequestContext.run({ ip, userAgent }, () => next());
};