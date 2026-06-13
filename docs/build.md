# Expo Development Server & EAS Build Guide

This document covers running the Expo development server and troubleshooting client connection issues.

---

## 🚀 Running the Development Server

If your mobile device is on a different Wi-Fi subnet, on a guest network with client isolation, or restricted by the Windows Firewall, run the Metro server in **Tunnel Mode**. This routes traffic over a secure HTTPS tunnel.

### Command:
```powershell
npx expo start --dev-client --tunnel
```

---

## 🛡️ Troubleshooting Local Connection (HTTP / Cleartext)

By default, Android 9+ blocks unencrypted HTTP traffic (`cleartext`) for apps. This means your Development Client APK might fail to connect to your local computer's IP address (e.g., `http://192.168.31.16:8081`) even if the address works in your phone's browser.

### The Fix:
We configured the project to explicitly allow cleartext traffic in `app.json` under `expo-build-properties`:

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

### ⚠️ Note for Next Build:
Because this is a native Android configuration change, **it will only take effect on your phone after you trigger a new EAS build**:
```powershell
npm run build:android
```
Once the new APK is built and installed on your phone, you will be able to connect locally (without the `--tunnel` flag) when on the same Wi-Fi.
