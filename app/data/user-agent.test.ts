import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { deviceLabel } from './user-agent.ts';

describe('deviceLabel', () => {
  it('labels edge on windows', () => {
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      ),
      'Edge on Windows',
    );
  });

  it('labels chrome on macos', () => {
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
      'Chrome on macOS',
    );
  });

  it('labels firefox on linux', () => {
    assert.equal(
      deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'),
      'Firefox on Linux',
    );
  });

  it('labels safari on ios', () => {
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
      'Safari on iOS',
    );
  });

  it('labels chrome on android', () => {
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
      'Chrome on Android',
    );
  });

  it('falls back to unknown for missing or unrecognized agents', () => {
    assert.equal(deviceLabel(null), 'Unknown browser on Unknown OS');
    assert.equal(deviceLabel('curl/8.0'), 'Unknown browser on Unknown OS');
  });
});
