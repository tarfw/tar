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
  Platform,
  Dimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import { getDbClient } from "../lib/db";
import { setActiveMassId } from "../lib/state";

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { massId } = useLocalSearchParams<{ massId: string }>();
  const [motions, setMotions] = useState<any[]>([]);
  const [selectedMass, setSelectedMass] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          const db = getDbClient();
          
          // Load motions
          const rows = await db.all("SELECT * FROM motion ORDER BY time DESC LIMIT 50");
          if (Array.isArray(rows)) {
            setMotions(rows);
          }

          // Load selected mass if any
          if (massId) {
            const massRow = await db.all(
              `SELECT m.*, t.title 
               FROM mass m 
               LEFT JOIN matter t ON m.matter = t.id 
               WHERE m.id = ?`, 
              [massId]
            );
            if (Array.isArray(massRow) && massRow.length > 0) {
              setSelectedMass(massRow[0]);
            }
          } else {
            setSelectedMass(null);
            setActiveMassId(null);
          }
        } catch (e) {
          console.error("Failed to load data:", e);
        }
      }
      
      loadData();
      const intervalId = setInterval(loadData, 2000);
      return () => clearInterval(intervalId);
    }, [massId])
  );

  const handleMarkDone = async (id: string) => {
    try {
      const db = getDbClient();
      await db.run("UPDATE motion SET status = 'COMPLETED' WHERE id = ?", [id]);
      setMotions(prev => prev.map(m => m.id === id ? { ...m, status: 'COMPLETED' } : m));
      await db.push();
    } catch (e) {
      console.error("Failed to mark done:", e);
    }
  };

  const renderCard = (motion: any) => {
    let parsedData: any = {};
    try {
      if (motion.data) parsedData = JSON.parse(motion.data);
    } catch (e) {}

    const action = motion.action || 100;
    const isCompleted = motion.status === 'COMPLETED';

    // Sanitize delta: if it's a JSON string (bug in AI output), try to extract the total
    let displayDelta = motion.delta;
    if (typeof displayDelta === 'string' && displayDelta.startsWith('{')) {
      try {
        const d = JSON.parse(displayDelta);
        displayDelta = d.total || d.amount || d.value || 0;
      } catch(e) {
        displayDelta = 0;
      }
    }

    // Default system log (Gray)
    let config = {
      icon: "flash" as any,
      color: "#64748b",
      title: "System Log",
      subtitle: (motion.stream || `Action: ${action}`).trim(),
      amount: displayDelta ? `${displayDelta > 0 ? '+' : ''}${displayDelta}` : null
    };

    if (action >= 1 && action <= 20) {
      config = {
        icon: "receipt",
        color: "#16a34a", // Restored Green
        title: "Sale Logged",
        subtitle: (parsedData.title ? `${parsedData.qty || 1}x ${parsedData.title}` : (motion.stream || 'Direct Checkout')).trim(),
        amount: `+₹${displayDelta || 0}`
      };
    } else if (action >= 51 && action <= 100) {
      config = {
        icon: "cube",
        color: "#ea580c", // Restored Amber
        title: "Inventory",
        subtitle: (parsedData.title || motion.stream || "").trim(),
        amount: displayDelta !== null ? (displayDelta > 0 ? `+${displayDelta}` : displayDelta.toString()) : null
      };
    } else if (action >= 101 && action <= 150) {
      config = {
        icon: "notifications",
        color: "#2563eb", // Restored Blue
        title: "Reminder",
        subtitle: (parsedData.task || parsedData.text || motion.stream || "").trim(),
        amount: null
      };
    } else if (action >= 151 && action <= 250) {
      config = {
        icon: "checkbox",
        color: "#c026d3",
        title: "Task",
        subtitle: (parsedData.task || parsedData.text || motion.stream || "").trim(),
        amount: null
      };
    } else if (action >= 251 && action <= 300) {
      config = {
        icon: "gift",
        color: "#e11d48", // Restored Pink
        title: "Growth",
        subtitle: (parsedData.title || motion.stream || "").trim(),
        amount: null
      };
    }

    return (
      <View key={motion.id} style={styles.motionItem}>
        <View style={styles.motionItemLeft}>
          <View style={styles.statusWrapper}>
            <Ionicons 
              name={isCompleted ? "checkmark-circle" : "ellipse-outline"} 
              size={22} 
              color={isCompleted ? config.color : "#cbd5e1"} 
            />
          </View>
          <View style={styles.motionTextContainer}>
            <Text style={styles.motionTitle}>{config.title}</Text>
            <Text style={styles.motionSubtitle} numberOfLines={1}>{config.subtitle}</Text>
          </View>
        </View>
        <View style={styles.motionItemRight}>
          {config.amount && <Text style={styles.itemAmount} numberOfLines={1}>{config.amount}</Text>}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <Animated.View entering={FadeIn.delay(200)} style={styles.userInfo}>
            <Image 
              source={{ uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=prabha" }} 
              style={styles.avatar} 
            />
            <Text style={styles.userName}>prabha</Text>
          </Animated.View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {motions.length === 0 ? (
            <Animated.View 
              entering={FadeInDown.delay(400).duration(800)}
              style={styles.emptyState}
            >
              <Ionicons name="layers-outline" size={48} color="#e2e8f0" />
              <Text style={styles.emptyText}>No motion data found.</Text>
            </Animated.View>
          ) : (
            <View style={styles.motionList}>
              {motions.map((motion, index) => (
                <React.Fragment key={motion.id}>
                  {renderCard(motion)}
                  {index < motions.length - 1 && <View style={styles.separator} />}
                </React.Fragment>
              ))}
            </View>
          )}
          
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom Search Bar */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomBarRow}>
            <TouchableOpacity 
              style={styles.circleBtn}
              onPress={() => router.push('/search')}
            >
              <Ionicons name="search" size={22} color="#1a1a1a" />
            </TouchableOpacity>

            <View style={styles.rightGroup}>
              <TouchableOpacity style={styles.circleBtn}>
                <Ionicons name="mic-outline" size={22} color="#1a1a1a" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.circleBtn, { marginLeft: 12 }]}
                activeOpacity={0.8}
                onPress={() => router.push('/tarai')}
              >
                <Text style={styles.aiText}>AI</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.circleBtn, { marginLeft: 12 }]} 
                onPress={() => router.push('/space')}
              >
                <Ionicons name="arrow-up" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Mass View Overlay */}
        {selectedMass && (
          <View style={[styles.massOverlay, { bottom: insets.bottom + 100 }]}>
            <View style={styles.massCard}>
              <View style={styles.massHeader}>
                <View style={styles.massTitleRow}>
                  <View style={[styles.massIndicator, { backgroundColor: '#c026d3' }]} />
                  <Text style={styles.massTitleText}>{selectedMass.title || 'Stock Item'}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedMass(null);
                    setActiveMassId(null);
                    router.setParams({ massId: undefined });
                  }}
                  style={styles.massCloseBtn}
                >
                  <Ionicons name="close-circle" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.massStats}>
                <View style={styles.massStatItem}>
                  <Text style={styles.massStatLabel}>Quantity</Text>
                  <Text style={styles.massStatValue}>{selectedMass.qty || 0}</Text>
                </View>
                <View style={styles.massStatItem}>
                  <Text style={styles.massStatLabel}>Total Value</Text>
                  <Text style={styles.massStatValue}>₹{selectedMass.value || 0}</Text>
                </View>
                <View style={styles.massStatItem}>
                  <Text style={styles.massStatLabel}>Type</Text>
                  <Text style={styles.massStatValue}>{selectedMass.type || 'Mass'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
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
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
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
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  circleBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  aiText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6366f1",
  },
  motionList: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  motionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "white",
  },
  motionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusWrapper: {
    width: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  motionTextContainer: {
    flex: 1,
  },
  motionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  motionSubtitle: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  motionItemRight: {
    alignItems: "flex-end",
    marginLeft: 16,
    minWidth: 50,
    justifyContent: 'center',
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  separator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 64,
  },
  massOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  massCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  massHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  massTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  massIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  massTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  massCloseBtn: {
    padding: 4,
  },
  massStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  massStatItem: {
    flex: 1,
  },
  massStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  massStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
  }
});
