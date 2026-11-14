import type { Server } from 'node:http';

export type ShutdownServer = Pick<Server, 'close' | 'closeAllConnections'>;
export type ResourceCloser = () => void | Promise<void>;

export interface ShutdownHooks {
  gracePeriodMs: number;
  onError: (error: unknown) => void;
  setExitCode: (code: number) => void;
}

/**
 * Stops accepting requests, drains active connections, then closes owned resources.
 * Repeated signals share the same operation so resources are closed at most once.
 */
export function createShutdownHandler(
  server: ShutdownServer,
  closeResources: readonly ResourceCloser[],
  hooks: ShutdownHooks,
): () => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;

  return () => {
    shutdownPromise ??= shutdown();
    return shutdownPromise;
  };

  async function shutdown(): Promise<void> {
    let failures: unknown[] = [];
    let forceCloseTimer: NodeJS.Timeout | undefined;

    let serverClosed = new Promise<void>((resolve, reject) => {
      try {
        server.close((error) => (error ? reject(error) : resolve()));
        forceCloseTimer = setTimeout(() => server.closeAllConnections(), hooks.gracePeriodMs);
      } catch (error) {
        reject(error);
      }
    });

    try {
      await serverClosed;
    } catch (error) {
      failures.push(error);
    } finally {
      if (forceCloseTimer) clearTimeout(forceCloseTimer);
    }

    let results = await Promise.allSettled(
      closeResources.map((closeResource) => Promise.resolve().then(closeResource)),
    );
    failures.push(
      ...results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason),
    );

    if (failures.length > 0) {
      hooks.onError(
        failures.length === 1
          ? failures[0]
          : new AggregateError(failures, 'One or more server shutdown steps failed'),
      );
      hooks.setExitCode(1);
    }
  }
}
