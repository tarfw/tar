import React, { useState } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Platform,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { getUserDb } from "../lib/db";

const groupOrderItems = (items: any[]) => {
  const groupedMap: { [streamId: string]: { header: any; items: any[] } } = {};
  const ungrouped: any[] = [];

  for (const item of items) {
    if (item.stream && item.stream.startsWith("ord_")) {
      const streamId = item.stream;
      if (!groupedMap[streamId]) {
        groupedMap[streamId] = { header: null, items: [] };
      }
      if (item.action === 201) {
        groupedMap[streamId].header = item;
      } else {
        groupedMap[streamId].items.push(item);
      }
    } else {
      ungrouped.push(item);
    }
  }

  const groupedOrders = Object.entries(groupedMap).map(([streamId, group]) => {
    const header = group.header || group.items[0];
    const otherItems = group.header ? group.items : group.items.slice(1);
    const sortedItems = otherItems.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    return {
      id: streamId,
      isOrderGroup: true,
      header: header,
      items: sortedItems,
      time: header?.time || new Date().toISOString()
    };
  });

  return [...ungrouped, ...groupedOrders];
};

const formatRelativeTime = (timeStr: string) => {
  try {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (isNaN(date.getTime())) return "";
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (e) {
    return "";
  }
};

export default function HistoryPage() {
  const router = useRouter();
  const [pastItems, setPastItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          if (isMounted) setLoading(true);
          const db = getUserDb();
          console.log("[History:Load] Fetching past completed motions from user.db...");
          const uPastMotions = await db.all(
            "SELECT *, 'user' as originDb FROM motion WHERE status = 'COMPLETED' OR action = 201 ORDER BY time DESC LIMIT 100"
          );
          
          const combinedPast = Array.isArray(uPastMotions) ? uPastMotions : [];
          const groupedPast = groupOrderItems(combinedPast)
            .sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));

          if (isMounted) {
            setPastItems(groupedPast);
            console.log("[History:Load] Successfully loaded history items count:", groupedPast.length);
          }
        } catch (err) {
          console.error("[History:Load] Failed to load history motions:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const renderCard = (motion: any) => {
    let parsedData: any = {};
    try {
      if (motion.data) parsedData = JSON.parse(motion.data);
    } catch (e) {}

    const action = motion.action || 100;
    const isCompleted = motion.status === 'COMPLETED';

    let displayDelta = motion.delta;
    if (typeof displayDelta === 'string' && displayDelta.startsWith('{')) {
      try {
        const d = JSON.parse(displayDelta);
        displayDelta = d.total || d.amount || d.value || 0;
      } catch(e) {
        displayDelta = 0;
      }
    }

    let config = {
      icon: "flash" as any,
      color: "#64748b",
      title: "System Log",
      subtitle: (motion.stream || `Action: ${action}`).trim(),
      amount: displayDelta ? `${displayDelta > 0 ? '+' : ''}${displayDelta}` : null
    };

    if ((action >= 1 && action <= 20) || action === 201) {
      let subtitleText = "Direct Checkout";
      if (parsedData.items && Array.isArray(parsedData.items)) {
        subtitleText = parsedData.items.map((it: any) => `${it.qty || 1}x ${it.title || "Item"}`).join(", ");
      } else if (parsedData.title) {
        subtitleText = `${parsedData.qty || 1}x ${parsedData.title}`;
      } else if (motion.stream) {
        subtitleText = motion.stream;
      }
      config = {
        icon: "receipt",
        color: "#16a34a",
        title: "Sale Logged",
        subtitle: subtitleText.trim(),
        amount: `+₹${displayDelta || 0}`
      };
    } else if (action >= 51 && action <= 100) {
      config = {
        icon: "cube",
        color: "#ea580c",
        title: "Inventory",
        subtitle: (parsedData.title || motion.stream || "").trim(),
        amount: displayDelta !== null ? (displayDelta > 0 ? `+${displayDelta}` : displayDelta.toString()) : null
      };
    } else if (action === 504 || (action >= 101 && action <= 150)) {
      const isReminder = parsedData.triggered_at || parsedData.task?.toLowerCase().includes("reminder") || action <= 150;
      config = {
        icon: isReminder ? "notifications" : "checkbox",
        color: isReminder ? "#2563eb" : "#c026d3",
        title: isReminder ? "Reminder" : "Task",
        subtitle: (parsedData.task || parsedData.text || motion.stream || "").trim(),
        amount: null
      };
    } else if (action === 200 || (action >= 151 && action <= 250)) {
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
        color: "#e11d48",
        title: "Growth",
        subtitle: (parsedData.title || motion.stream || "").trim(),
        amount: null
      };
    }

    return (
      <View key={`${motion.originDb || 'motion'}_${motion.id}`} style={styles.motionItem}>
        <View style={styles.motionItemLeft}>
          <View style={styles.statusWrapper}>
            <Ionicons 
              name={isCompleted ? "checkmark-circle" : "ellipse-outline"} 
              size={22} 
              color={isCompleted ? config.color : "#cbd5e1"} 
            />
          </View>
          <View style={styles.motionTextContainer}>
            <Text style={styles.motionTitle} numberOfLines={1}>
              {config.subtitle}
            </Text>
          </View>
        </View>
        <View style={styles.motionItemRight}>
          {config.amount && <Text style={styles.itemAmount} numberOfLines={1}>{config.amount}</Text>}
        </View>
      </View>
    );
  };

  const renderOrderGroupCard = (group: any, index: number, total: number) => {
    const header = group.header;
    const items = group.items;
    const totalAmount = header.delta;

    return (
      <View 
        key={group.id} 
        style={[
          styles.orderGroupContainer,
          {
            borderTopWidth: index === 0 ? 0 : 0.5,
            borderBottomWidth: index === total - 1 ? 0 : 0.5,
            borderColor: '#f1f5f9'
          }
        ]}
      >
        <View style={styles.orderGroupHeader}>
          <View style={styles.motionItemLeft}>
            <View style={styles.motionTextContainer}>
              <Text style={styles.orderGroupTitle}>
                Order #{group.id.replace('ord_', '')}
              </Text>
            </View>
          </View>
          <View style={styles.motionItemRight}>
            <Text style={styles.itemAmount}>+₹{totalAmount}</Text>
          </View>
        </View>

        <View style={styles.orderItemsList}>
          {items.map((item: any, idx: number) => {
            let parsedItemData: any = {};
            try {
              if (item.data) parsedItemData = JSON.parse(item.data);
            } catch (e) {}

            const itemTitle = parsedItemData.title || item.stream || "Item";
            const itemStatus = item.status || "PENDING";
            
            let statusColor = "#64748b";
            if (itemStatus === "READY") {
              statusColor = "#16a34a";
            } else if (itemStatus === "DELIVERED" || itemStatus === "COMPLETED") {
              statusColor = "#2563eb";
            } else if (itemStatus === "PENDING") {
              statusColor = "#94a3b8";
            }

            return (
              <View key={item.id} style={[styles.orderItemRow, idx > 0 && styles.orderItemBorder]}>
                <View style={styles.orderItemLeft}>
                  <View style={styles.statusWrapper}>
                    <Ionicons 
                      name={itemStatus === "DELIVERED" || itemStatus === "COMPLETED" ? "checkmark-circle" : "ellipse-outline"} 
                      size={22} 
                      color={statusColor} 
                    />
                  </View>
                  <Text style={styles.orderItemText}>
                    {itemTitle} <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: 'normal' }}>x{Math.abs(item.delta || 1)}</Text>
                  </Text>
                </View>
                <Text style={[styles.orderItemStatusText, { color: statusColor }]}>{itemStatus}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View>
            {pastItems.length > 0 ? (
              <View style={styles.motionList}>
                {pastItems.map((item, index) => (
                  <React.Fragment key={`${item.originDb || 'past'}_${item.id}`}>
                    {item.isOrderGroup ? (
                      renderOrderGroupCard(item, index, pastItems.length)
                    ) : (
                      <View>
                        {renderCard(item)}
                        {index < pastItems.length - 1 && !pastItems[index + 1].isOrderGroup && <View style={styles.separator} />}
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
                <Ionicons name="archive-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No completed history found.</Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
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
    fontSize: 15,
    fontWeight: "500",
    color: "#1e293b",
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
  orderGroupContainer: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#f1f5f9",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  orderGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  orderGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.5,
  },
  orderItemsList: {
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  orderItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderItemBorder: {
    borderTopWidth: 0.5,
    borderTopColor: "#f1f5f9",
  },
  orderItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
  },
  orderItemStatusText: {
    fontSize: 12,
    fontWeight: "600",
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
  },
});
