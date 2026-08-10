# Google Sign-In — Simple Guide (for non-developers)

## What is a SHA-1 key?

Think of it like a **fingerprint** for your app. Every app file (APK/AAB) has a unique
SHA-1 fingerprint that proves who created it.

## What is "signing"?

When you build an app, it must be **signed** (stamped with a fingerprint) before it can
be installed on a phone. This proves the app is really from you, not from a hacker.

You have **two** signing keys:

| Key | Who uses it | When |
|---|---|---|
| **Upload key** | You | Before uploading to Play Console |
| **App signing key** | Play Console | After upload — Play re-signs your app |

**Why two?** Play Console re-signs your app with its own key for security. So the app
on the user's phone always has the **app signing key** fingerprint.

## The problem we faced

1. EAS built the app signed with the **upload key** → worked fine
2. We uploaded to Play Console → Play Console re-signed with **app signing key**
3. The app on the phone now had a **different fingerprint**
4. Google Cloud Console didn't recognize the new fingerprint
5. Result: `DEVELOPER_ERROR (10)` — sign-in failed

## The fix

We told Google Cloud Console about the new fingerprint by adding a second Android
client (`tar android play`) with the app signing key SHA-1.

Then updated `app.json` to point to this new client:

```json
"androidClientId": "226183831843-fni58uld63t1ghdvvafssc88l6v632u5.apps.googleusercontent.com"
```

Rebuilt the app → sign-in worked.

---

## Where each SHA-1 lives

| Service | Upload key SHA-1 | App signing key SHA-1 |
|---|---|---|
| **Play Console** | `A9:9C:8A:83:DE:9A:B4:CB:06:49:0F:7A:DE:62:C9:6B:FF:DA:95:99` | `3F:5A:31:41:A0:4E:E4:12:1F:A1:6D:94:EA:36:92:4D:B8:0C:32:D5` |
| **Google Cloud — `tar android`** | `A9:9C:8A:83:DE:9A:B4:CB:06:49:0F:7A:DE:62:C9:6B:FF:DA:95:99` | — |
| **Google Cloud — `tar android play`** | — | `3F:5A:31:41:A0:4E:E4:12:1F:A1:6D:94:EA:36:92:4D:B8:0C:32:D5` |
| **Firebase** | `A9:9C:8A:83:DE:9A:B4:CB:06:49:0F:7A:DE:62:C9:6B:FF:DA:95:99` | `3F:5A:31:41:A0:4E:E4:12:1F:A1:6D:94:EA:36:92:4D:B8:0C:32:D5` |
| **Expo EAS** | Stored in keystore | — |

## OAuth clients

You need **three** clients in Google Cloud Console:

| Client | Type | Purpose |
|---|---|---|
| `tar android` | Android | For upload key (local dev builds) |
| `tar android play` | Android | For app signing key (Play Store builds) |
| Web client | Web | The `webClientId` used in code |

**Important:** The `androidClientId` in `app.json` must match the client whose SHA-1
matches the app currently installed on the phone.

## Firebase

Firebase needs **both** SHA-1 fingerprints registered — otherwise Firebase services
(Crashlytics, Analytics) won't work on the Play Store version.

## Checklist

- [x] Upload key SHA-1 → Google Cloud `tar android` client
- [x] App signing key SHA-1 → Google Cloud `tar android play` client
- [x] Both SHA-1s → Firebase project settings
- [x] `app.json` → `androidClientId` points to correct client
- [x] Consent screen → Published to Production
- [x] Rebuild app after any change
