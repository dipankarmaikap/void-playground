# Client Management Design

Date: 2026-11-14

## Problem Statement

The app has authenticated Users but no structured way to keep the individuals and businesses they manage as Clients. A Client needs a profile with useful identity, contact, billing, and tax details, including India-specific GST information where relevant.

Clients are records managed in the app, not people who sign in. The initial feature should make the client book useful without adding financial ledgers, invoicing, or tax-compliance workflows.

## Solution

Add a Clients directory to the authenticated app. Users can create, view, edit, search, archive, and restore Individual and Business profiles. Profiles support global billing addresses and currencies, flexible business-industry text, and one optional tax identifier.

The Client book is intentionally global and shared: every authenticated User can read and modify every Client. Clients do not receive accounts or invitations. The feature does not add accounts, transactions, invoices, or tax calculations.

## User Stories

1. As an authenticated User, I want to open a Clients directory, so that I can manage the people and businesses I work with.
2. As an authenticated User, I want to see Clients created by other authenticated Users, so that the app presents one shared Client book.
3. As an unauthenticated visitor, I want protected Client pages to redirect me to login, so that Client information is not exposed publicly.
4. As an authenticated User, I want to create an Individual profile, so that I can manage a person as a Client.
5. As an authenticated User, I want to create a Business profile, so that I can manage a business as a Client.
6. As an authenticated User, I want to choose Individual or Business when creating a Client, so that the profile presents the relevant fields.
7. As an authenticated User, I want an Individual profile to require a full legal name, so that the record has a reliable identity.
8. As an authenticated User, I want to provide an optional preferred name for an Individual, so that I can address the Client as they prefer.
9. As an authenticated User, I want an Individual’s preferred name to appear before their legal name when available, so that lists use a familiar label without losing the legal name.
10. As an authenticated User, I want a Business profile to require its legal name, so that billing records identify the business.
11. As an authenticated User, I want to provide an optional trading name for a Business, so that the profile can reflect its public-facing name.
12. As an authenticated User, I want a Business’s trading name to appear before its legal name when available, so that lists use the name I recognize.
13. As an authenticated User, I want an Individual’s email and phone to be optional, so that I can create a profile when I have only basic identity information.
14. As an authenticated User, I want optional shared email and phone details on a Business, so that I can record its main contact channels.
15. As an authenticated User, I want to record one optional named primary contact for a Business, with optional contact details and role, so that I know whom to reach there.
16. As an authenticated User, I want to record an optional free-text industry for a Business, so that I can describe its line of work without being restricted to a country-specific taxonomy.
17. As an authenticated User, I want to save a Client with only its type and required legal name, so that I can fill in other details later.
18. As an authenticated User, I want optional contact, address, currency, industry, and tax details, so that incomplete information does not prevent client onboarding.
19. As an authenticated User, I want to view and edit a Client profile, so that I can keep its details current.
20. As an authenticated User, I want to change a Client’s type when its classification changes or was entered incorrectly, so that the profile remains useful.
21. As an authenticated User, I want type-specific values preserved when they are hidden after a type change, so that correcting the classification does not erase previously entered information.
22. As an authenticated User, I want one current structured billing address per Client, so that billing details are organized consistently.
23. As an authenticated User, I want to enter an address line and country when I provide a billing address, so that the address has a useful minimum while accommodating international formats.
24. As an authenticated User, I want locality, region or State, and postal code to remain optional where appropriate, so that the form works for different countries.
25. As an authenticated User, I want one optional default billing currency per Client, so that the profile can express the currency I expect to use.
26. As an authenticated User, I want the billing currency suggested from the billing country but remain editable, so that I can select the currency that actually applies.
27. As an authenticated User, I want to store a generic tax identifier for a Client outside India, including its country and identifier type, so that common foreign tax IDs can be recorded.
28. As an authenticated User, I want to store an India GSTIN or UIN and its associated State/UT name and code, so that the profile includes the India-specific tax information selected for this release.
29. As an authenticated User, I want a Client to have at most one tax identifier, so that the first release keeps the tax profile intentionally simple.
30. As an authenticated User, I want a missing tax identifier to mean “not recorded” rather than “unregistered,” so that the app does not claim a tax status I have not supplied.
31. As an authenticated User, I want basic tax-identifier format checks without government verification, so that obvious input errors can be corrected without implying the identifier is active.
32. As an authenticated User, I want tax identifiers to be available on either Individual or Business profiles, so that the field is not restricted by the app’s client-type label.
33. As an authenticated User, I want repeated names and contact details to be allowed, so that legitimate Clients are not blocked by non-unique details.
34. As an authenticated User, I want a warning when a tax identifier is already on another profile, while still being allowed to save, so that I can catch possible mistakes without blocking legitimate records.
35. As an authenticated User, I want the active Client directory to show active profiles by default, so that archived records do not crowd out current work.
36. As an authenticated User, I want to search Clients by name, email, or phone, so that I can quickly find a profile.
37. As an authenticated User, I want to filter Clients by Individual or Business and by active or archived status, so that I can narrow the directory.
38. As an authenticated User, I want to archive a Client instead of permanently deleting it, so that inactive records and their information are retained.
39. As an authenticated User, I want to view and restore archived Clients, so that a returning Client can be made active again.
40. As an authenticated User, I want every authenticated User to be able to view and edit the same Client record, so that the book behaves as one global shared directory.
41. As an authenticated User, I want Client mutations protected by the app’s existing CSRF behavior, so that cross-site form submissions cannot change shared records.
42. As an authenticated User, I want clear accessible labels and validation feedback on Client forms, so that I can understand and correct errors.
43. As an authenticated User, I want Client pages to have useful page titles and descriptions and remain out of search-engine indexing, so that private app screens are identified consistently without being indexed.
44. As a mobile User, I want the Clients destination and profile forms to work in the existing responsive app shell, so that I can manage Clients on a small screen.

