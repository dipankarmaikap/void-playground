# App UI, Profile, and Sessions Design

Date: 2026-11-14

## Problem Statement

The app has working email/password registration, Email Verification, login, a protected dashboard, and Session management, but its pages are still bare starter screens without a consistent layout. The public home page, auth forms, dashboard, and settings pages need a coherent, responsive UI. The User record also has no display name, so a User cannot personalize the dashboard or sidebar.

Page titles currently exist, but pages do not have route-specific descriptions or a deliberate indexing policy. The app name is also a generic hard-coded fallback, which would require repeated edits when the product name is chosen.

## Solution

Build a clean, light-first UI across the public home page, login and registration, the authenticated app shell, the dashboard, and Settings. Keep the public home page distinct from the dashboard. Use a minimal sidebar on desktop and a slide-out navigation drawer on mobile.

Add an optional display name collected during registration and editable under Settings → Profile. Make Settings contain Profile and Sessions navigation, and present the existing Session controls in the shared app shell. Keep the current authentication and Session security behavior.

Use one shared `APP_NAME` value for the app name throughout the UI and metadata. Give every route a useful title and description, allow indexing of the home and auth pages, and keep authenticated pages out of search results. Use inline Lucide SVG artwork through Remix-compatible components rather than `lucide-react`.

## User Stories

1. As a visitor, I want the home page to introduce the app simply and clearly, so that I can choose to register or log in.
2. As a User, I want the home page to remain publicly accessible after I authenticate, so that I can still visit it and navigate to the dashboard.
3. As a User, I want the app name to be consistent across the home page, sidebar, and page titles, so that the interface feels like one product.
4. As a visitor, I want a focused registration form, so that I can create a User without navigating a dashboard shell.
5. As a visitor, I want to provide an optional display name during registration, so that the app can greet me by name.
6. As a visitor, I want registration errors and field requirements to be clear, so that I can correct invalid input.
7. As a newly registered User, I want a clear Email Verification status, so that I know I must verify my email before logging in.
8. As a User, I want login errors and verification status messages to be readable and accessible, so that I understand the result of each attempt.
9. As a User, I want the login and registration pages to link to each other, so that I can switch flows without returning to the home page.
10. As a User, I want each page to have a meaningful title and description, so that browser tabs and search previews identify the page.
11. As an authenticated User, I want a dashboard with a useful greeting and links to Profile and Sessions, so that I can reach common settings quickly.
12. As a User without a display name, I want the dashboard and sidebar to use my email as a fallback, so that my identity is still visible.
13. As a User, I want a minimal sidebar with clear labels, icons, and active navigation states, so that I can tell where I am and move between app sections.
14. As a User, I want Settings to organize Profile and Sessions separately, so that I can find the relevant controls without crowding the main navigation.
15. As a User, I want to update my display name in Profile settings, so that I can change how the app addresses me.
16. As a User, I want to clear my display name, so that the app can fall back to my email instead.
17. As a User, I want the sidebar footer to show my display name and email, so that I can identify the current User.
18. As a User, I want a Log out action at the bottom of the sidebar, so that I can end the current Session from any authenticated page.
19. As a User, I want to see my active Sessions with browser/OS, IP, creation time, and last-active time, so that I can recognize unfamiliar activity.
20. As a User, I want the current Session clearly marked, so that I do not confuse it with another Session.
21. As a User, I want to Revoke one other Session, so that I can end access from a browser I no longer use.
22. As a User, I want to Revoke all other Sessions after confirmation, so that I can end other Sessions without ending the current Session.
23. As a User, I want protected pages to redirect unauthenticated requests to login, so that private profile and Session details remain protected.
24. As a mobile User, I want the sidebar to open as a slide-out drawer and close after navigation, so that the page remains usable on a small screen.
25. As a User using assistive technology, I want navigation, forms, status messages, and icon controls to have accessible names and semantics, so that I can use the app without relying on visual styling alone.

## Implementation Decisions

