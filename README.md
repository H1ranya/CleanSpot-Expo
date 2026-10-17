# CleanSpot 🌿

> Offline-first user waste reporting platform for illegal dumping and overflowing bins.

---

## Firebase Configuration & Setup

CleanSpot uses **Firebase Anonymous Authentication** to ensure privacy-first user participation without requiring email/password or registration screens.

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it (e.g. `cleanspot-app`).
3. (Optional) Disable Google Analytics for simplicity.

### 2. Enable Anonymous Authentication

1. In your Firebase Project console, navigate to **Build > Authentication**.
2. Click **Get Started** if Authentication is not yet activated.
3. In the **Sign-in method** tab, select **Anonymous**.
4. Toggle **Enable** and click **Save**.

### 3. Obtain Firebase Web Configuration

1. In the Firebase Project Settings (**Project Overview > Project Settings**):
2. Under the **General** tab, scroll to **Your apps** and click the **Web (</>)** icon to register a web app.
3. Name your app (e.g., `CleanSpot Mobile`).
4. Copy the configuration credentials provided:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### 4. Configure Environment Variables

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

Populate `.env` with your Firebase project values:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef...
```

> **Security Note:** `.env` is listed in `.gitignore` and must never be committed to version control.

---

## Authentication Lifecycle & Persistence

1. **Application Startup (`App.tsx`):**
   - The `useAuth` hook executes on app boot.
   - It checks whether an anonymous session exists in `@react-native-async-storage/async-storage` via `getReactNativePersistence`.
   - If a valid anonymous user exists from a previous session, the session is restored instantly with the same UID (avoiding duplicate user identities).
   - If no session exists, it calls `signInAnonymously()` to provision a new anonymous identity.

2. **Accessing Auth State:**
   - In UI screens, use the `useAuth()` hook:
     ```tsx
     const { user, userId, isAuthenticated, isLoading } = useAuth();
     ```
   - In services/domain logic, use `authService.getCurrentUserId()`.

---

## Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android
```
