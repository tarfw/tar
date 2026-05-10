import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CIRCLE_SIZE = 55; // Increased size for better visibility


const GUIDE_ITEMS = [
  { color: "#FF822E" },
  { color: "#A8A5FF" },
  { color: "#FF5E7E" },
  { color: "#D6CEC2" },
  { color: "#FF822E" },
  { color: "#FF5233" },
  { color: "#FFD1F5" },
  { color: "#FFE054" },
  { color: "#CD950C" },
  { color: "#16B364" },
  { color: "#D9D9D9" },
  { color: "#D6CEC2" },
];

export default function SpaceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Space</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.tileRow}>
          <TouchableOpacity 
            style={styles.entityTile}
            onPress={() => router.push('/matter')}
          >
            <Ionicons name="cube-outline" size={32} color="#fff" />
            <Text style={styles.entityTileText}>Matter</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.entityTile}
            onPress={() => router.push('/mass')}
          >
            <Ionicons name="scale-outline" size={32} color="#fff" />
            <Text style={styles.entityTileText}>Mass</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.entityTile}
            onPress={() => router.push('/motion')}
          >
            <Ionicons name="flash-outline" size={32} color="#fff" />
            <Text style={styles.entityTileText}>Motion</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.guideHeader}>Guide</Text>
        <View style={styles.grid}>
          {GUIDE_ITEMS.map((item, index) => (
            <TouchableOpacity key={index} style={[styles.circle, { backgroundColor: item.color }]}>
              <Text style={styles.circleText}>{index + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
    backgroundColor: "#fff",
  },
  tileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  entityTile: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#000',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entityTileText: {
    color: '#fff',
    marginTop: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  guideHeader: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333", // Darker for white background
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20, // Using gap for consistent spacing between small circles
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    // Removed shadows for a flat look
  },
  circleText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
  }
});
