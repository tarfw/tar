# Authentication Strategy & Costs

## Google Sign-In with Firebase

When building the authentication layer for the TAR App, using **Google Sign-In** paired with **Firebase Authentication** is the most cost-effective strategy.

### The React Native Package
We use the `@react-native-google-signin/google-signin` package. 
* It is an open-source wrapper around the official native Google Sign-In SDKs for iOS and Android.
* **Cost:** 100% Free.

### Firebase Authentication Costs
When authenticating these users into the backend via Firebase:
* **Social Logins (Google, Apple, etc.) & Email/Password:** 100% Free for **Unlimited Monthly Active Users (MAUs)**.
* **Phone/SMS Auth:** Firebase charges per SMS sent (after the free tier of 10k/month).

### Comparison with Clerk & Supabase
While providers like Clerk and Supabase offer great Developer Experience (DX), they use a freemium model that charges based on user volume:
* **Clerk:** Free up to 10,000 MAUs. Charges per active user afterward.
* **Supabase:** Free up to 50,000 MAUs. Charges a flat rate per additional 1,000 users.
* **Google Sign-In + Firebase:** **Unlimited MAUs for free.**

**Conclusion:** 
To ensure maximum scalability without accumulating large identity-provider bills, Firebase Auth combined with the React Native Google Sign-In package is the recommended architectural choice.

### Architectural Flow & Data Separation

#### 1. Where is the User Data Maintained?
User data is divided into two distinct systems:
* **Identity Data (Firebase):** Firebase Auth securely manages sensitive credentials (Email, Google UID, passwords, avatars).
* **Application Data (Turso DB):** All application-specific profile data follows the 5-table physics schema. The user's core profile is stored in the `matter` table, wallet/balances are in `mass`, and their actions/orders are tracked in the `motion` table.

#### 2. Does this require Cloudflare Workers?
* **For Login:** No. The app talks directly to Google/Firebase.
* **For Turso Sync:** **Yes**. The app needs a Turso JWT to securely sync offline-first data.

**The Bridge Flow:**
1. **Login:** User authenticates via Google Sign-In; app receives a Firebase Token.
2. **Verify:** App sends the Firebase Token to a Cloudflare Worker.
3. **Bridge:** Worker validates the Firebase Token securely.
4. **Mint & Return:** Worker mints a scoped **Turso JWT** for that user's isolated database and returns it.
5. **Sync:** The React Native app uses the Turso token to initiate `< 5ms` local offline sync with Turso.
