# Google Sign-In on Expo + EAS (Android) — End-to-End Manual

A reusable runbook for wiring native Google Sign-In into an Expo app and shipping a
working APK via EAS. Written from a real migration; every command here was executed
and verified.

**Scope:** Expo SDK 56, `@react-native-google-signin/google-signin` v16, EAS Build,
Android internal distribution, personal (non-Workspace) Google account.

---

## 0. Mental model — read this first

Four separate systems must agree. Almost every failure is two of them disagreeing.

| System | Holds | Identified by |
|---|---|---|
| **Google Cloud / Firebase** | OAuth clients, consent screen | project number, e.g. `226183831843` |
| **EAS** | Release keystore | project id, e.g. `efb1d63a-…` |
| **App config** | client IDs, package name | `app.json` |
| **The APK** | compiled bundle | signed by the keystore |

The load-bearing link: **Google's Android OAuth client stores a
`package_name` + `certificate_hash` pair.** At sign-in, Google checks the calling
APK's actual signature against that hash. Mismatch → `DEVELOPER_ERROR (10)`.

The SHA-1 comes from **EAS**. It gets registered in **Google Cloud**. Those are
frequently two different accounts — see §1.

### Web vs Android client (the most common confusion)

You need **both**, and they do different jobs:

- **Web client (`client_type: 3`)** — this is your `webClientId` in code. It is what
  mints the ID token. Required on Android. Yes, really.
- **Android client (`client_type: 1`)** — **never referenced in your JS**. Google
  matches it implicitly via package name + SHA-1. Its only job is to authorize your
  APK's signature.

> Putting the Android client ID in `webClientId` is a classic error and yields
> `DEVELOPER_ERROR (10)` with no useful message.

**No client secret is needed.** Native sign-in uses the ID-token flow. A secret is
only for server-side code exchange — never ship one in an app.

---

## 1. Preconditions

Confirm all of these before touching anything.

```bash
# Which Google account owns Cloud/Firebase
gcloud auth list

# Which Expo account owns the keystore
npx eas-cli whoami

# The EAS project actually linked to this directory
npx eas-cli project:info
```

**These two accounts do not have to match, and often shouldn't.** Record which is
which before you start — the SHA-1 crosses from one to the other, and it is easy to
create the OAuth client in the wrong account and lose an hour.

Also verify:
- `app.json` has `expo.android.package` set (this is permanent — changing it later
  invalidates every OAuth client and the keystore binding).
- `expo.owner` and `extra.eas.projectId` match the EAS account you're logged into.

### gcloud not on PATH (Windows)

Installed but invisible to a bash shell. Do not reinstall:

```bash
export PATH="$PATH:/c/Users/<USER>/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
gcloud version
```

---

## 2. Diagnose before changing anything

### Is the Cloud project alive?

The failure that motivated this manual: the Firebase project had been **deleted**,
which silently broke sign-in and builds.

```bash
gcloud projects list
gcloud projects describe <PROJECT_ID>
```

Look at `lifecycleState`. `DELETE_REQUESTED` means dead — every client ID under it is
expiring. A deleted project also vanishes from `projects list` while still being
resolvable by `describe`, so **`list` alone is not a sufficient check**.

### The quota-project header (required for all Firebase REST calls)

Every `firebase.googleapis.com` call with user credentials needs
`X-Goog-User-Project` or it returns a confusing 403 about a "quota project":

```bash
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "X-Goog-User-Project: <PROJECT_ID>" \
     "https://firebase.googleapis.com/v1beta1/projects/<PROJECT_ID>/androidApps"
```

That 403 is **not** a permissions problem. Adding the header fixes it.

### Read current OAuth state (the ground truth)

```bash
APP="<mobilesdk_app_id>"   # e.g. 1:226183831843:android:7ac6…
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: <PROJECT_ID>" \
  "https://firebase.googleapis.com/v1beta1/projects/<PROJECT_ID>/androidApps/$APP/config" \
| python -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['configFileContents']).decode())"
```

`"oauth_client": []` means **no OAuth clients exist** — sign-in cannot work yet,
regardless of what your `app.json` says. This single command is the fastest way to
know where you stand.

---

## 3. Get the keystore SHA-1 from EAS

`eas credentials` is **interactive** and will hang in a non-interactive shell.
`--non-interactive` is not a supported flag. Query the GraphQL API instead:

