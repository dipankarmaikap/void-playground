import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';
import { ImportMap } from 'remix/component/server';
import { getContext } from 'remix/middleware/async-context';
import { getCspNonce } from 'remix/middleware/csp';

import { scriptEntry } from '../assets.ts';

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
}

const DEFAULT_TITLE = readAppDisplayName('My%20Remix%20App');

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE } = handle.props;
    let { href, importMap, preloads } = scriptEntry;
    let nonce = getCspNonce(getContext());

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href} nonce={nonce}></script>
        </head>
        <body mix={css({ margin: 0 })}>{children}</body>
      </html>
    );
  };
}

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value);
}
