export interface RuntimeErrorEvent {
  readonly error: unknown;
}

export interface RuntimeErrorHandlerDependencies {
  report(error: unknown): void;
  showRecovery(recover: () => void): void;
  recover(): void;
}

export function createRuntimeErrorHandler({
  report,
  showRecovery,
  recover,
}: RuntimeErrorHandlerDependencies): (event: RuntimeErrorEvent) => void {
  let recoveryShown = false;

  return (event) => {
    report(event.error);
    if (recoveryShown) return;

    recoveryShown = true;
    showRecovery(recover);
  };
}

export function reportBrowserRuntimeError(error: unknown): void {
  console.error('Browser runtime error', error);
}
