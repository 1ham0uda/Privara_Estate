# Privara Estate Audit and Remediation Summary

## Translation audit
Completed a targeted audit across the current UI and fixed the most visible untranslated/shared surfaces:
- Reworked the landing page to use translation keys instead of hardcoded English.
- Renamed the application brand to **Privara Estate** across shared entry points.
- Added missing translation keys that were already referenced in code but not defined.
- Localized the profile page and 404 page.
- Localized the Add Staff modal shared UI.
- Kept the support workflow labels aligned with the updated ticket UX.

Notes:
- Dynamic data stored inside Firestore, such as user-generated case notes, ticket text, and consultant bios, remains language-dependent by nature and is not auto-translated.
- Some legacy admin/client page strings may still deserve a second pass if you later want pixel-perfect wording consistency everywhere.

## Firestore/Storage rules audit
Adjusted rules to reduce over-permission while keeping required flows working:
- Tightened `supportMessages` so ticket creation must start open and empty.
- Prevented users from changing support ticket ownership or closed-state metadata.
- Restricted end-user support updates to replies and timestamps only.
- Preserved admin ability to reply and close tickets.
- Kept settings readable for authenticated users because the client payment flow depends on system consultation fee.
- Expanded meeting storage rule to allow audio or video uploads for review flows.

## Responsive/mobile audit
Applied global compactness improvements aimed at mobile:
- Reduced shared card padding.
- Reduced shared button and input sizing.
- Added smaller base text sizing on mobile.
- Reduced large heading scale on small screens.
- Rebuilt the landing page with a smaller and more mobile-friendly layout.
- Reduced navbar height and overall header density.

## Remaining recommended follow-up
- A second pass on all role dashboards to standardize card heights and table density further.
- Firestore rules unit tests with the Emulator Suite before production deployment.
- A final build and manual smoke test after deployment of updated rules and indexes.