```bash
SECRET=$(python -c "import json,os;print(json.load(open(os.path.expanduser('~/.expo/state.json')))['auth']['sessionSecret'])")

curl -s -X POST "https://api.expo.dev/graphql" \
  -H "Content-Type: application/json" -H "expo-session: $SECRET" \
  -d '{"query":"query { app { byId(appId: \"<EAS_PROJECT_ID>\") { androidAppCredentials { applicationIdentifier androidAppBuildCredentialsList { isDefault androidKeystore { keyAlias sha1CertificateFingerprint sha256CertificateFingerprint } } } } } }"}' \
| python -m json.tool
```

Check `applicationIdentifier` matches your package name.

**If no keystore exists yet,** run any build once (`eas build -p android --profile
preview`) — EAS generates one automatically — then re-query. You do **not** need that
first build to succeed at the Gradle stage; the keystore is created during setup.

---

## 4. Register the SHA fingerprints (scriptable)

This part **is** automatable. Both certs, via the Firebase API:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: <PROJECT_ID>" -H "Content-Type: application/json" \
  -d '{"shaHash":"<sha1-raw-hex>","certType":"SHA_1"}' \
  "https://firebase.googleapis.com/v1beta1/projects/<PROJECT_ID>/androidApps/$APP/sha"
```

Repeat with `"certType":"SHA_256"`. Verify with `GET` on the same URL.

Register SHA-256 too — Play App Signing needs it later, and it costs nothing now.

> **The API accepts raw hex. The web console requires colons.** Same value, two
> formats. See §5.

---

## 5. Create OAuth clients — console only, no way around it

**There is no public API for creating OAuth 2.0 clients or the consent screen.**
This was verified exhaustively, not assumed:

| Attempt | Result |
|---|---|
| `gcloud services enable iap.googleapis.com` | succeeded — so not a permissions issue |
| `POST iap.googleapis.com/v1/projects/N/brands` | `400 Project must belong to an organization` |
| `POST oauth2.googleapis.com/v1/projects/…/clients` | `404` — no such endpoint |
| `clientauthconfig.googleapis.com` | `404` — no such endpoint |
| Identity Toolkit `defaultSupportedIdpConfigs` | `400 client_id cannot be empty` — consumes, can't mint |

The IAP brands API only creates **internal-only** brands, which are undefined without
a Workspace organization — so a personal `@gmail.com` project can never use it. Google
documents the console as the supported path for projects outside an organization. The
`oauth-brands` surface is also deprecated.

Holding `roles/owner` with full `cloud-platform` scope does **not** change this.
Don't burn time trying.

### Format the SHA-1 for the console

The console rejects raw hex with *"Invalid SHA-1 certificate fingerprint."*

```bash
python -c "h='<sha1-raw-hex>';print(':'.join(h[i:i+2] for i in range(0,len(h),2)).upper())"
# a99c8a…  ->  A9:9C:8A:83:DE:9A:B4:CB:06:49:0F:7A:DE:62:C9:6B:FF:DA:95:99
```

Must be 20 bytes / 40 hex chars. Colons mandatory; case irrelevant.

### Console steps

Note the console **moved** — it is now *Google Auth platform → Clients*, not the
*APIs & Services → Credentials* path most older docs describe.

**1. Consent screen** (must exist before clients can be created)
`https://console.cloud.google.com/auth/overview?project=<PROJECT_ID>`
- User type **External** (Internal requires an organization)
- App name, support email, developer contact
- Leave scopes empty — `profile`/`email`/`openid` are non-sensitive defaults

**2. Android client** — *Create client* → **Android**
- Package name: exactly `expo.android.package`
- SHA-1: the colon-separated string

**3. Web client** — *Create client* → **Web application**
- Leave *Authorized redirect URIs* **empty** — this client only mints ID tokens for
  native sign-in; it never performs a browser redirect
- Copy the Client ID → this is your `webClientId`

**4. Publish to Production**
`https://console.cloud.google.com/auth/audience?project=<PROJECT_ID>` → *Publish app*

**Do not skip this.** In Testing mode only listed test users can sign in (max 100);
everyone else gets `access_denied`, which surfaces in-app as the same
`DEVELOPER_ERROR (10)`.

With only `profile`/`email`/`openid`, publishing is **instant — no verification
review**, since verification is mandatory only for sensitive/restricted scopes.

Two traps:
- **Don't upload a logo or custom app name** — that triggers "brand verification," a
  review you'd otherwise skip entirely.
- Testing mode normally expires refresh tokens after 7 days, but there is an explicit
  carve-out when scopes are a subset of `openid`/`userinfo.email`/`userinfo.profile`.
  So the *real* reason to publish is the 100-user cap, not token expiry.

---

## 6. Pull `google-services.json`

Never hand-edit it. Re-download after creating the clients — `oauth_client` will now
be populated:

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: <PROJECT_ID>" \
  "https://firebase.googleapis.com/v1beta1/projects/<PROJECT_ID>/androidApps/$APP/config" \