## Implementation Decisions

- **Domain language:** Use `User` for a person who can authenticate and `Client` for a managed Individual or Business profile. A Client is not a User and receives no credentials or Session.
- **Shared access:** Store one global Client book. Do not scope Client records to the authenticated User or introduce a workspace, membership, or role model. Every authenticated User can read and mutate all Client records. Because the app permits self-service User registration, any newly registered User receives the same access; this is an intentional, explicitly confirmed product decision.
- **Routes and authentication:** Add a Clients route group under the authenticated app area for the directory, profile display/edit, creation, archive, and restore actions. Add Clients to the authenticated app navigation. Protect every nested Client controller with `requireAuth()`; middleware on a parent controller does not flow into nested controllers. Use the shared route contract for links and form actions.
- **Client persistence:** Add Client persistence to the existing SQLite data layer as a separate domain from Users and Sessions. The shared records have no User-owner column. Keep the Client data operations and field validation behind a focused Client data module; route controllers should orchestrate requests, authentication, form feedback, and rendering.
- **Profile types and names:** A Client is either Individual or Business. Individuals require a full legal name and may have a preferred name. Businesses require a legal name and may have a trading name. Use the preferred name or trading name as the display label when present, otherwise use the legal name. Type changes are allowed; retain type-specific values when those fields are hidden.
- **Contacts:** Individual email and phone are each optional, with at most one of each. A Business may have one optional business-level email and phone plus one optional named primary contact (the name is required if the contact is present) with optional role, email, and phone. Accept international phone numbers. Email and phone receive format checks, not ownership verification. Contact values and names are not unique.
- **Industry:** Business industry is optional free text. Do not require or provide a fixed industry taxonomy or suggestion list.
- **Address and currency:** Keep at most one current billing address per Client. The address may be omitted; when present, address line 1 and country are required, while locality, region/State, and postal code are optional. Keep at most one optional default billing currency. Suggest a currency from the billing country when available, but allow the User to choose or change it. Do not add exchange-rate or conversion behavior.
- **Tax identifier:** Keep at most one optional tax identifier on each Client, regardless of Client type. Store its country, identifier type, and value. For India, support GSTIN or UIN and the associated State/UT name and code. Use the existing legal name and single billing address rather than adding separate tax names or registration addresses. Do not add separate PAN, GST category, registered/unregistered status, delivery address, or place-of-supply fields. A blank identifier is unknown, not proof of unregistered status. Apply basic format validation only; do not query a government registry or claim that an identifier is active.
- **Tax-ID duplicates and search:** Warn when an identifier is already present on another Client, but permit saving. Do not search the directory by tax identifier; search by names, email, and phone only.
- **Lifecycle and duplicates:** New Clients start Active. Archive preserves a Client and hides it from the default active list; Users can view archived records and restore them. Do not hard-delete Clients. Names and contact details may repeat; do not impose uniqueness constraints on them.
- **Forms and shell:** Use server-side validation and the app’s existing CSRF-protected form pattern. Return accessible error/status feedback and retain submitted values on validation errors. Render Client pages in the existing authenticated shell with route-specific metadata and `noindex`.
- **Authentication behavior:** Leave User registration, authentication, and Session behavior unchanged. The feature adds no Client login or invitation flow.

