import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';
import { ImportMap } from 'remix/component/server';
import { getContext } from 'remix/middleware/async-context';
import { getCspNonce } from 'remix/middleware/csp';

import { documentScriptEntry } from '../assets.ts';
import { APP_NAME } from '../config.ts';
import { fontAssetHref, fontFamily, fontStack, neutrals, typography } from '../ui/theme.ts';

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
    let { href, importMap, preloads } = getContext().get(documentScriptEntry);
    let nonce = getCspNonce(getContext());
    let pageTitle = title ? `${title} | ${APP_NAME}` : APP_NAME;

    // Authored styles need the request nonce under the app's nonce-only
    // style-src policy. css() rules get theirs from the render middleware, but
    // a global @font-face cannot live inside a generated, scoped class.
    let typographyStyle = `
      @font-face {
        font-family: "Inter";
        font-style: normal;
        font-weight: 400 900;
        font-display: swap;
        src: url("${fontAssetHref}") format("woff2");
      }
      body {
        font-family: ${fontStack};
        font-size: ${typography.bodyFontSize};
        line-height: ${typography.bodyLineHeight};
        color: ${neutrals.ink};
        background: ${neutrals.canvas};
      }
      button, input, select, textarea {
        font-family: ${fontStack};
      }
    `;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link
            rel="preload"
            as="font"
            type="font/woff2"
            href={fontAssetHref}
            crossorigin="anonymous"
            nonce={nonce}
          />
          <style nonce={nonce}>{typographyStyle}</style>
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
        <body
          mix={css({
            margin: 0,
            fontFamily,
            fontSize: typography.bodyFontSize,
            lineHeight: typography.bodyLineHeight,
            color: neutrals.ink,
            background: neutrals.canvas,
          })}
        >
          {children}
        </body>
      </html>
    );
  };
}