| python -c "import sys,json,base64; open('google-services.json','w',newline='\n').write(base64.b64decode(json.load(sys.stdin)['configFileContents']).decode())"
```

**Acceptance check** — the file must show all three:
1. `package_name` == your `expo.android.package`
2. an entry with `client_type: 1` whose `certificate_hash` == your EAS SHA-1
3. an entry with `client_type: 3` (web)

If `certificate_hash` doesn't match the EAS keystore, sign-in **will** fail. Stop and
fix it here rather than debugging on-device.

---

## 7. Update app config

### `app.json`

```jsonc
"android": {
  "package": "com.example.app",
  "googleServicesFile": "./google-services.json"
},
"plugins": [
  ["@react-native-google-signin/google-signin", {
    "androidClientId": "<N>-<android>.apps.googleusercontent.com",
    "iosUrlScheme": "com.googleusercontent.apps.<N>-<web>",
    "webClientId":  "<N>-<web>.apps.googleusercontent.com",
    "scopes": ["profile", "email"]
  }]
]
```

`iosUrlScheme` is the **web** client ID, reversed — not the Android one.

> **Plugin behaviour worth knowing:** passing an options object selects the
> *without-Firebase* path, which only touches iOS and ignores `google-services.json`.
> Passing no options selects the Firebase path, which applies the Gradle
> `google-services` plugin. Providing `googleServicesFile` **and** options gives you
> both: Firebase config for Android, explicit IDs for JS.

### Verify the config actually resolves

```bash
npx expo config --type public | grep -iE "package|googleServices|ClientId|iosUrlScheme"
```

This catches JSON typos before a 30-minute build does.

### Find every stale client ID

Client IDs leak into more places than you expect. This one command prevents a broken
CI pipeline:

```bash
grep -rn "<OLD_PROJECT_NUMBER>" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.expo
```

Check all of: `app.json`, `eas.json` (**every** build profile), `.env`,
`src/lib/auth.ts` (hardcoded fallbacks), `.github/workflows/*.yml`, and docs.

In the real migration, the GitHub Actions workflow still carried the dead ID and would
have silently produced broken CI builds long after the local app worked.

---

## 8. EAS environment variables

`.env` is gitignored and **never uploaded**. Anything referenced at build time must
exist in `eas.json`'s `env` block or in EAS remote environment variables, or it will
be `undefined` in the APK.

```bash
npx eas-cli env:list --environment preview
```

Set missing ones (`env:create` is deprecated — use `env:set`, which upserts; there is
no `--force` flag):

```bash
npx eas-cli env:set --name EXPO_PUBLIC_FOO --value "…" \
  --visibility sensitive --environment preview --environment production \
  --scope project --non-interactive
```

### `EXPO_PUBLIC_` is not secret — this matters

EAS **rejects** `--visibility secret` for `EXPO_PUBLIC_*` variables, and it is right
to: these are **inlined as plain text into the JS bundle** and are readable by anyone
who unzips the APK. `sensitive` only hides the value in the EAS dashboard and CLI; it
does nothing for the shipped binary.

Practical stance: acceptable for a trusted internal test build; **rotate every such
key before any public release**, and proxy genuinely sensitive credentials (database
tokens especially) through a backend instead of embedding them.

---

## 9. Build

EAS builds from a **git commit**, not your working tree. Uncommitted fixes will not be
in the APK — this is the single most common "I fixed it but it still fails."

```bash
git add app.json google-services.json eas.json src/lib/auth.ts .github/workflows/*.yml
git commit -m "Configure Google Sign-In"
npx eas-cli build --platform android --profile preview
```

Profile for a sideloadable APK:

```jsonc
"preview": { "distribution": "internal", "android": { "buildType": "apk" } }
```

`buildType: apk` → installable directly. `app-bundle` → AAB, Play Store only, cannot
be sideloaded.

Confirm the build used the right commit:

```bash
npx eas-cli build:list --platform android --limit 1 --non-interactive
```

### Distribution limits

- **Android APK: unlimited installs.** `distribution: internal` means "not via Play
  Store," *not* a headcount cap. The widely-cited 100-device limit is **iOS ad-hoc
  provisioning** and has no Android equivalent.
- **Sign-in users: unlimited once published to Production.** The 100-user cap applies
  only to Testing mode.
- The artifact URL is public and unauthenticated — anyone it's forwarded to can
  download it.

---

## 10. Verification

Type-check and lint before building; compare error counts to a known baseline rather
than expecting zero, so pre-existing noise doesn't mask a real regression:

```bash
npx tsc --noEmit          # expect exit 0
npx expo lint             # compare count to baseline
```

**Config correctness cannot be proven without installing.** Everything above can be
green while sign-in still fails. Install the APK and complete one real sign-in before
distributing.

---

## 11. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Gradle: `No matching client found for package name` | `google-services.json` `package_name` ≠ `expo.android.package` | Re-download for the correct app (§6) |
| `DEVELOPER_ERROR (10)` | SHA-1/package pair not registered, or wrong keystore | Compare EAS SHA-1 (§3) to `certificate_hash` (§6) |
| `DEVELOPER_ERROR (10)`, config correct | Consent screen still in Testing | Publish to Production (§5) |
| `DEVELOPER_ERROR (10)`, all above correct | `webClientId` holds the **Android** client ID | Use the `client_type: 3` ID |
| Console: `Invalid SHA-1 certificate fingerprint` | Raw hex pasted | Colon-separate it (§5) |
| Firebase REST `403` quota project | Missing header | Add `X-Goog-User-Project` (§2) |
| IAP: `Project must belong to an organization` | Personal Gmail project | Expected — use the console (§5) |
| Sign-in works locally, fails in CI | Stale ID in workflow YAML | Grep everywhere (§7) |
| API keys `undefined` at runtime | `.env` not uploaded | Set EAS env vars (§8) |
| Fix committed but build still fails | Built from an older commit | Verify `Commit` in `build:list` (§9) |

---

## 12. APK size

Universal APKs ship native libs for **four** ABIs. Real measurement from this project:

| Section | Size |
|---|---|
| `lib/x86_64` | 73.0 MB |
| `lib/arm64-v8a` | 63.6 MB |
| `lib/x86` | 35.7 MB |
| `lib/armeabi-v7a` | 22.1 MB |
| dex + assets + res | ~25 MB |
| **total** | **220 MB** |

Inspect any APK:

```bash
python -c "
import zipfile,collections
z=zipfile.ZipFile('app.apk'); t=collections.Counter()
for i in z.infolist():
    p=i.filename.split('/')
    t['/'.join(p[:2]) if p[0]=='lib' else p[0]] += i.compress_size
for k,v in t.most_common(10): print(f'{k:<30}{v/1048576:>8.1f} MB')
"
```

Every real phone uses `arm64-v8a`; `x86`/`x86_64` exist only for emulators.
Restricting ABIs cuts ~220 MB → ~90 MB:

```jsonc
"android": { "abiFilters": ["arm64-v8a"] }
```

Add `"x86_64"` back if the team tests on emulators (~160 MB). For Play Store, ship an
AAB and Google splits per-device automatically.

---

## 13. Checklist

```
[ ] gcloud + EAS accounts identified, both recorded
[ ] Cloud project lifecycleState == ACTIVE
[ ] expo.android.package final (cannot change later)
[ ] EAS keystore exists; SHA-1 captured
[ ] SHA-1 + SHA-256 registered on the Firebase Android app
[ ] Consent screen created (External) and PUBLISHED to Production
[ ] Android OAuth client: package + colon-separated SHA-1
[ ] Web OAuth client created; ID copied
[ ] google-services.json re-downloaded; oauth_client has type 1 AND 3
[ ] certificate_hash in JSON == EAS SHA-1
[ ] app.json: package, googleServicesFile, 3 IDs (iosUrlScheme = web, reversed)
[ ] npx expo config resolves cleanly
[ ] grep for old project number returns nothing (incl. CI + docs)
[ ] EAS env vars set for every build-time variable
[ ] tsc clean; lint at baseline
[ ] ALL changes committed (EAS builds from git)
[ ] build:list shows the expected commit
[ ] APK installed and one real sign-in completed
```

---

## Appendix — reference values from this project

| Item | Value |
|---|---|
| Cloud/Firebase account | `tarfwrk@gmail.com` |
| EAS account | `tarteam01` / `wetarteam03@gmail.com` |
| Firebase project | `tarapp-504815` / `226183831843` |
| EAS project | `@tarteam01/tar` / `efb1d63a-cd61-4d36-8906-a2fefc57b4f8` |
| Package | `com.tarfw.app` |
| Keystore SHA-1 | `a99c8a83de9ab4cb06490f7ade62c96bffda9599` |
| Android client | `226183831843-oo3ga188i4qna8r29a5q2446a5fdt39k` |
| Web client | `226183831843-5sjvl1hsv4d04aucnqsqn19u83o4f5ku` |
| Retired project | `tarframework-35ar` / `291840005173` (`DELETE_REQUESTED`) |