- **Shared app name:** Define one exported `APP_NAME` value in shared app configuration and use it for the home page, sidebar, and page titles. Start with the existing generic “My Remix App” placeholder; changing the value later must not require editing every page.
- **Public home:** Keep `/` public for both anonymous and authenticated requests. Render a simple welcome screen with register and login actions. For an authenticated User, provide a clear dashboard link instead of redirecting away from `/`. Do not invent product features, metrics, or testimonials.
- **Login and registration:** Use consistent, standalone form-card layouts without the authenticated sidebar. Retain the existing email/password flow and validation. Add an optional display-name field to registration. Preserve the Email Verification requirement and the final-product confirmation wording; do not show development-log details in the UI.
- **Email delivery:** Real email delivery is deferred. Registration continues to require Email Verification, but integrating an email provider is not part of this feature.
- **Display name:** Add a nullable display-name value to the User record. Existing Users must remain valid with no display name. Registration may set the value, and Profile settings may update or clear it. Treat blank input as unset; the display name is not a unique username or authentication identifier. Show the display name when present and otherwise use email.
- **Authenticated shell:** Use a restrained, light-first layout. The desktop sidebar has Dashboard and Settings as its main destinations; Settings provides Profile and Sessions subnavigation. The Settings entry opens Profile, and Sessions has its own route. Keep the User identity and a Log out form at the bottom of the sidebar.
- **Responsive navigation:** On small screens, open the sidebar as a slide-out drawer from an accessible menu control and close it after navigation. Keep text labels visible alongside icons; do not use icon-only primary navigation.
- **Dashboard:** Show a greeting using display name or email and shortcuts to Profile and Sessions. Do not show fabricated activity or product statistics.
- **Settings routes:** Use `/app/settings` for Profile and `/app/settings/sessions` for Session management. Keep both protected by `requireAuth()`. Update the shared route contract and use its typed hrefs for links, forms, and redirects.
- **Session management:** Preserve the existing Session storage and authorization rules. Show browser/OS, IP, created time, last-active time, and a current-Session marker. Allow Revoke of an individual other Session and confirmation before revoking all other Sessions. The current Session is ended through Log out, not a row-level Revoke action.
- **Icons:** Use a shared inline SVG icon component with Lucide icon paths. Remix 3 uses a non-React component runtime, so `lucide-react` is not a drop-in dependency. Do not add React or an icon-library dependency for this UI.
- **Metadata:** Generate route-specific titles in the form `<Page> | <APP_NAME>` and provide a page-specific description. The home, login, and registration pages are indexable. Authenticated dashboard and Settings pages are `noindex`. Add social-preview metadata to the public home page.
- **Forms and security:** Keep CSRF tokens on mutating forms, use server-side validation for display-name changes, and expose success/error feedback through accessible status/alert semantics. Icons that are decorative must not replace link or button labels.

## Testing Decisions

- Good tests exercise observable behavior through the router: response status and redirects, rendered HTML and metadata, form submission results, and persisted User/Session state. Avoid assertions on CSS class names or other implementation details.
- Prefer the existing `router.fetch` integration seam and in-memory SQLite database. Extend the root controller, auth controller, app controller, auth-flow, and session-flow tests rather than adding component unit tests or a new browser-test harness.
- Cover the public home for anonymous and authenticated Users, including its title, description, actions, and dashboard link.
- Cover login and registration markup, route metadata, registration with and without a display name, validation errors, Email Verification, and the existing verified-login requirement.
- Cover profile rendering, CSRF-protected display-name update and clearing, persistence, and the display-name/email fallback in subsequent dashboard and sidebar responses.
- Cover protected Profile and Sessions routes, Session detail rendering, the current-Session marker, individual Revoke, bulk Revoke confirmation markup, and preservation of the current Session after revoking others.
- Check that authenticated pages carry `noindex` metadata and that home/login/registration pages remain indexable with distinct descriptions.
- Assert the mobile menu control and navigation have accessible names and semantics in rendered HTML. Verify responsive layout visually at desktop and mobile widths during manual review; do not add browser automation for this feature.

## Out of Scope

- Real verification-email delivery or selection/configuration of an email provider.
- Password reset, password change, email change, User deletion, avatars, unique usernames, or additional profile fields.
- Product-specific dashboard data, metrics, activity feeds, or marketing claims.
- Dark mode or a theme switch.
- Adding React, `lucide-react`, or a new icon dependency.
- Browser-test infrastructure.
- Changes to Email Verification, authentication, CSRF, Session storage, Session ownership checks, or other existing security semantics.
- Advanced SEO work such as sitemaps, canonical URLs, or social-preview images.

## Further Notes

- Use the existing domain vocabulary: User, Email Verification, Session, Revoke, and Log out.
- Preserve the accepted hybrid Session storage design: anonymous Sessions remain cookie-backed and authenticated Sessions remain revocable through server-side storage.
- The selected page-indexing policy intentionally allows the public home and auth forms to be indexed while keeping authenticated pages out of search results.
- The confirmation UI uses final-product copy even though email delivery is deferred; this feature does not make verification emails operational.
