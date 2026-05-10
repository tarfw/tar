import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

export default function SpaceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>New Space</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <TextInput 
          style={styles.input} 
          placeholder="What do you want to create?" 
          placeholderTextColor="#ccc"
          autoFocus={true}
          multiline={true}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  closeBtn: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  input: {
    fontSize: 24,
    color: "#333",
    fontWeight: "400",
  }
});
