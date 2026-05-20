import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient } from "../lib/db";

export default function MotionScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [stream, setStream] = useState("");
  const [seq, setSeq] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [delta, setDelta] = useState("");
  const [scope, setScope] = useState("");
  const [data, setData] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!id || !stream || !seq || !action) {
      Alert.alert("Error", "ID, Stream, Seq, and Action are required");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const db = getDbClient();
      const time = new Date().toISOString();
      const parsedSeq = parseInt(seq, 10);
      const parsedAction = parseInt(action, 10);
      const parsedDelta = delta ? parseFloat(delta) : null;

      if (isNaN(parsedSeq) || isNaN(parsedAction)) {
        Alert.alert("Error", "Seq and Action must be valid integers");
        setIsSaving(false);
        return;
      }

      await db.run(
        `INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, stream, parsedSeq, parsedAction, 
          status || null, parsedDelta, scope || null, 
          data || null, time
        ]
      );

      router.back();

      // Sync changes to remote in the background AFTER navigation transition
      setTimeout(() => {
        db.push().catch(err => console.error("Background sync failed:", err));
      }, 500);
    } catch (error) {
      console.error("Failed to create motion:", error);
      Alert.alert("Error", "Failed to create motion. Check console for details.");
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Motion</Text>
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
            placeholder="Unique Motion ID" 
            placeholderTextColor="#999"
            value={id}
            onChangeText={setId}
          />

          <Text style={styles.label}>Stream</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Stream Identifier" 
            placeholderTextColor="#999"
            value={stream}
            onChangeText={setStream}
          />

          <Text style={styles.label}>Seq (Sequence Number)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0" 
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={seq}
            onChangeText={setSeq}
          />

          <Text style={styles.label}>Action (Integer)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="1" 
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={action}
            onChangeText={setAction}
          />

          <Text style={styles.label}>Status</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Status" 
            placeholderTextColor="#999"
            value={status}
            onChangeText={setStatus}
          />

          <Text style={styles.label}>Delta</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0.0" 
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={delta}
            onChangeText={setDelta}
          />

          <Text style={styles.label}>Scope</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Scope" 
            placeholderTextColor="#999"
            value={scope}
            onChangeText={setScope}
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

          <TouchableOpacity 
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>{isSaving ? "Saving..." : "Save Motion"}</Text>
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
    padding: 10,
    marginRight: -10,
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
  },
  saveBtnDisabled: {
    backgroundColor: "#666",
  }
});