## Testing Decisions

- Good tests exercise observable behavior through the router: HTTP status and redirects, rendered HTML, form submissions, search/filter results, and persisted Client records. Avoid tests coupled to CSS classes or internal table implementation.
- Use the existing `router.fetch` integration seam and test-mode in-memory SQLite database as the primary test seam. Reuse the existing login and CSRF form helpers. Do not add a component-only test seam or a new browser-test harness.
- Prior art is the authenticated app controller integration tests, which already cover protected routes, rendered shell/navigation, CSRF-protected updates, validation feedback, and persisted state; the auth/session flow tests and shared HTTP test helpers provide login, cookie, CSRF, and form patterns.
- Verify unauthenticated requests to Client pages and actions are rejected or redirected to login.
- Verify shared access explicitly: create or edit a Client as one User, then read and edit that same Client as a second authenticated User. Verify anonymous requests still cannot read or mutate it.
- Verify creation and editing for both Client types, the minimum required fields, display-name fallback rules, optional fields, type changes, and preservation of hidden type-specific values.
- Verify address requirements, optional currency selection and country-based suggestion, and that no currency conversion is performed.
- Verify generic tax identifiers and India GSTIN/UIN plus State/UT fields, basic format errors, the one-identifier-per-Client limit, missing-ID semantics, and a non-blocking duplicate-ID warning. Do not make tests call a government service.
- Verify duplicate names and contact details are accepted, and that the directory searches names/email/phone but not tax identifiers.
- Verify active-by-default listing, type/status filters, archive preservation, archived-list access, and restore behavior.
- Verify mutation forms include CSRF protection, validation feedback is accessible, authenticated pages are `noindex`, and page titles/descriptions are appropriate.
- Review responsive behavior manually at desktop and mobile widths; do not add browser automation for this feature.

## Out of Scope

- Client accounts, logins, invitations, or any Client-facing app access.
- User-specific Client books, workspace membership, roles, permissions, or a team-management feature. The confirmed behavior is one global book visible to every authenticated User.
- Accounts, transactions, ledgers, budgets, invoices, payments, tax calculations, tax filing, or compliance workflows.
- More than one tax identifier per Client, including multiple State/UT GSTINs or simultaneous tax IDs from different countries.
- Government validation or lookup of GSTIN/UIN or other tax identifiers.
- Separate PAN, GST registration category, business constitution, or explicit registered/unregistered status.
- Registration-specific, delivery, or multiple billing addresses; transaction-specific place of supply.
- Multiple email addresses, phone numbers, primary contacts, billing addresses, or currencies per Client.
- Foreign-exchange rates or currency conversion.
- Fixed industry categories, suggested industry lists, custom fields, notes, or a business website field.
- Permanent deletion or detailed Client audit history.
- Client search by tax identifier or advanced directory filtering/sorting.

## Further Notes

- The global shared-book decision is consequential: the app currently supports self-service User registration, and every authenticated User will be able to read and edit the same Client PII and tax identifiers. This was explicitly confirmed after explaining that implication. Do not silently change it to per-User ownership or add an unrequested workspace model.
- India GST rules prescribe invoice particulars rather than a universal Client-profile schema. The profile is a convenience record, not evidence of compliance. A GST invoice’s required recipient data varies by case; State/UT-specific registrations can require more than one GSTIN for a business. The one-identifier limit above is an intentional product limitation, not a representation that a Client has only one legal registration. See [CBIC CGST Rule 46](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html), [CGST Act §25](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section25_v1.00.html), and [CGST Rule 11](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter3/rule11_v1.00.html).
- Preserve the existing authenticated User and Session semantics. A Client remains a separate domain record and does not participate in authentication.
