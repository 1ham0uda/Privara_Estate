# Privara Estate

Privacy-first real estate consultation platform built with Next.js, Firebase Auth, Firestore, and Storage.

## What was cleaned up
- Removed direct dependency on the old Google AI Studio Firebase project.
- Moved Firebase client setup to environment variables.
- Replaced the old Firestore database id usage with the default Firestore database.
- Made Firebase Admin SDK setup explicit for local development and deployment.
- Fixed empty Next.js/TypeScript config files.
- Unified animation imports to `motion/react`.
- Removed hardcoded admin email shortcuts from the security rules so admin access is controlled by the `users/{uid}.role` document.

## Stack
- Next.js 15 (App Router)
- React 19
- TypeScript
- Firebase Auth / Firestore / Storage
- Firebase Admin SDK for privileged server routes
- Tailwind CSS
- Motion

## Required environment variables
Create a `.env.local` file in the project root using `.env.example` as the template.

### Firebase Web SDK
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Firebase Admin SDK (pick one)
Option 1:
```env
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccountKey.json
```

Option 2:
```env
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Local development
Install dependencies:
```bash
npm install
```

Run the app:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## Firebase setup checklist
1. Create or choose your Firebase project.
2. Add a Web App and copy its config into `.env.local`.
3. Enable Authentication and the providers you need.
4. Create Firestore database in `(default)` mode.
5. Enable Firebase Storage.
6. Deploy the provided `firestore.rules` and `storage.rules` to your Firebase project.
7. Create at least one user, then change their Firestore `users/{uid}.role` to `admin` if you need admin access.
8. If you want `/api/admin/create-staff` to work locally or in production, configure the Firebase Admin SDK env vars.

## Notes
- The project now assumes the default Firestore database instead of the old AI Studio-specific database id.
- Server routes that use Firebase Admin SDK will fail until you configure admin credentials.
- The included payment flow is still a mock flow and not a real payment gateway integration.
