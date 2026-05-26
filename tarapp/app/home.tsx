import React, { useState, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { getUserDb, getCollabDb } from "../lib/db";
import { setActiveMassId } from "../lib/state";

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

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { massId } = useLocalSearchParams<{ massId: string }>();
  
  const [futureItems, setFutureItems] = useState<any[]>([]);
  const [nowItems, setNowItems] = useState<any[]>([]);
  const [pastItems, setPastItems] = useState<any[]>([]);
  const [selectedMass, setSelectedMass] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          const uDb = getUserDb();
          const tDb = getCollabDb();
          
          const nowStr = new Date().toISOString();
          
          // 1. Load Future Items (active slots in mass starting in the future)
          const futureQuery = `
            SELECT m.*, t.title, 'user' as originDb 
            FROM mass m 
            LEFT JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 AND m.type = 'slot' AND (m.scope = 'reminder' OR m.scope = 'deadline') AND m.start > ?
          `;
          const futureTenantQuery = `
            SELECT m.*, t.title, 'tenant' as originDb 
            FROM mass m 
            LEFT JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 AND m.type = 'slot' AND (m.scope = 'reminder' OR m.scope = 'deadline') AND m.start > ?
          `;
          
          let uFuture = await uDb.all(futureQuery, [nowStr]);
          let tFuture = await tDb.all(futureTenantQuery, [nowStr]);
          
          const combinedFuture = [...(Array.isArray(uFuture) ? uFuture : []), ...(Array.isArray(tFuture) ? tFuture : [])]
            .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
            
          setFutureItems(combinedFuture);

          // 2. Load Now Items (current slots occurring now OR active pending motions)
          const nowSlotsQuery = `
            SELECT m.*, t.title, 'user' as originDb
            FROM mass m 
            LEFT JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 AND m.type = 'slot' AND m.start <= ? AND (m.end IS NULL OR m.end >= ?)
          `;
          const nowSlotsTenantQuery = `
            SELECT m.*, t.title, 'tenant' as originDb
            FROM mass m 
            LEFT JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 AND m.type = 'slot' AND m.start <= ? AND (m.end IS NULL OR m.end >= ?)
          `;
          
          let uNowSlots = await uDb.all(nowSlotsQuery, [nowStr, nowStr]);
          let tNowSlots = await tDb.all(nowSlotsTenantQuery, [nowStr, nowStr]);

          // Determine the active job status from active slots occurring now
          const allNowSlots = [...(Array.isArray(uNowSlots) ? uNowSlots : []), ...(Array.isArray(tNowSlots) ? tNowSlots : [])];
          const activeSlotWithScope = allNowSlots.find(s => s.scope);
          if (activeSlotWithScope) {
            setActiveJob(activeSlotWithScope.scope ? String(activeSlotWithScope.scope) : null);
          } else if (allNowSlots.length > 0) {
            const firstSlot = allNowSlots[0];
            const fallbackTitle = firstSlot.title || firstSlot.scope;
            setActiveJob(fallbackTitle ? String(fallbackTitle) : "shift");
          } else {
            setActiveJob(null);
          }
          
          const activeSlots = allNowSlots
            .map(s => ({
              id: s.id,
              isMass: true,
              originDb: s.originDb,
              title: s.scope === "reminder" ? "Reminder Active" : "Active Slot",
              subtitle: s.title || "Active Item",
              time: s.start,
              action: s.scope === "reminder" ? 105 : 100,
              status: "ACTIVE",
              raw: s
            }));

          const uPendingMotions = await uDb.all("SELECT *, 'user' as originDb FROM motion WHERE status != 'COMPLETED' AND action != 1 ORDER BY time DESC LIMIT 20");
          const tPendingMotions = await tDb.all("SELECT *, 'tenant' as originDb FROM motion WHERE status != 'COMPLETED' AND action != 1 ORDER BY time DESC LIMIT 20");
          
          const pendingMotions = [...(Array.isArray(uPendingMotions) ? uPendingMotions : []), ...(Array.isArray(tPendingMotions) ? tPendingMotions : [])];

          // Load pending tasks (matter records of type 'task' that do not have a COMPLETED motion log)
          const pendingTasksQuery = `
            SELECT m.*, 'user' as originDb
            FROM matter m
            WHERE m.type = 'task'
              AND NOT EXISTS (
                SELECT 1 FROM motion mot
                WHERE mot.stream = m.id AND (mot.status = 'COMPLETED' OR mot.action = 200)
              )
          `;
          const pendingTasksTenantQuery = `
            SELECT m.*, 'tenant' as originDb
            FROM matter m
            WHERE m.type = 'task'
              AND NOT EXISTS (
                SELECT 1 FROM motion mot
                WHERE mot.stream = m.id AND (mot.status = 'COMPLETED' OR mot.action = 200)
              )
          `;

          const uTasks = await uDb.all(pendingTasksQuery).catch(() => []);
          const tTasks = await tDb.all(pendingTasksTenantQuery).catch(() => []);

          const taskItems = [...(Array.isArray(uTasks) ? uTasks : []), ...(Array.isArray(tTasks) ? tTasks : [])]
            .map(t => ({
              id: t.id,
              isTaskMatter: true,
              originDb: t.originDb,
              title: "Task Pending",
              subtitle: t.title || "Untitled Task",
              time: t.time || nowStr,
              action: 200,
              status: "PENDING",
              raw: t
            }));

          const combinedNow = [...activeSlots, ...pendingMotions, ...taskItems];
          const groupedNow = groupOrderItems(combinedNow)
            .sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
            
          setNowItems(groupedNow);

          // 3. Load Past Items (completed motions, receipts, logs)
          const uPastMotions = await uDb.all("SELECT *, 'user' as originDb FROM motion WHERE status = 'COMPLETED' OR action = 1 ORDER BY time DESC LIMIT 30");
          const tPastMotions = await tDb.all("SELECT *, 'tenant' as originDb FROM motion WHERE status = 'COMPLETED' OR action = 1 ORDER BY time DESC LIMIT 30");
          
          const combinedPast = [...(Array.isArray(uPastMotions) ? uPastMotions : []), ...(Array.isArray(tPastMotions) ? tPastMotions : [])];
          const groupedPast = groupOrderItems(combinedPast)
            .sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")))
            .slice(0, 40);
            
          setPastItems(groupedPast);

          // Load selected mass overlay if any
          if (massId) {
            let massRow = await uDb.all(
              `SELECT m.*, t.title FROM mass m LEFT JOIN matter t ON m.matter = t.id WHERE m.id = ?`, 
              [massId]
            );
            if (!Array.isArray(massRow) || massRow.length === 0) {
              massRow = await tDb.all(
                `SELECT m.*, t.title FROM mass m LEFT JOIN matter t ON m.matter = t.id WHERE m.id = ?`, 
                [massId]
              );
            }
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

  const handleMarkDone = async (item: any) => {
    try {
      const uDb = getUserDb();
      const tDb = getCollabDb();
      const db = item.originDb === 'user' ? uDb : tDb;
      
      if (item.isMass) {
        // Deactivate the mass scheduled reminder/slot
        await db.run("UPDATE mass SET active = 0 WHERE id = ?", [item.id]);
        
        // Log a completed motion log
        const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [item.raw.matter]);
        const seq = seqRow[0]?.next_seq || 1;
        
        await db.run(
          "INSERT INTO motion (id, stream, seq, action, status, delta, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            motionId,
            item.raw.matter,
            seq,
            item.raw.scope === "reminder" ? 105 : 200,
            "COMPLETED",
            null,
            JSON.stringify({ task: item.subtitle, completed_at: new Date().toISOString() })
          ]
        );
      } else if (item.isTaskMatter) {
        // Mark task done by inserting a completed motion log for this matter stream
        const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [item.id]);
        const seq = seqRow[0]?.next_seq || 1;
        
        await db.run(
          "INSERT INTO motion (id, stream, seq, action, status, delta, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            motionId,
            item.id,
            seq,
            200, // Action 200 for Task Completion
            "COMPLETED",
            null,
            JSON.stringify({ task: item.subtitle, completed_at: new Date().toISOString() })
          ]
        );
      } else {
        // Complete the motion task
        await db.run("UPDATE motion SET status = 'COMPLETED' WHERE id = ?", [item.id]);
      }
      // Sync to Turso in the background
      db.push().catch(e => console.error("Background sync failed:", e));
    } catch (e) {
      console.error("Failed to mark done:", e);
    }
  };

  const renderMassCard = (item: any) => {
    const isReminder = item.scope === 'reminder';
    const displayTime = new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const displayDate = new Date(item.start).toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
      <View key={`${item.originDb}_${item.id}`} style={styles.motionItem}>
        <View style={styles.motionItemLeft}>
          <TouchableOpacity 
            style={styles.statusWrapper}
            onPress={() => handleMarkDone({ id: item.id, isMass: true, originDb: item.originDb, subtitle: item.title || "Reminder", raw: item })}
          >
            <Ionicons 
              name="ellipse-outline" 
              size={22} 
              color={isReminder ? "#2563eb" : "#ea580c"} 
            />
          </TouchableOpacity>
          <View style={styles.motionTextContainer}>
            <Text style={styles.motionTitle} numberOfLines={1}>
              {item.title || "Scheduled slot"}
            </Text>
          </View>
        </View>
        <View style={styles.motionItemRight}>
          <Text style={styles.futureTimeText}>{displayDate} {displayTime}</Text>
        </View>
      </View>
    );
  };

  const renderTaskMatterCard = (item: any) => {
    return (
      <View key={`${item.originDb}_${item.id}`} style={styles.motionItem}>
        <View style={styles.motionItemLeft}>
          <TouchableOpacity 
            style={styles.statusWrapper}
            onPress={() => handleMarkDone(item)}
          >
            <Ionicons 
              name="ellipse-outline" 
              size={22} 
              color="#cbd5e1" 
            />
          </TouchableOpacity>
          <View style={styles.motionTextContainer}>
            <Text style={styles.motionTitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
        </View>
        <View style={styles.motionItemRight}>
          <Text style={styles.taskTimeText}>
            {formatRelativeTime(item.time)}
          </Text>
        </View>
      </View>
    );
  };

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
    } else if (action >= 101 && action <= 150) {
      config = {
        icon: "notifications",
        color: "#2563eb",
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
        color: "#e11d48",
        title: "Growth",
        subtitle: (parsedData.title || motion.stream || "").trim(),
        amount: null
      };
    }

    return (
      <View key={`${motion.originDb || 'motion'}_${motion.id}`} style={styles.motionItem}>
        <View style={styles.motionItemLeft}>
          <TouchableOpacity 
            style={styles.statusWrapper}
            onPress={() => !isCompleted && handleMarkDone(motion)}
            disabled={isCompleted}
          >
            <Ionicons 
              name={isCompleted ? "checkmark-circle" : "ellipse-outline"} 
              size={22} 
              color={isCompleted ? config.color : "#cbd5e1"} 
            />
          </TouchableOpacity>
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
    
    let parsedHeaderData: any = {};
    try {
      if (header.data) parsedHeaderData = JSON.parse(header.data);
    } catch (e) {}

    const isCompleted = header.status === 'COMPLETED';
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
        {/* Order Header Row */}
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

        {/* Order Items List */}
        <View style={styles.orderItemsList}>
          {items.map((item: any, idx: number) => {
            let parsedItemData: any = {};
            try {
              if (item.data) parsedItemData = JSON.parse(item.data);
            } catch (e) {}

            const itemTitle = parsedItemData.title || item.stream || "Item";
            const itemStatus = item.status || "PENDING";
            
            // Nice text styling based on item status
            let statusColor = "#64748b";
            if (itemStatus === "READY") {
              statusColor = "#16a34a";
            } else if (itemStatus === "DELIVERED" || itemStatus === "COMPLETED") {
              statusColor = "#2563eb";
            } else if (itemStatus === "PENDING") {
              statusColor = "#94a3b8"; // Neutral slate-grey, no purple
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

  const getJobBadgeStyles = (job: string | null) => {
    if (!job) {
      return {
        text: "idle",
        color: "#64748b",
        bg: "#f1f5f9",
      };
    }
    
    const normalized = job.toLowerCase();
    if (normalized.includes("restaurant")) {
      return {
        text: "work",
        color: "#ea580c",
        bg: "#ffedd5",
      };
    } else if (normalized.includes("retail") || normalized.includes("store")) {
      return {
        text: "work",
        color: "#16a34a",
        bg: "#dcfce7",
      };
    } else if (normalized.includes("delivery")) {
      return {
        text: "work",
        color: "#2563eb",
        bg: "#dbeafe",
      };
    } else if (normalized.includes("salon")) {
      return {
        text: "work",
        color: "#c026d3",
        bg: "#fae8ff",
      };
    } else if (normalized.includes("warehouse")) {
      return {
        text: "work",
        color: "#4f46e5",
        bg: "#e0e7ff",
      };
    } else if (normalized.includes("shift")) {
      return {
        text: "work",
        color: "#4f46e5",
        bg: "#e0e7ff",
      };
    }
    
    // Default fallback
    return {
      text: "work",
      color: "#4f46e5",
      bg: "#e0e7ff",
    };
  };

  const badgeStyles = getJobBadgeStyles(activeJob);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => router.push("/profile")}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Animated.View entering={FadeIn.delay(200)} style={styles.userInfo}>
              <Image 
                source={{ uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=prabha" }} 
                style={styles.avatar} 
              />
              <Text style={styles.userName}>prabha</Text>
            </Animated.View>
          </TouchableOpacity>
          <Animated.View key={activeJob || "idle"} entering={FadeIn.duration(300)}>
            <TouchableOpacity 
              style={[styles.headerStatusBadge, { backgroundColor: badgeStyles.bg }]} 
              onPress={() => router.push("/profile")}
              activeOpacity={0.7}
            >
              <Text style={[styles.headerStatusBadgeText, { color: badgeStyles.color }]}>
                {badgeStyles.text}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Future Section */}
          {futureItems.length > 0 && (
            <View>
              <Text style={styles.sectionHeader}>[ FUTURE ]</Text>
              <View style={styles.motionList}>
                {futureItems.map((item, index) => (
                  <React.Fragment key={`${item.originDb}_${item.id}`}>
                    {renderMassCard(item)}
                    {index < futureItems.length - 1 && <View style={styles.separator} />}
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Now Section */}
          {nowItems.length > 0 && (
            <View>
              <Text style={styles.sectionHeader}>[ NOW ]</Text>
              <View style={styles.motionList}>
                {nowItems.map((item, index) => (
                  <React.Fragment key={`${item.originDb || 'now'}_${item.id}`}>
                    {item.isOrderGroup ? (
                      renderOrderGroupCard(item, index, nowItems.length)
                    ) : (
                      <View>
                        {item.isMass ? renderMassCard(item) : item.isTaskMatter ? renderTaskMatterCard(item) : renderCard(item)}
                        {index < nowItems.length - 1 && !nowItems[index + 1].isOrderGroup && <View style={styles.separator} />}
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Past Section */}
          {pastItems.length > 0 && (
            <View>
              <Text style={styles.sectionHeader}>[ PAST ]</Text>
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
            </View>
          )}

          {futureItems.length === 0 && nowItems.length === 0 && pastItems.length === 0 && (
            <Animated.View 
              entering={FadeInDown.delay(400).duration(800)}
              style={styles.emptyState}
            >
              <Ionicons name="layers-outline" size={48} color="#e2e8f0" />
              <Text style={styles.emptyText}>No motion data or scheduled slots found.</Text>
            </Animated.View>
          )}
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
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,
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
    fontSize: 15,
    fontWeight: "500",
    color: "#1e293b",
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
  futureTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366f1",
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  taskTimeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94a3b8",
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  headerStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  headerStatusBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  orderItemStatusText: {
    fontSize: 12,
    fontWeight: "600",
  }
});
