import type { Route } from 'remix/routes';
import { requireAuth as requireAuthenticated } from 'remix/middleware/auth';
import { redirect } from 'remix/response/redirect';

import type { User } from '../data/db.ts';
import { routes } from '../routes.ts';

export interface RequireAuthOptions {
  /** The sign-in destination; defaults to the login form. */
  redirectTo?: Route;
}

/**
 * Guards an authenticated controller, sending anonymous visitors to login with their current
 * destination preserved in a sanitized `returnTo` search parameter.
 */
export function requireAuth(options?: RequireAuthOptions) {
  let redirectTo = options?.redirectTo ?? routes.auth.login.index;

  return requireAuthenticated<User>({
    onFailure(context) {
      return redirect(
        redirectTo.href(undefined, {
          searchParams: {
            returnTo:
              getSafeReturnTo(context.url.searchParams.get('returnTo')) ??
              context.url.pathname + context.url.search,
          },
        }),
      );
    },
  });
}

/** The sanitized post-login destination, or the dashboard when none is safe. */
export function getPostAuthRedirect(url: URL, fallback = routes.app.dashboard.href()): string {
  return getSafeReturnTo(url.searchParams.get('returnTo')) ?? fallback;
}

/** The sign-in href for `route`, carrying the sanitized `returnTo` from `url` when present. */
export function getLoginRedirectURL(
  url: URL,
  route: Route<any, any> = routes.auth.login.index,
): string {
  return route.href(undefined, {
    searchParams: { returnTo: getSafeReturnTo(url.searchParams.get('returnTo')) },
  });
}

/**
 * Accepts only site-relative path destinations: a leading slash without a second slash, so
 * external origins and protocol-relative values can never leave the site.
 */
function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') {
    return undefined;
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return undefined;
  }

  return returnTo;
}
