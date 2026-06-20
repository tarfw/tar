# Google Auth Setup — @tarai/

Complete setup guide for Google Sign-In in the tarai Expo project.

---

## Architecture Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  App Launch  │────▶│  Check SecureStore │────▶│  Silent Sign-In?    │
└─────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          │ YES                         │ NO
                                          ▼                             ▼
                                   ┌─────────────┐            ┌─────────────────┐
                                   │  Restore JWT │            │  Show Auth Screen│
                                   └──────┬──────┘            └────────┬────────┘
                                          │                           │
                                          ▼                           ▼
                                   ┌─────────────┐        ┌──────────────────────┐
                                   │   /home     │        │  Google Sign-In SDK   │
                                   └─────────────┘        └──────────┬───────────┘
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │  Get Google idToken  │
                                                          └──────────┬──────────┘
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │  POST /api/auth      │
                                                          │  (Cloudflare Worker) │
                                                          └──────────┬──────────┘
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │  Receive custom JWT  │
                                                          │  Store in SecureStore │
                                                          └──────────┬──────────┘
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │    Navigate /home    │
                                                          └─────────────────────┘
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| Google Cloud Project | [console.cloud.google.com](https://console.cloud.google.com) |
| Firebase Project | [console.firebase.google.com](https://console.firebase.google.com) (linked to same GCP project) |
| Expo SDK | 56+ |
| EAS CLI | `npm install -g eas-cli` |
| Package Name | `com.tarai.app` |

---

## Step 1: Google Cloud Console — OAuth Clients

Navigate to **APIs & Services → Credentials**.

Create three clients:

| Client | Type | Package / Bundle | Purpose |
|---|---|---|---|
| tarai android | Android | `com.tarai.app` | Android Sign-In |
| tarai android play | Android | `com.tarai.app` | Play Store builds (if signing differs) |
| tarai web | Web application | — | JWT exchange + iOS fallback |

### Android Client Config

| Field | Value |
|---|---|
| Name | `tarai android` |
| Package name | `com.tarai.app` |
| SHA-1 certificate fingerprint | From `eas credentials` → Keystore → Show details |

### Web Client Config

| Field | Value |
|---|---|
| Name | `tarai web` |
| Authorized redirect URIs | `https://tar-sync.tar-54d.workers.dev/api/auth` |

Copy the **Web Client ID** — used in all config files.

---

## Step 2: Firebase Console — google-services.json

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select project: `tarframework-35ar`
3. Click **+ Add app** → **Android**
4. Register app:
   - Android package name: `com.tarai.app`
   - App nickname: `tarai`
   - SHA-1: same value from Step 1
5. Download `google-services.json`
6. Place at project root: `C:\tarfwk\tar\tarai\google-services.json`

### Verify google-services.json

```json
{
  "project_info": {
    "project_number": "291840005173",
    "project_id": "tarframework-35ar",
    "storage_bucket": "tarframework-35ar.appspot.com"
  },
  "client": [{
    "client_info": {
      "mobilesdk_app_id": "1:291840005173:android:...",
      "android_client_info": {
        "package_name": "com.tarai.app"
      }
    },
    "oauth_client": [{
      "client_id": "291840005173-....apps.googleusercontent.com",
      "client_type": 3
    }]
  }]
}
```

---

## Step 3: Project Config Files

### app.json — Google Sign-In Plugin

```json
{
  "expo": {
    "android": {
      "package": "com.tarai.app",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      [
        "@react-native-google-signin/google-signin",
        {
          "androidClientId": "291840005173-XXXXXXXX.apps.googleusercontent.com",
          "iosUrlScheme": "com.googleusercontent.apps.291840005173-ggf8...",
          "webClientId": "291840005173-ggf8...apps.googleusercontent.com",
          "scopes": ["profile", "email"]
        }
      ]
    ]
  }
}
```

| Field | Source |
|---|---|
| `androidClientId` | Android OAuth client from Google Cloud Console |
| `webClientId` | Web OAuth client from Google Cloud Console |
| `iosUrlScheme` | `com.googleusercontent.apps.<WEB_CLIENT_ID>` |

### .env

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=291840005173-ggf8...apps.googleusercontent.com
EXPO_PUBLIC_TAR_SYNC_URL=https://tar-sync.tar-54d.workers.dev
```

### eas.json — Build Profiles

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "291840005173-ggf8...apps.googleusercontent.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "291840005173-ggf8...apps.googleusercontent.com"
      }
    }
  }
}
```

---

## Step 4: SHA-1 Verification

Critical — Android Sign-In fails if SHA-1 doesn't match.

```bash
# Get SHA-1 from EAS-managed keystore
eas credentials
# → Select Android → Keystore → Show details → copy SHA-1
```

| Location | SHA-1 Value |
|---|---|
| EAS Keystore | `eas credentials` → Show details |
| Google Cloud Console | OAuth client → Edit → SHA-1 fingerprint |
| Firebase Console | Project Settings → Your Android app → SHA-1 |

All three must match.

---

## Step 5: EAS Build

### Cloud Build (Recommended)

No `expo prebuild` needed — EAS handles it automatically on their servers.

```bash
eas build --profile development --platform android
```

### Local Build (Alternative)

Only needed if you want to test native code locally without EAS.

```bash
npx expo prebuild --clean
npx expo run:android
```

### EAS Build Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  eas build        │────▶│  Upload JS bundle │────▶│  EAS Cloud Server│
│  (your machine)   │     │  + app.json       │     │                  │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                            │
                                                            ▼
                                                  ┌──────────────────┐
                                                  │  expo prebuild   │
                                                  │  (auto on cloud) │
                                                  └────────┬─────────┘
                                                            │
                                                            ▼
                                                  ┌──────────────────┐
                                                  │  Native build    │
                                                  │  (Gradle/Xcode)  │
                                                  └────────┬─────────┘
                                                            │
                                                            ▼
                                                  ┌──────────────────┐
                                                  │  APK/IPA output  │
                                                  │  → Download link  │
                                                  └──────────────────┘
```

### EAS Build Profiles

| Profile | Command | Purpose | Distribution |
|---|---|---|---|
| `development` | `eas build --profile development` | Dev client with debugger | Internal (APK) |
| `preview` | `eas build --profile preview` | Testing builds | Internal (APK) |
| `production` | `eas build --profile production` | Store release | Store (AAB) |

### EAS Credentials

| Command | Purpose |
|---|---|
| `eas credentials` | Manage keystores, certificates, push keys |
| `eas build:list` | View build history and download artifacts |
| `eas build:configure` | Set up `eas.json` for the project |

### Build Outputs

| Platform | Output | Install |
|---|---|---|
| Android (APK) | `.apk` file | `adb install app.apk` |
| Android (AAB) | `.aab` file | Upload to Play Console |
| iOS | `.ipa` file | TestFlight or Xcode |

---

## Auth Flow — Runtime

### 1. Sign In

```typescript
import { signInWithGoogle } from '@/lib/auth';

const profile = await signInWithGoogle();
// → Returns { id, name, email, photo, idToken }
// → Stores profile in SecureStore
// → Exchanges idToken for JWT via Cloudflare Worker
// → Stores JWT in SecureStore
```

### 2. Session Restore

```typescript
import { getCurrentUser } from '@/lib/auth';

const user = await getCurrentUser();
// → Checks SecureStore first (fast)
// → Falls back to GoogleSignin.signInSilently()
// → Returns null if no session
```

### 3. Sign Out

```typescript
import { signOutGoogle } from '@/lib/auth';

await signOutGoogle();
// → GoogleSignin.signOut()
// → Clears SecureStore (user + JWT)
```

### 4. Get JWT (for API calls / WebSocket)

```typescript
import { getJwt } from '@/lib/auth';

const token = await getJwt();
// → Returns stored JWT or null
```

---

## SecureStore Keys

| Key | Value | Purpose |
|---|---|---|
| `google_auth_user` | `{ id, name, email, photo, idToken }` | User profile JSON |
| `sync_jwt` | `eyJhbGciOi...` | Custom JWT for Worker API |

---

## Error Codes

| Error | Meaning | Fix |
|---|---|---|
| `SIGN_IN_CANCELLED` | User pressed back | Normal — no action needed |
| `IN_PROGRESS` | Double tap | Debounce button press |
| `PLAY_SERVICES_NOT_AVAILABLE` | No Google Play | Install Play Services |
| `idp_response_error` | SHA-1 mismatch | Verify SHA-1 in Google Cloud Console |
| `12500` | Generic auth error | Check client IDs + SHA-1 |
| JWT exchange failed | Worker unreachable | Check `EXPO_PUBLIC_TAR_SYNC_URL` |

---

## File Reference

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | Sign-in, sign-out, session, JWT exchange |
| `src/app/auth.tsx` | Auth screen UI (Continue with Google button) |
| `src/app/settings.tsx` | Sign-out button, user profile display |
| `src/app/_layout.tsx` | Checks session on launch |
| `app.json` | Google Sign-In plugin config |
| `.env` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| `eas.json` | Build-time env vars |
| `google-services.json` | Firebase/Android config |
