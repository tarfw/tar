import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getCollabDb } from "../lib/db";
import { getDbPath } from "@tursodatabase/sync-react-native";

type TabType = "delivery" | "margins" | "dispatch";

export default function JoinsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("delivery");
  const [loading, setLoading] = useState(true);
  
  // Tab-specific data states
  const [deliveryData, setDeliveryData] = useState<any[]>([]);
  const [marginData, setMarginData] = useState<any[]>([]);
  const [dispatchData, setDispatchData] = useState<any[]>([]);

  const loadJoinedData = async () => {
    setLoading(true);
    try {
      const db = getCollabDb();
      
      // 1. Attach user database to collaboration connection
      try {
        const userDbPath = getDbPath("user.db");
        await db.run("ATTACH DATABASE ? AS user_db", [userDbPath]);
        console.log("[Joins] user.db attached successfully");
      } catch (e: any) {
        // Ignore if already attached
        if (!e.message?.includes("already in use") && !e.message?.includes("already exists")) {
          console.error("[Joins] Failed to attach user_db:", e);
        }
      }

      // 2. Fetch Use Case 1: Delivery Routing (Collab order motions + User route shortcut notes)
      const deliveries = await db.all(`
        SELECT 
          o.id as motion_id,
          o.stream as order_id,
          o.status as order_status,
          o.delta as order_amount,
          o.data as order_data,
          m.title as food_title,
          u.title as private_title,
          u.data as private_data
        FROM motion o
        INNER JOIN matter m ON o.stream = m.id
        LEFT JOIN user_db.matter u ON o.stream = u.id
        WHERE o.scope = 'delivery' AND o.action = 201
      `);
      setDeliveryData(deliveries || []);

      // 3. Fetch Use Case 2: Store Inventory Margins (Collab active stock mass + User supplier costs note)
      const margins = await db.all(`
        SELECT 
          m.id as product_id,
          m.title as product_title,
          m.code as sku,
          mas.qty as stock_qty,
          mas.value as retail_price,
          u.data as supplier_data
        FROM matter m
        INNER JOIN mass mas ON m.id = mas.matter
        LEFT JOIN user_db.matter u ON m.id = u.id
        WHERE m.type = 'product' AND mas.type = 'stock'
      `);
      setMarginData(margins || []);

      // 4. Fetch Use Case 3: Dispatch & Tool Checklist (Collab scheduling mass + User tools belt note)
      const dispatches = await db.all(`
        SELECT 
          m.id as job_id,
          m.title as job_title,
          m.code as job_code,
          mas.start as scheduled_start,
          mas.data as job_data,
          u.data as tools_data
        FROM matter m
        INNER JOIN mass mas ON m.id = mas.matter
        LEFT JOIN user_db.matter u ON u.id = 'technician_tools'
        WHERE m.scope = 'dispatch' AND mas.scope = 'dispatch'
      `);
      setDispatchData(dispatches || []);

    } catch (e: any) {
      console.error("[Joins] Query resolution error:", e);
      Alert.alert("Cross-DB Query Error", e.message || "Failed to execute cross-database join query.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadJoinedData();
    }, [])
  );

  const renderDeliveryTab = () => {
    if (deliveryData.length === 0) {
      return <Text style={styles.emptyText}>No delivery dispatch orders found.</Text>;
    }

    return (
      <View style={styles.tabContent}>
        <Text style={styles.useCaseDescription}>
          Combines live kitchen order queue (Collaborative Cloud DB) with the driver's private contact shortcut instructions (Local User DB) via ATTACH DATABASE.
        </Text>
        
        {deliveryData.map((item) => {
          let parsedOrderData = { delivery_address: "" };
          let parsedPrivateData = { shortcut: "", contact_name: "" };
          try { if (item.order_data) parsedOrderData = JSON.parse(item.order_data); } catch {}
          try { if (item.private_data) parsedPrivateData = JSON.parse(item.private_data); } catch {}

          return (
            <View key={item.motion_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardBadge}>COLLAB DB</Text>
                  <Text style={styles.cardTitle}>{item.food_title || "Order"}</Text>
                  <Text style={styles.cardSubtitle}>SKU: {item.order_id} • Value: ₹{item.order_amount}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.order_status}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {parsedOrderData.delivery_address || "No address provided"}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.privateBlock}>
                <View style={styles.privateHeader}>
                  <Ionicons name="lock-closed" size={14} color="#6366f1" style={{ marginRight: 4 }} />
                  <Text style={styles.privateTag}>USER DB (LOCAL ONLY PRIVATE DATA)</Text>
                </View>
                <Text style={styles.privateCustomer}>
                  Customer Name: <Text style={{ fontWeight: "700", color: "#1e293b" }}>{parsedPrivateData.contact_name || "N/A"}</Text>
                </Text>
                <Text style={styles.privateNote}>
                  Shortcut: "{parsedPrivateData.shortcut || "None"}"
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderMarginsTab = () => {
    if (marginData.length === 0) {
      return <Text style={styles.emptyText}>No inventory products found.</Text>;
    }

    return (
      <View style={styles.tabContent}>
        <Text style={styles.useCaseDescription}>
          Joins active warehouse stock counts and retail prices (Collaborative DB) with private owner-negotiated supplier invoice costs (Local User DB) to calculate net profits.
        </Text>

        {marginData.map((item) => {
          let parsedSupplierData = { supplier_cost: 0, supplier_name: "" };
          try { if (item.supplier_data) parsedSupplierData = JSON.parse(item.supplier_data); } catch {}

          const qty = item.stock_qty || 0;
          const retail = item.retail_price || 0;
          const cost = parsedSupplierData.supplier_cost || 0;
          
          const unitProfit = retail - cost;
          const totalProfit = unitProfit * qty;
          const marginPercent = retail > 0 ? Math.round((unitProfit / retail) * 100) : 0;

          return (
            <View key={item.product_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardBadge}>COLLAB DB</Text>
                  <Text style={styles.cardTitle}>{item.product_title || "Product"}</Text>
                  <Text style={styles.cardSubtitle}>SKU: {item.sku} • Stock Count: {qty} units</Text>
                </View>
                <View style={styles.retailPriceBadge}>
                  <Text style={styles.retailPriceBadgeText}>₹{retail} Retail</Text>
                </View>
              </View>

              <View style={styles.marginStatsGrid}>
                <View style={styles.marginStatItem}>
                  <Text style={styles.marginStatLabel}>Retail Value</Text>
                  <Text style={[styles.marginStatValue, { color: "#1e293b" }]}>₹{retail * qty}</Text>
                </View>
                <View style={styles.marginStatItem}>
                  <Text style={styles.marginStatLabel}>Supplier Cost</Text>
                  <Text style={[styles.marginStatValue, { color: "#e11d48" }]}>₹{cost * qty}</Text>
                </View>
                <View style={styles.marginStatItem}>
                  <Text style={styles.marginStatLabel}>Est. Net Profit</Text>
                  <Text style={[styles.marginStatValue, { color: "#16a34a" }]}>₹{totalProfit}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.privateBlock}>
                <View style={styles.privateHeader}>
                  <Ionicons name="lock-closed" size={14} color="#6366f1" style={{ marginRight: 4 }} />
                  <Text style={styles.privateTag}>USER DB (PRIVATE SUPPLIER CONTRACT)</Text>
                </View>
                <Text style={styles.privateCustomer}>
                  Supplier: <Text style={{ fontWeight: "700", color: "#1e293b" }}>{parsedSupplierData.supplier_name || "N/A"}</Text>
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={styles.privateNote}>
                    Unit Purchase Cost: ₹{cost}
                  </Text>
                  <Text style={[styles.privateNote, { color: "#16a34a", fontWeight: "700" }]}>
                    {marginPercent}% Margin
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderDispatchTab = () => {
    if (dispatchData.length === 0) {
      return <Text style={styles.emptyText}>No field dispatch tasks found.</Text>;
    }

    return (
      <View style={styles.tabContent}>
        <Text style={styles.useCaseDescription}>
          Joins scheduled plumbing dispatch repair appointments (Collaborative DB) with the technician's private toolbelt checklist (Local User DB) to alert if required safety tools are missing.
        </Text>

        {dispatchData.map((item) => {
          let parsedJobData = { required_tool: "" };
          let parsedToolsData = { tools: [] as string[] };
          try { if (item.job_data) parsedJobData = JSON.parse(item.job_data); } catch {}
          try { if (item.tools_data) parsedToolsData = JSON.parse(item.tools_data); } catch {}

          const requiredTool = parsedJobData.required_tool || "gas_leak_detector";
          const hasTool = parsedToolsData.tools.includes(requiredTool);

          return (
            <View key={item.job_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardBadge}>COLLAB DB</Text>
                  <Text style={styles.cardTitle}>{item.job_title || "Dispatch Job"}</Text>
                  <Text style={styles.cardSubtitle}>Job Code: {item.job_code}</Text>
                </View>
                <View style={[styles.safetyBadge, { backgroundColor: hasTool ? "#dcfce7" : "#ffe4e6" }]}>
                  <Text style={[styles.safetyBadgeText, { color: hasTool ? "#16a34a" : "#ef4444" }]}>
                    {hasTool ? "Safe" : "Warning"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
                <Text style={styles.infoText}>
                  Scheduled: {new Date(item.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Today
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.privateBlock}>
                <View style={styles.privateHeader}>
                  <Ionicons name="lock-closed" size={14} color="#6366f1" style={{ marginRight: 4 }} />
                  <Text style={styles.privateTag}>USER DB (TECHNICIAN'S TOOL BELT CHECKLIST)</Text>
                </View>
                <Text style={styles.privateCustomer}>
                  Required Tool: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: "bold" }}>{requiredTool}</Text>
                </Text>
                
                {!hasTool ? (
                  <View style={styles.alertRow}>
                    <Ionicons name="warning" size={18} color="#ef4444" style={{ marginRight: 6 }} />
                    <Text style={styles.alertText}>
                      Missing tool! Clean tool belt does not contain "{requiredTool}". Pack before departure.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.alertRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#16a34a" style={{ marginRight: 6 }} />
                    <Text style={[styles.alertText, { color: "#16a34a" }]}>
                      Tool confirmed in personal toolbelt list. Ready to proceed.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        
        {/* Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cross-DB Analytics</Text>
          <TouchableOpacity onPress={loadJoinedData} style={styles.reloadBtn}>
            <Ionicons name="refresh" size={20} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          {(["delivery", "margins", "dispatch"] as TabType[]).map((tab) => {
            const active = activeTab === tab;
            const label = tab === "delivery" ? "Delivery" : tab === "margins" ? "Net Profit" : "Safety Check";
            const icon = tab === "delivery" ? "bicycle-outline" : tab === "margins" ? "cash-outline" : "shield-checkmark-outline";
            
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, active && styles.activeTabButton]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons name={icon} size={16} color={active ? "#6366f1" : "#64748b"} style={{ marginBottom: 2 }} />
                <Text style={[styles.tabText, active && styles.activeTabText]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Scrollable Contents */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Executing Cross-DB Join Queries...</Text>
          </View>
        ) : (
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          >
            {activeTab === "delivery" && renderDeliveryTab()}
            {activeTab === "margins" && renderMarginsTab()}
            {activeTab === "dispatch" && renderDispatchTab()}
          </ScrollView>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  reloadBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: "#f1f2ff",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  activeTabText: {
    color: "#6366f1",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  tabContent: {
    flex: 1,
  },
  useCaseDescription: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 20,
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 60,
    fontSize: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "500",
  },
  statusBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  retailPriceBadge: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retailPriceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284c7",
  },
  safetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  safetyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
  privateBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  privateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  privateTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6366f1",
    letterSpacing: 0.5,
  },
  privateCustomer: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 2,
  },
  privateNote: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },
  marginStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  marginStatItem: {
    flex: 1,
  },
  marginStatLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  marginStatValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  alertText: {
    fontSize: 12,
    color: "#e11d48",
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },
});
