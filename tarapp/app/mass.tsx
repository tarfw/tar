import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient } from "../lib/db";

const genMassId = () => `mas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export default function MassScreen() {
  const router = useRouter();
  const [id, setId] = useState(genMassId);
  const [matter, setMatter] = useState("");
  const [type, setType] = useState("");
  const [scope, setScope] = useState("");
  const [qty, setQty] = useState("");
  const [value, setValue] = useState("");
  const [geo, setGeo] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!matter) {
      Alert.alert("Error", "Matter (reference) is required");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const db = getDbClient();
      const time = new Date().toISOString();
      const parsedQty = qty ? parseFloat(qty) : null;
      const parsedValue = value ? parseFloat(value) : null;
      const active = 1; // Defaulting to 1

      await db.run(
        `INSERT INTO mass (id, matter, type, scope, qty, value, active, geo, start, end, data, time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, matter, type || null, scope || null, 
          parsedQty, parsedValue, active, geo || null, 
          start || null, end || null, data || null, time
        ]
      );

      router.back();

      // No-op sync in local mode
    } catch (error) {
      console.error("Failed to create mass:", error);
      Alert.alert("Error", "Failed to create mass. Check console for details.");
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Mass</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.label}>Matter (Reference ID)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Related Matter ID" 
            placeholderTextColor="#999"
            value={matter}
            onChangeText={setMatter}
          />

          <Text style={styles.label}>Type</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Mass Type" 
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

          <Text style={styles.label}>Quantity</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0.0" 
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={qty}
            onChangeText={setQty}
          />

          <Text style={styles.label}>Value</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0.0" 
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={value}
            onChangeText={setValue}
          />

          <Text style={styles.label}>Geo</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Geo Location" 
            placeholderTextColor="#999"
            value={geo}
            onChangeText={setGeo}
          />

          <Text style={styles.label}>Start Time</Text>
          <TextInput 
            style={styles.input} 
            placeholder="YYYY-MM-DD..." 
            placeholderTextColor="#999"
            value={start}
            onChangeText={setStart}
          />

          <Text style={styles.label}>End Time</Text>
          <TextInput 
            style={styles.input} 
            placeholder="YYYY-MM-DD..." 
            placeholderTextColor="#999"
            value={end}
            onChangeText={setEnd}
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
            <Text style={styles.saveBtnText}>{isSaving ? "Saving..." : "Save Mass"}</Text>
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
