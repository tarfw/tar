import { GoogleSignin, statusCodes, User } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";

const SECURE_STORE_USER_KEY = "google_auth_user";

// Configure Google Sign-In
// Note: webClientId is required for Android/iOS Google Sign-In to retrieve an idToken/serverAuthCode.
// It is recommended to keep this value in your environment variables.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  offlineAccess: true, // Set to true if you want to get a serverAuthCode for server-side verification
});

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
  idToken: string | null;
}

/**
 * Initiates the Google Sign-In flow.
 * Returns the parsed user profile, or throws an error.
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    
    // In newer versions, response might contain the data in the "data" field or directly.
    // We check for both structures.
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

    // Save profile to Secure Store for persistent session
    await SecureStore.setItemAsync(SECURE_STORE_USER_KEY, JSON.stringify(profile));
    
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

/**
 * Signs the user out of Google and clears their saved session.
 */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
    await SecureStore.deleteItemAsync(SECURE_STORE_USER_KEY);
  } catch (error) {
    console.error("Failed to sign out from Google:", error);
    // Even if Google sign-out fails, clear the local session to log the user out
    await SecureStore.deleteItemAsync(SECURE_STORE_USER_KEY);
  }
}

/**
 * Checks if a user is currently signed in.
 * Restores session from SecureStore first, or falls back to silent Google sign-in.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    // 1. Check local secure storage
    const savedUserJson = await SecureStore.getItemAsync(SECURE_STORE_USER_KEY);
    if (savedUserJson) {
      return JSON.parse(savedUserJson) as UserProfile;
    }

    // 2. Fallback to silent native sign in
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
        return profile;
      }
    }
  } catch (error) {
    console.warn("Silent sign-in failed or no user is signed in:", error);
  }
  return null;
}
