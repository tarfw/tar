import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

export default function LoginScreen() {
  const router = useRouter();

  const handleGoogleLogin = () => {
    // Navigate to home after pseudo-login
    router.push("/home");
  };

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
            style={styles.googleButton} 
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={24} color="#333" style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
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
