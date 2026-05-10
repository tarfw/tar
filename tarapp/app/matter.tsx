import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient } from "../lib/db";

export default function MatterScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [scope, setScope] = useState("");
  const [owner, setOwner] = useState("");
  const [data, setData] = useState("");

  const handleSave = async () => {
    if (!id || !title) {
      Alert.alert("Error", "ID and Title are required");
      return;
    }

    try {
      const db = getDbClient();
      const time = new Date().toISOString();
      const isPublic = 0; // Defaulting to 0

      await db.run(
        `INSERT INTO matter (id, code, type, scope, owner, title, public, data, time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, code || null, type || null, scope || null, owner || null, title, isPublic, data || null, time]
      );

      // Sync changes to remote
      await db.push();

      Alert.alert("Success", "Matter created successfully!");
      router.back();
    } catch (error) {
      console.error("Failed to create matter:", error);
      Alert.alert("Error", "Failed to create matter. Check console for details.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Matter</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.label}>ID</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Unique Matter ID" 
            placeholderTextColor="#999"
            value={id}
            onChangeText={setId}
          />

          <Text style={styles.label}>Title</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Matter Title" 
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Code</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Unique Code (Optional)" 
            placeholderTextColor="#999"
            value={code}
            onChangeText={setCode}
          />

          <Text style={styles.label}>Type</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Matter Type" 
            placeholderTextColor="#999"
            value={type}
            onChangeText={setType}
          />

          <Text style={styles.label}>Scope</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Scope" 
            placeholderTextColor="#999"
            value={scope}
            onChangeText={setScope}
          />

          <Text style={styles.label}>Owner</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Owner" 
            placeholderTextColor="#999"
            value={owner}
            onChangeText={setOwner}
          />

          <Text style={styles.label}>Data (JSON string)</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            placeholder="{}" 
            placeholderTextColor="#999"
            value={data}
            onChangeText={setData}
            multiline={true}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Matter</Text>
          </TouchableOpacity>
          
          <View style={{ height: 40 }} />
        </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  closeBtn: {
    padding: 5,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 30,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  }
});
