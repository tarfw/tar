# 08 — Build & Ops

Running the Expo dev server and EAS builds for `tarapp`.

---

## 1. Dev server

If your phone is on a different Wi-Fi subnet, a guest network with client isolation, or blocked by Windows Firewall, run Metro in **Tunnel Mode** (secure HTTPS tunnel):

```powershell
npx expo start --dev-client --tunnel
```

---

## 2. Cleartext HTTP fix (Android 9+)

Android 9+ blocks unencrypted HTTP, so the dev-client APK may fail to reach `http://192.168.x.x:8081` even when the browser can. Fixed in `app.json` under `expo-build-properties`:

```json
[
  "expo-build-properties",
  {
    "android": {
      "minSdkVersion": 24,
      "usesCleartextTraffic": true,
      "extraMavenRepos": [
        "https://oss.sonatype.org/content/repositories/snapshots"
      ]
    }
  }
]
```

---

## 3. Applying native config

This is a **native** change — it only takes effect after a new EAS build:

```powershell
npm run build:android
```

Once the new APK is installed, you can connect locally (no `--tunnel`) on the same Wi-Fi.
