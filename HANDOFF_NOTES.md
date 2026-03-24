# Handoff Notes

## Changes applied
- Removed dependency on `firebase-applet-config.json` and switched Firebase client setup to `.env.local` / `.env.example`.
- Updated `src/lib/firebase.ts` to initialize Firebase from `NEXT_PUBLIC_FIREBASE_*` variables.
- Replaced explicit Firestore database id usage with the default Firestore database.
- Fixed empty `tsconfig.json` and `next-env.d.ts` files.
- Reworked Firebase Admin SDK setup so server routes use explicit env-based credentials or `GOOGLE_APPLICATION_CREDENTIALS`.
- Updated `src/app/api/admin/create-staff/route.ts` to initialize Admin SDK lazily at request time.
- Updated `storage.rules` to use `/databases/(default)/documents/...` instead of the old AI Studio database id.
- Removed hardcoded admin-email shortcuts from `firestore.rules`, `storage.rules`, login, and register flows.
- Unified animation imports to `motion/react`.
- Removed stale AI Studio files: `firebase-applet-config.json`, `firebase-blueprint.json`, `metadata.json`.
- Updated `README.md` and `.env.example` with the new setup instructions.

## Important note
- I could not run a real build in this environment because project dependencies were not installed here (`next` binary was unavailable). You should run `npm install` and then `npm run build` on your machine after adding your real environment variables.


## Additional fixes
- Removed duplicate translation keys from `src/context/LanguageContext.tsx` that were breaking TypeScript builds.
- Updated project module/config files for Firebase App Hosting compatibility.
