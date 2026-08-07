import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

const SECURE_STORE_USER_KEY = "google_auth_user";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "226183831843-5sjvl1hsv4d04aucnqsqn19u83o4f5ku.apps.googleusercontent.com",
  offlineAccess: false,
  scopes: ["profile", "email"],
});

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
  idToken: string | null;
}

export async function signInWithGoogleWebFallback(): Promise<UserProfile> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "226183831843-5sjvl1hsv4d04aucnqsqn19u83o4f5ku.apps.googleusercontent.com";
  const redirectUri = Linking.createURL("oauthredirect");

  console.log("[Auth] Starting Web OAuth Fallback. Redirect URI:", redirectUri);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(webClientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token%20id_token` +
    `&scope=${encodeURIComponent("openid profile email")}` +
    `&nonce=${Math.random().toString(36).substring(2)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  console.log("[Auth] WebBrowser session result:", result.type);

  if (result.type === "success" && result.url) {
    const rawFragment = result.url.split("#")[1] || result.url.split("?")[1] || "";
    const params = new URLSearchParams(rawFragment);
    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    if (accessToken || idToken) {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken || idToken}` },
      });
      const userData = await userRes.json();

      if (!userData || (!userData.sub && !userData.email)) {
        throw new Error("Failed to fetch user profile from Google Web OAuth");
      }

      const profile: UserProfile = {
        id: userData.sub || userData.id || userData.email,
        name: userData.name || userData.email || "Google User",
        email: userData.email,
        photo: userData.picture || null,
        idToken: idToken,
      };

      await SecureStore.setItemAsync(SECURE_STORE_USER_KEY, JSON.stringify(profile));
      console.log(`[Auth] Web OAuth fallback success: ${profile.email}`);
      return profile;
    }
  }

  throw new Error("Sign in cancelled or failed in web browser session");
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const t0 = Date.now();
  try {
    console.log(`[Auth] ${Date.now() - t0}ms — signInWithGoogle START`);
    await GoogleSignin.hasPlayServices();
    console.log(`[Auth] ${Date.now() - t0}ms — hasPlayServices OK`);
    const response = await GoogleSignin.signIn();
    console.log(`[Auth] ${Date.now() - t0}ms — signIn DONE`);

    const signInResult = response as any;
    const userData = signInResult.data ? signInResult.data : signInResult;

    if (!userData || !userData.user) {
      throw new Error("No user data returned from Google Sign-In");
    }

    const profile: UserProfile = {
      id: userData.user.id,
      name: userData.user.name,
      email: userData.user.email,
      photo: userData.user.photo,
      idToken: userData.idToken,
    };

    console.log(`[Auth] ${Date.now() - t0}ms — storing profile to SecureStore`);
    await SecureStore.setItemAsync(SECURE_STORE_USER_KEY, JSON.stringify(profile));

    console.log(`[Auth] ${Date.now() - t0}ms — signInWithGoogle DONE: ${profile.email}`);
    return profile;
  } catch (error: any) {
    console.error("[Auth] Google Sign-In error details:", error);
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Sign in was cancelled by user");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Sign in is already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Play services not available or outdated");
    } else if (
      (statusCodes as any).DEVELOPER_ERROR && error.code === (statusCodes as any).DEVELOPER_ERROR ||
      String(error.code) === "10" ||
      error.message?.includes("DEVELOPER_ERROR")
    ) {
      console.warn("[Auth] DEVELOPER_ERROR (10) encountered. Attempting Web OAuth Fallback...");
      try {
        return await signInWithGoogleWebFallback();
      } catch (webErr: any) {
        console.error("[Auth] Web OAuth Fallback failed:", webErr);
        throw new Error(
          "Google Sign-In DEVELOPER_ERROR (10): OAuth configuration mismatch on Google Cloud / Play Console.\n" +
          "Please verify Google Play App Signing SHA-1 is added in Google Cloud Console."
        );
      }
    } else {
      throw new Error(error.message || "An unknown error occurred during Google Sign-In");
    }
  }
}

export async function signOutGoogle(): Promise<void> {
  const t0 = Date.now();
  try {
    console.log(`[Auth] ${Date.now() - t0}ms — signOutGoogle START`);
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    console.log(`[Auth] ${Date.now() - t0}ms — Google sign-out done`);
  } catch (error) {
    console.error(`[Auth] ${Date.now() - t0}ms — signOutGoogle error:`, error);
  } finally {
    await SecureStore.deleteItemAsync(SECURE_STORE_USER_KEY);
    console.log(`[Auth] ${Date.now() - t0}ms — signOutGoogle DONE (SecureStore cleared)`);
  }
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const t0 = Date.now();
  const savedUserJson = await SecureStore.getItemAsync(SECURE_STORE_USER_KEY);
  console.log(`[Auth] ${Date.now() - t0}ms — getCurrentUser: ${savedUserJson ? 'found' : 'null'}`);
  if (!savedUserJson) return null;
  return JSON.parse(savedUserJson) as UserProfile;
}

export async function trySilentSignIn(): Promise<UserProfile | null> {
  const t0 = Date.now();
  try {
    console.log(`[Auth] ${Date.now() - t0}ms — trySilentSignIn START`);
    const hasPrevious = await GoogleSignin.hasPreviousSignIn();
    console.log(`[Auth] ${Date.now() - t0}ms — hasPreviousSignIn: ${hasPrevious}`);
    if (!hasPrevious) return null;

    console.log(`[Auth] ${Date.now() - t0}ms — signInSilently START`);
    const response = await Promise.race([
      GoogleSignin.signInSilently(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("silent sign-in timeout")), 5000)),
    ]);
    console.log(`[Auth] ${Date.now() - t0}ms — signInSilently DONE`);

    const signInResult = response as any;
    const userData = signInResult.data ? signInResult.data : signInResult;

    if (!userData?.user) {
      console.log(`[Auth] ${Date.now() - t0}ms — no user data`);
      return null;
    }

    const profile: UserProfile = {
      id: userData.user.id,
      name: userData.user.name,
      email: userData.user.email,
      photo: userData.user.photo,
      idToken: userData.idToken,
    };

    await SecureStore.setItemAsync(SECURE_STORE_USER_KEY, JSON.stringify(profile));

    console.log(`[Auth] ${Date.now() - t0}ms — trySilentSignIn DONE: ${profile.email}`);
    return profile;
  } catch (error) {
    console.warn(`[Auth] ${Date.now() - t0}ms — trySilentSignIn FAILED:`, error);
    return null;
  }
}
