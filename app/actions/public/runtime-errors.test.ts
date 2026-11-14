import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createRuntimeErrorHandler } from './runtime-errors.ts';

describe('createRuntimeErrorHandler', () => {
  it('reports original errors and exposes one recovery action', () => {
    let reportedErrors: unknown[] = [];
    let recoveryAction: (() => void) | undefined;
    let recoveryPrompts = 0;
    let reloads = 0;

    let handleRuntimeError = createRuntimeErrorHandler({
      report(error) {
        reportedErrors.push(error);
      },
      showRecovery(recover) {
        recoveryPrompts++;
        recoveryAction = recover;
      },
      recover() {
        reloads++;
      },
    });

    let originalError = new TypeError('frame hydration failed');
    handleRuntimeError({ error: originalError });

    assert.equal(reportedErrors.length, 1);
    assert.equal(reportedErrors[0], originalError);
    assert.equal(recoveryPrompts, 1);
    assert.ok(recoveryAction, 'the recovery UI should receive an action');
    recoveryAction();
    assert.equal(reloads, 1);

    let secondError = new Error('enhanced navigation failed');
    handleRuntimeError({ error: secondError });

    assert.equal(reportedErrors.length, 2);
    assert.equal(reportedErrors[1], secondError);
    assert.equal(recoveryPrompts, 1, 'the recovery UI should not be duplicated');
  });
});
