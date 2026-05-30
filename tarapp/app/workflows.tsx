import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { 
  getSelfId, 
  routeDbForEntity, 
  getPrimarySyncDb, 
  isCollabSyncEnabled 
} from "../lib/db";

type WorkflowTab = "pos" | "delivery";

export default function WorkflowsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<WorkflowTab>("pos");
  const [selfId, setSelfId] = useState<string>("guest");
  const [syncEnabled, setSyncEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<any[]>([]);

  // POS State
  const [isClockedIn, setIsClockedIn] = useState<boolean>(false);
  const [shiftSales, setShiftSales] = useState<number>(0);
  const [lastActionText, setLastActionText] = useState<string>("No shift active");

  // Delivery State
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string>("NO_ORDER");
  const [etaText, setEtaText] = useState<string>("N/A");

  useEffect(() => {
    async function loadConfig() {
      const id = await getSelfId();
      setSelfId(id);
      const col = await isCollabSyncEnabled();
      setSyncEnabled(col);
      refreshLogs(id);
    }
    loadConfig();
  }, []);

  const refreshLogs = async (userId: string) => {
    try {
      // Get all transactions logged in either database for this user
      const privateDb = routeDbForEntity("motion", "p");
      const syncDb = routeDbForEntity("motion", "s:pos");

      const privateRows = await privateDb.all(
        "SELECT *, 'Local Private DB' as dbSource FROM motion ORDER BY time DESC LIMIT 5"
      );
      const syncRows = await syncDb.all(
        "SELECT *, 'Remote Sync DB' as dbSource FROM motion ORDER BY time DESC LIMIT 5"
      );

      const allLogs = [...privateRows, ...syncRows].sort((a, b) => 
        String(b.time || "").localeCompare(String(a.time || ""))
      );
      setLogs(allLogs);

      // Restore states from database logs
      const clockInLogs = syncRows.filter((r: any) => r.action === 501);
      const clockOutLogs = syncRows.filter((r: any) => r.action === 204);
      if (clockInLogs.length > 0) {
        const lastClockInTime = new Date(String(clockInLogs[0].time || "")).getTime();
        const lastClockOutTime = clockOutLogs.length > 0 ? new Date(String(clockOutLogs[0].time || "")).getTime() : 0;
        setIsClockedIn(lastClockInTime > lastClockOutTime);
      }

      // Calculate shift sales (Opcode 201)
      const salesLogs = syncRows.filter((r: any) => r.action === 201);
      const salesTotal = salesLogs.reduce((sum: number, log: any) => sum + (Number(log.delta) || 0), 0);
      setShiftSales(salesTotal);

      // Restore delivery status from database logs
      const deliveryLogs = syncRows.filter((r: any) => r.scope === "delivery");
      if (deliveryLogs.length > 0) {
        const lastDeliv = deliveryLogs[0];
        setActiveOrderId(lastDeliv.stream ? String(lastDeliv.stream) : null);
        setDeliveryStatus(lastDeliv.status ? String(lastDeliv.status) : "UNKNOWN");
        try {
          const payload = JSON.parse(lastDeliv.data ? String(lastDeliv.data) : "{}");
          setEtaText(payload.eta ? String(payload.eta) : "N/A");
        } catch (_) {
          setEtaText("N/A");
        }
      }
    } catch (e) {
      console.warn("Failed to load logs:", e);
    }
  };

  const handlePOSAction = async (actionType: "CLOCK_IN" | "SALE_FOOD" | "SALE_DRINK" | "CLOCK_OUT") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const time = new Date().toISOString();
      const streamId = `shift_pos_${selfId}`;
      const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Select database: POS actions are collaborative (routed to sync database)
      const targetScope = "s:pos";
      const db = routeDbForEntity("motion", targetScope);

      const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [streamId]);
      const nextSeq = seqRow[0]?.next_seq || 1;

      let opcode = 100;
      let status = "COMPLETED";
      let delta: number | null = null;
      let dataPayload = {};

      if (actionType === "CLOCK_IN") {
        opcode = 501; // CLOCK_IN (Roster clock-in)
        status = "CLOCKED_IN";
        dataPayload = { role: "cashier", location: "Till 1" };
        setLastActionText("Clocked in successfully");
      } else if (actionType === "SALE_FOOD") {
        opcode = 201; // SALE (Point of sale transaction)
        delta = 150.00; // Food Cost (INR)
        dataPayload = { item: "Paneer Biryani", qty: 1 };
        setLastActionText("Logged Paneer Biryani Sale (+₹150)");
      } else if (actionType === "SALE_DRINK") {
        opcode = 201; // SALE
        delta = 50.00; // Drink Cost (INR)
        dataPayload = { item: "Mango Lassi", qty: 1 };
        setLastActionText("Logged Mango Lassi Sale (+₹50)");
      } else if (actionType === "CLOCK_OUT") {
        opcode = 204; // SHIFT_END
        status = "OFFLINE";
        dataPayload = { closing_balance: shiftSales };
        setLastActionText("Closed Till Shift successfully");
      }

      await db.run(
        "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [motionId, streamId, nextSeq, opcode, status, delta, targetScope, JSON.stringify(dataPayload), time]
      );

      // Perform background push to sync database immediately if online sync is active
      if (syncEnabled) {
        await db.push().catch((err) => console.warn("Failed to push sync:", err));
      }

      await refreshLogs(selfId);
    } catch (e: any) {
      Alert.alert("Execution Failed", e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeliveryAction = async (actionType: "NEW_ORDER" | "DISPATCH" | "UPDATE_ETA" | "DELIVERED") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const time = new Date().toISOString();
      const targetScope = "delivery";
      const db = routeDbForEntity("motion", targetScope);

      let orderId = activeOrderId;
      if (actionType === "NEW_ORDER" || !orderId) {
        orderId = `ord_deliv_${Date.now()}`;
        setActiveOrderId(orderId);
      }

      const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [orderId]);
      const nextSeq = seqRow[0]?.next_seq || 1;

      let opcode = 100;
      let status = "PENDING";
      let dataPayload = {};

      if (actionType === "NEW_ORDER") {
        opcode = 105; // ORDER_PLACED (Append-only ledger entry)
        status = "PLACED";
        dataPayload = { items: "Spicy Biryani + Lassi", address: "128 Oak Avenue" };
        setLastActionText(`Created new Delivery Order: ${orderId.replace("ord_deliv_", "#")}`);
      } else if (actionType === "DISPATCH") {
        opcode = 401; // DISPATCHED
        status = "DISPATCHED";
        dataPayload = { courier: "Courier Driver 12" };
        setLastActionText("Order dispatched to courier");
      } else if (actionType === "UPDATE_ETA") {
        opcode = 404; // ETA_UPDATED
        status = "IN_TRANSIT";
        const newEta = new Date(Date.now() + 25 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        dataPayload = { eta: newEta };
        setLastActionText(`ETA Updated to ${newEta}`);
      } else if (actionType === "DELIVERED") {
        opcode = 109; // DELIVERED
        status = "DELIVERED";
        dataPayload = { delivery_time: time, status: "COMPLETED" };
        setLastActionText("Order successfully delivered!");
      }

      await db.run(
        "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          orderId,
          nextSeq,
          opcode,
          status,
          null,
          targetScope,
          JSON.stringify(dataPayload),
          time
        ]
      );

      if (syncEnabled) {
        await db.push().catch((err) => console.warn("Failed to push sync:", err));
      }

      await refreshLogs(selfId);
    } catch (e: any) {
      Alert.alert("Execution Failed", e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllWorkflowsData = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Reset Workspace",
      "Are you sure you want to clear POS & Delivery logs from both local and sync databases?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const privateDb = routeDbForEntity("motion", "p");
              const syncDb = routeDbForEntity("motion", "s:pos");

              // Clear only our workflow related logs to protect user notes
              await privateDb.run("DELETE FROM motion WHERE scope = 'p' AND stream LIKE 'shift%'");
              await syncDb.run("DELETE FROM motion WHERE scope = 's:pos' OR scope = 'delivery'");

              if (syncEnabled) {
                await syncDb.push().catch((err) => console.warn("Failed to push sync reset:", err));
              }

              setIsClockedIn(false);
              setShiftSales(0);
              setActiveOrderId(null);
              setDeliveryStatus("NO_ORDER");
              setEtaText("N/A");
              setLastActionText("Reset completed");
              await refreshLogs(selfId);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to reset data");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const getOpcodeBadge = (action: number) => {
    let text = `OP ${action}`;
    let bg = "#f1f5f9";
    let color = "#475569";

    if (action === 501 || action === 204) {
      bg = "#e0e7ff";
      color = "#4f46e5";
      text = action === 501 ? "CLOCK IN" : "CLOCK OUT";
    } else if (action === 201) {
      bg = "#d1fae5";
      color = "#059669";
      text = "SALE";
    } else if (action === 105) {
      bg = "#fef3c7";
      color = "#d97706";
      text = "NEW ORDER";
    } else if (action === 401 || action === 404) {
      bg = "#dbeafe";
      color = "#2563eb";
      text = action === 401 ? "DISPATCHED" : "ETA UPDATED";
    } else if (action === 109) {
      bg = "#fce7f3";
      color = "#db2777";
      text = "DELIVERED";
    }

    return (
      <View style={[styles.opcodeBadge, { backgroundColor: bg }]}>
        <Text style={[styles.opcodeText, { color: color }]}>{text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Modern Header Row */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.replace("/")}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workflow Playground</Text>
        <TouchableOpacity 
          style={styles.resetBtn}
          onPress={clearAllWorkflowsData}
          disabled={isLoading}
        >
          <Ionicons name="refresh-circle-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Connection status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={[styles.dot, { backgroundColor: syncEnabled ? "#10b981" : "#f59e0b" }]} />
              <Text style={styles.statusTitle}>
                {syncEnabled ? "Turso Synced (Plan 2)" : "Local Offline (Plan 1)"}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selfId.substring(0, 10)}...</Text>
            </View>
          </View>
          <Text style={styles.statusDesc}>
            {syncEnabled 
              ? `Workspace acts as an owner database sync context. Collaborative opcodes automatically update the remote Turso instance u${selfId}.` 
              : "Private local-only workspace. All changes reside strictly inside the on-device SQLite database file."}
          </Text>
        </View>

        {/* Tab Controls */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "pos" && styles.tabButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("pos");
            }}
          >
            <Ionicons name="calculator-outline" size={18} color={activeTab === "pos" ? "#6366f1" : "#64748b"} />
            <Text style={[styles.tabButtonText, activeTab === "pos" && styles.tabButtonTextActive]}>
              POS Till Shop
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "delivery" && styles.tabButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("delivery");
            }}
          >
            <Ionicons name="bicycle-outline" size={18} color={activeTab === "delivery" ? "#6366f1" : "#64748b"} />
            <Text style={[styles.tabButtonText, activeTab === "delivery" && styles.tabButtonTextActive]}>
              Delivery Courier
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content 1: POS TILL */}
        {activeTab === "pos" && (
          <View style={styles.tabContent}>
            {/* Till status overview */}
            <View style={styles.overviewBox}>
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>TILL STATE</Text>
                <Text style={[styles.overviewVal, { color: isClockedIn ? "#10b981" : "#64748b" }]}>
                  {isClockedIn ? "CLOCKED IN" : "CLOSED"}
                </Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>SHIFT SALES</Text>
                <Text style={styles.overviewVal}>₹{shiftSales}</Text>
              </View>
            </View>

            {/* Quick Actions Grid */}
            <Text style={styles.sectionLabel}>Shift Management Actions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={[styles.actionBtn, isClockedIn && styles.actionBtnDisabled]}
                onPress={() => handlePOSAction("CLOCK_IN")}
                disabled={isClockedIn || isLoading}
              >
                <Ionicons name="time" size={24} color={isClockedIn ? "#94a3b8" : "#4f46e5"} />
                <Text style={[styles.actionBtnText, isClockedIn && styles.actionBtnTextDisabled]}>Clock In</Text>
                <Text style={styles.actionOpcode}>Opcode 501 (HR)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, !isClockedIn && styles.actionBtnDisabled]}
                onPress={() => handlePOSAction("CLOCK_OUT")}
                disabled={!isClockedIn || isLoading}
              >
                <Ionicons name="log-out" size={24} color={!isClockedIn ? "#94a3b8" : "#db2777"} />
                <Text style={[styles.actionBtnText, !isClockedIn && styles.actionBtnTextDisabled]}>Clock Out</Text>
                <Text style={styles.actionOpcode}>Opcode 204 (End)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Sales Transactions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={[styles.actionBtn, !isClockedIn && styles.actionBtnDisabled]}
                onPress={() => handlePOSAction("SALE_FOOD")}
                disabled={!isClockedIn || isLoading}
              >
                <Ionicons name="fast-food-outline" size={24} color={!isClockedIn ? "#94a3b8" : "#10b981"} />
                <Text style={[styles.actionBtnText, !isClockedIn && styles.actionBtnTextDisabled]}>Paneer Biryani</Text>
                <Text style={styles.actionSubtext}>₹150.00</Text>
                <Text style={styles.actionOpcode}>Opcode 201 (Sale)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, !isClockedIn && styles.actionBtnDisabled]}
                onPress={() => handlePOSAction("SALE_DRINK")}
                disabled={!isClockedIn || isLoading}
              >
                <Ionicons name="beer-outline" size={24} color={!isClockedIn ? "#94a3b8" : "#059669"} />
                <Text style={[styles.actionBtnText, !isClockedIn && styles.actionBtnTextDisabled]}>Mango Lassi</Text>
                <Text style={styles.actionSubtext}>₹50.00</Text>
                <Text style={styles.actionOpcode}>Opcode 201 (Sale)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab Content 2: DELIVERY DISPATCH */}
        {activeTab === "delivery" && (
          <View style={styles.tabContent}>
            {/* Courier Order Overview */}
            <View style={styles.overviewBox}>
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>ACTIVE ORDER</Text>
                <Text style={styles.overviewVal}>
                  {activeOrderId ? activeOrderId.substring(10, 18) : "None"}
                </Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>STATUS</Text>
                <Text style={[styles.overviewVal, { color: deliveryStatus === "DELIVERED" ? "#10b981" : "#2563eb" }]}>
                  {deliveryStatus}
                </Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>ETA</Text>
                <Text style={styles.overviewVal}>{etaText}</Text>
              </View>
            </View>

            {/* Delivery Workflow Steps */}
            <Text style={styles.sectionLabel}>Logistics Sequence</Text>
            
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleDeliveryAction("NEW_ORDER")}
                disabled={isLoading}
              >
                <View style={styles.stepBtnHeader}>
                  <Text style={styles.stepBtnTitle}>1. Create Delivery Order</Text>
                  <Text style={styles.stepOpcode}>Opcode 105</Text>
                </View>
                <Text style={styles.stepBtnDesc}>Initializes order record on collaborative sync database.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepBadge, !activeOrderId && styles.stepBadgeDisabled]}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, !activeOrderId && styles.stepBtnDisabled]}
                onPress={() => handleDeliveryAction("DISPATCH")}
                disabled={!activeOrderId || isLoading}
              >
                <View style={styles.stepBtnHeader}>
                  <Text style={[styles.stepBtnTitle, !activeOrderId && styles.stepBtnTitleDisabled]}>2. Dispatch Rider</Text>
                  <Text style={styles.stepOpcode}>Opcode 401</Text>
                </View>
                <Text style={styles.stepBtnDesc}>Dispatches assignment payload to driver logs.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepBadge, (!activeOrderId || deliveryStatus === "PLACED") && styles.stepBadgeDisabled]}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, (!activeOrderId || deliveryStatus === "PLACED") && styles.stepBtnDisabled]}
                onPress={() => handleDeliveryAction("UPDATE_ETA")}
                disabled={!activeOrderId || deliveryStatus === "PLACED" || isLoading}
              >
                <View style={styles.stepBtnHeader}>
                  <Text style={[styles.stepBtnTitle, (!activeOrderId || deliveryStatus === "PLACED") && styles.stepBtnTitleDisabled]}>3. Update Live ETA</Text>
                  <Text style={styles.stepOpcode}>Opcode 404</Text>
                </View>
                <Text style={styles.stepBtnDesc}>Recalculates courier route ETA and pushes transit updates.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepBadge, deliveryStatus !== "IN_TRANSIT" && styles.stepBadgeDisabled]}>
                <Text style={styles.stepBadgeText}>4</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, deliveryStatus !== "IN_TRANSIT" && styles.stepBtnDisabled]}
                onPress={() => handleDeliveryAction("DELIVERED")}
                disabled={deliveryStatus !== "IN_TRANSIT" || isLoading}
              >
                <View style={styles.stepBtnHeader}>
                  <Text style={[styles.stepBtnTitle, deliveryStatus !== "IN_TRANSIT" && styles.stepBtnTitleDisabled]}>4. Confirm Delivery</Text>
                  <Text style={styles.stepOpcode}>Opcode 109</Text>
                </View>
                <Text style={styles.stepBtnDesc}>Concludes order flow with successful receipt signature.</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Console / Last Action log */}
        <View style={styles.actionConsole}>
          <Text style={styles.consoleTitle}>STATUS FEEDBACK</Text>
          <Text style={styles.consoleText}>
            {isLoading ? "Running query..." : lastActionText}
          </Text>
        </View>

        {/* Live Database Log Table */}
        <Text style={styles.sectionLabel}>Active Ledger Entries (Last 5 Logs)</Text>
        <View style={styles.logTable}>
          {logs.length === 0 ? (
            <Text style={styles.emptyLogsText}>No ledger logs yet. Perform actions above to write entries.</Text>
          ) : (
            logs.map((log: any) => {
              let payloadStr = "{}";
              try {
                payloadStr = log.data ? JSON.stringify(JSON.parse(log.data)) : "{}";
              } catch (_) {}

              return (
                <View key={log.id} style={styles.logRow}>
                  <View style={styles.logRowHeader}>
                    {getOpcodeBadge(log.action)}
                    <View style={[styles.dbBadge, { backgroundColor: log.dbSource.includes("Remote") ? "#dbeafe" : "#f1f5f9" }]}>
                      <Text style={[styles.dbBadgeText, { color: log.dbSource.includes("Remote") ? "#2563eb" : "#475569" }]}>
                        {log.dbSource}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.logDetails} numberOfLines={2}>
                    ID: {log.id.substring(0, 16)}... | Status: {log.status} | Data: {payloadStr}
                  </Text>
                  <Text style={styles.logTime}>
                    {new Date(log.time).toLocaleTimeString()} - {log.stream.replace("shift_pos_", "")}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 6,
  },
  resetBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  badge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  statusDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#6366f1",
  },
  tabContent: {
    width: "100%",
  },
  overviewBox: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    marginBottom: 20,
  },
  overviewCol: {
    flex: 1,
    alignItems: "center",
  },
  overviewDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#cbd5e1",
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  overviewVal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  actionBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#f8fafc",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 4,
  },
  actionBtnTextDisabled: {
    color: "#94a3b8",
  },
  actionSubtext: {
    fontSize: 12,
    color: "#64748b",
  },
  actionOpcode: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 10,
  },
  stepBadgeDisabled: {
    backgroundColor: "#cbd5e1",
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  stepBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
  },
  stepBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#f8fafc",
  },
  stepBtnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stepBtnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  stepBtnTitleDisabled: {
    color: "#94a3b8",
  },
  stepOpcode: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6366f1",
  },
  stepBtnDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  actionConsole: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  consoleTitle: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1,
    marginBottom: 4,
  },
  consoleText: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#38bdf8",
    fontWeight: "600",
  },
  logTable: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  emptyLogsText: {
    padding: 20,
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
  logRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  logRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  opcodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  opcodeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  dbBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dbBadgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  logDetails: {
    fontSize: 13,
    color: "#1e293b",
    lineHeight: 18,
    marginBottom: 4,
  },
  logTime: {
    fontSize: 10,
    color: "#94a3b8",
  }
});
