import { GoogleSignin, statusCodes, User } from "@react-native-google-signin/google-signin";
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
  try {
    const response = await fetch(`${WORKER_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    if (!response.ok) {
      console.warn("[Auth] JWT exchange failed:", await response.text());
      return null;
    }

    const { token } = await response.json();
    await SecureStore.setItemAsync(SECURE_STORE_JWT_KEY, token);
    return token;
  } catch (e) {
    console.warn("[Auth] JWT exchange error:", e);
    return null;
  }
}

export async function getJwt(): Promise<string | null> {
  return await SecureStore.getItemAsync(SECURE_STORE_JWT_KEY);
}

export async function signInWithGoogle(): Promise<UserProfile> {
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

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

    await SecureStore.setItemAsync(SECURE_STORE_USER_KEY, JSON.stringify(profile));

    if (userData.idToken) {
      await exchangeForJwt(userData.idToken);
    }

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
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    await SecureStore.deleteItemAsync(SECURE_STORE_USER_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_JWT_KEY);
  } catch (error) {
    console.error("Failed to sign out from Google:", error);
    await SecureStore.deleteItemAsync(SECURE_STORE_USER_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_JWT_KEY);
  }
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const savedUserJson = await SecureStore.getItemAsync(SECURE_STORE_USER_KEY);
    if (savedUserJson) {
      const profile = JSON.parse(savedUserJson) as UserProfile;
      const jwt = await getJwt();
      if (!jwt && profile.idToken) {
        await exchangeForJwt(profile.idToken);
      }
      return profile;
    }

    const hasPreviousSignIn = await GoogleSignin.hasPreviousSignIn();
    if (hasPreviousSignIn) {
      const response = await GoogleSignin.signInSilently();
      const signInResult = response as any;
      const userData = signInResult.data ? signInResult.data : signInResult;

      if (userData && userData.user) {
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

        return profile;
      }
    }
  } catch (error) {
    console.warn("Silent sign-in failed or no user is signed in:", error);
  }
  return null;
}
