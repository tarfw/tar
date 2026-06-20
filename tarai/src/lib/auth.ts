import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";

const SECURE_STORE_USER_KEY = "google_auth_user";
const SECURE_STORE_JWT_KEY = "sync_jwt";

const WORKER_URL = process.env.EXPO_PUBLIC_TAR_SYNC_URL || "https://tar-sync.tar-54d.workers.dev";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  offlineAccess: true,
});

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
  idToken: string | null;
}

export async function exchangeForJwt(idToken: string): Promise<string | null> {
  const t0 = Date.now();
  try {
    console.log(`[Auth] ${Date.now() - t0}ms — exchangeForJwt START → ${WORKER_URL}/api/auth`);
    const response = await fetch(`${WORKER_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    if (!response.ok) {
      console.warn(`[Auth] ${Date.now() - t0}ms — exchangeForJwt HTTP ${response.status}`);
      return null;
    }

    const { token } = await response.json();
    await SecureStore.setItemAsync(SECURE_STORE_JWT_KEY, token);
    console.log(`[Auth] ${Date.now() - t0}ms — exchangeForJwt DONE`);
    return token;
  } catch (e) {
    console.warn(`[Auth] ${Date.now() - t0}ms — exchangeForJwt ERROR:`, e);
    return null;
  }
}

export async function getJwt(): Promise<string | null> {
  return await SecureStore.getItemAsync(SECURE_STORE_JWT_KEY);
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

    if (userData.idToken) {
      await exchangeForJwt(userData.idToken);
    }

    console.log(`[Auth] ${Date.now() - t0}ms — signInWithGoogle DONE: ${profile.email}`);
    return profile;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Sign in was cancelled by user");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Sign in is already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Play services not available or outdated");
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
    await SecureStore.deleteItemAsync(SECURE_STORE_JWT_KEY);
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

export async function ensureJwt(): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile?.idToken) return;
  const jwt = await getJwt();
  if (!jwt) {
    await exchangeForJwt(profile.idToken);
  }
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

    if (userData.idToken) {
      await exchangeForJwt(userData.idToken);
    }

    console.log(`[Auth] ${Date.now() - t0}ms — trySilentSignIn DONE: ${profile.email}`);
    return profile;
  } catch (error) {
    console.warn(`[Auth] ${Date.now() - t0}ms — trySilentSignIn FAILED:`, error);
    return null;
  }
}
