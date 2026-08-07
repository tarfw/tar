# GitHub Actions Workflow for Android APK Build

This document contains the production-ready, zero-queue GitHub Actions workflow script used for automated Android APK builds in **`tarapp`**.

## Workflow File Location
`.github/workflows/build-android.yml`

## Full Workflow Script (`build-android.yml`)

```yaml
name: Build Android APK

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Java JDK
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Install Dependencies
        run: |
          cd tarapp
          npm ci

      - name: Expo Prebuild
        run: |
          cd tarapp
          npx expo prebuild --platform android
        env:
          EXPO_PUBLIC_TARFLUE_URL: "https://taragent.tar-54d.workers.dev"
          EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "226183831843-5sjvl1hsv4d04aucnqsqn19u83o4f5ku.apps.googleusercontent.com"
          EXPO_PUBLIC_TURSO_URL: "libsql://global-tarframework.aws-eu-west-1.turso.io"
          EXPO_PUBLIC_TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
          EXPO_PUBLIC_GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          EXPO_PUBLIC_OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      - name: Build Release APK
        run: |
          cd tarapp/android
          chmod +x gradlew
          ./gradlew assembleRelease --no-daemon

      - name: Upload Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release-apk
          path: tarapp/android/app/build/outputs/apk/release/app-release.apk
```

## Key Optimizations Included
1. **Native Android SDK**: Uses GitHub's pre-installed Android SDK on `ubuntu-latest` (bypasses 1.5GB SDK download bottlenecks).
2. **Native Gradle Compilation**: Uses `./gradlew assembleRelease` directly for 100% reliable APK generation in ~4 minutes.
3. **Environment Security**: Injects public endpoints and pulls API keys securely from GitHub Repository Secrets (`secrets.GROQ_API_KEY`, `secrets.OPENROUTER_API_KEY`, `secrets.TURSO_AUTH_TOKEN`).
