import type { RequestListenerOptions } from 'remix/node-fetch-server';

export const DEFAULT_SHUTDOWN_GRACE_PERIOD_MS = 10_000;

/**
 * Builds the request URL policy for the Node adapter.
 *
 * Production must either set a canonical public origin or explicitly trust a
 * reverse proxy that overwrites its forwarded-origin headers.
 */
export function getNodeRequestListenerOptions(
  env: NodeJS.ProcessEnv = process.env,
): RequestListenerOptions {
  let publicOriginValue = env.PUBLIC_ORIGIN?.trim();
  let trustProxy = env.TRUST_PROXY === 'true';

  if (publicOriginValue && trustProxy) {
    throw new Error('Configure only one of PUBLIC_ORIGIN or TRUST_PROXY=true');
  }

  if (publicOriginValue) {
    let publicOrigin: URL;
    try {
      publicOrigin = new URL(publicOriginValue);
    } catch {
      throw new Error('PUBLIC_ORIGIN must be a valid HTTP or HTTPS origin');
    }

    if (
      (publicOrigin.protocol !== 'http:' && publicOrigin.protocol !== 'https:') ||
      publicOrigin.username ||
      publicOrigin.password ||
      publicOrigin.pathname !== '/' ||
      publicOrigin.search ||
      publicOrigin.hash
    ) {
      throw new Error('PUBLIC_ORIGIN must contain only an HTTP or HTTPS origin');
    }

    if (env.NODE_ENV === 'production' && publicOrigin.protocol !== 'https:') {
      throw new Error('PUBLIC_ORIGIN must use HTTPS in production');
    }

    return {
      host: publicOrigin.host,
      protocol: publicOrigin.protocol,
    };
  }

  if (trustProxy || env.REMIX_NODE_HMR === '1') {
    return { trustProxy: true };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('Production requires PUBLIC_ORIGIN or TRUST_PROXY=true');
  }

  return { trustProxy: false };
}

/** Reads the graceful-shutdown window in milliseconds. */
export function getShutdownGracePeriodMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  let value = env.SHUTDOWN_GRACE_PERIOD_MS?.trim();
  if (!value) return DEFAULT_SHUTDOWN_GRACE_PERIOD_MS;

  let gracePeriodMs = Number(value);
  if (
    !Number.isSafeInteger(gracePeriodMs) ||
    gracePeriodMs < 0 ||
    gracePeriodMs > 2_147_483_647
  ) {
    throw new Error('SHUTDOWN_GRACE_PERIOD_MS must be a non-negative integer');
  }

  return gracePeriodMs;
}
