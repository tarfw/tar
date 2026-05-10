import React, { useState, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect } from "expo-router";
import { getDbClient } from "../lib/db";

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [motions, setMotions] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function loadMotions() {
        try {
          const db = getDbClient();
          const rows = await db.all("SELECT * FROM motion ORDER BY time DESC LIMIT 50");
          if (Array.isArray(rows)) {
            setMotions(rows);
          }
        } catch (e) {
          console.error("Failed to load motions:", e);
        }
      }
      
      // Load immediately on focus
      loadMotions();
      
      // Poll the local database every 3 seconds to pick up any changes pulled by the background sync
      const intervalId = setInterval(loadMotions, 3000);
      
      return () => clearInterval(intervalId);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=prabha" }} 
              style={styles.avatar} 
            />
            <Text style={styles.userName}>prabha</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="archive-outline" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {motions.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>No motion data found.</Text>
          ) : motions.map((motion) => (
            <TouchableOpacity key={motion.id} style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Ionicons name="flash-outline" size={20} color="#1dd1a1" style={styles.itemIcon} />
                <View>
                  <Text style={styles.itemTitle}>{motion.stream || 'Unknown Stream'} (Seq: {motion.seq})</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>Action: {motion.action} • Status: {motion.status || 'N/A'}</Text>
                </View>
              </View>
              <View style={styles.listItemRight}>
                <Ionicons name="add" size={20} color="#ccc" />
              </View>
            </TouchableOpacity>
          ))}
          

          
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom Search Bar */}
        <View style={styles.footer}>
          <View style={styles.searchBarContainer}>
            <TouchableOpacity style={styles.footerIcon}>
              <Ionicons name="search" size={24} color="#666" />
            </TouchableOpacity>
            
            <View style={styles.inputWrapper}>
              <TextInput 
                placeholder="Ask AI" 
                style={styles.input} 
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/space')}>
              <Ionicons name="add" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#000",
    marginRight: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 4,
  },
  headerIcons: {
    flexDirection: "row",
  },
  iconBtn: {
    marginLeft: 20,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 14,
    color: "#999",
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrow: {
    marginRight: 10,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  listItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  moreIcon: {
    marginRight: 15,
  },
  viewMore: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  viewMoreText: {
    color: "#999",
    marginLeft: 10,
    fontSize: 16,
  },
  footer: {
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 30,
    paddingHorizontal: 15,
    height: 55,
  },
  footerIcon: {
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  createBtn: {
    marginLeft: 10,
  }
});
