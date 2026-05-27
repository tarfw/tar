import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { signInWithGoogle, getCurrentUser } from "../lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    // Check if user is already signed in on startup
    async function checkSession() {
      try {
        const user = await getCurrentUser();
        if (user) {
          router.replace("/home");
        }
      } catch (e) {
        console.error("Session restoration failed:", e);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        router.replace("/home");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Authentication Failed", error.message || "Could not sign in with Google.");
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.inner}>
        {/* Centered Logo */}
        <Animated.View entering={FadeIn.duration(1000)} style={styles.logoContainer}>
          <Text style={styles.logoText}>tar</Text>
        </Animated.View>

        {/* Login Button Area */}
        <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.googleButton, signingIn && { opacity: 0.7 }]} 
            onPress={handleGoogleLogin}
            disabled={signingIn}
            activeOpacity={0.8}
          >
            {signingIn ? (
              <ActivityIndicator size="small" color="#333" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#333" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingBottom: 40,
    paddingTop: 80,
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 96,
    fontWeight: "900",
    color: "#333",
    letterSpacing: -4,
  },
  buttonContainer: {
    width: "100%",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    paddingVertical: 16,
    borderRadius: 30,
    width: "100%",
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
});
