import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';
import { ImportMap } from 'remix/component/server';
import { getContext } from 'remix/middleware/async-context';
import { getCspNonce } from 'remix/middleware/csp';

import { scriptEntry } from '../assets.ts';
import { APP_NAME } from '../config.ts';

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
  description?: string;
  noindex?: boolean;
  social?: boolean;
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title, description, noindex = false, social = false } = handle.props;
    let { href, importMap, preloads } = scriptEntry;
    let nonce = getCspNonce(getContext());
    let pageTitle = title ? `${title} | ${APP_NAME}` : APP_NAME;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{pageTitle}</title>
          {description ? <meta name="description" content={description} /> : null}
          {noindex ? <meta name="robots" content="noindex" /> : null}
          {social && title && description ? (
            <>
              <meta property="og:type" content="website" />
              <meta property="og:site_name" content={APP_NAME} />
              <meta property="og:title" content={pageTitle} />
              <meta property="og:description" content={description} />
              <meta name="twitter:card" content="summary" />
              <meta name="twitter:title" content={pageTitle} />
              <meta name="twitter:description" content={description} />
            </>
          ) : null}
          {head}
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} nonce={nonce} />
          ))}
          <script type="module" src={href} nonce={nonce}></script>
        </head>
        <body mix={css({ margin: 0 })}>{children}</body>
      </html>
    );
  };
}
