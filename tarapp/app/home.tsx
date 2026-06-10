import React, { useState, useCallback, useRef, useEffect } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { getUserDb } from "../lib/db";
import { setActiveMassId } from "../lib/state";
import * as Haptics from "expo-haptics";
import { getCurrentUser, UserProfile } from "../lib/auth";

import { upsertMatterVector } from "../lib/vectorStore";




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
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);



  useFocusEffect(
    useCallback(() => {
      async function loadProfile() {
        try {
          const user = await getCurrentUser();
          setUserProfile(user);
        } catch (e) {
          console.error("Failed to load user profile in Home:", e);
        }
      }
      loadProfile();

      async function loadData() {
        try {
          const db = getUserDb();
          const nowStr = new Date().toISOString();
          
          // 1. Load Future Items (active slots in mass starting in the future)
          const futureQuery = `
            SELECT m.*, t.title, 'user' as originDb 
            FROM mass m 
            LEFT JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 AND m.scope = 'p' AND (m.type = 'reminder' OR m.type = 'deadline') AND m.start > ?
          `;
          
          let uFuture = await db.all(futureQuery, [nowStr]);
          
          const combinedFuture = (Array.isArray(uFuture) ? uFuture : [])
            .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
            
          setFutureItems(combinedFuture);

          // 2. Load Now Items (current slots occurring now OR active pending motions)
          const nowSlotsQuery = `
            SELECT m.*, t.title, 'user' as originDb
            FROM mass m 
            LEFT JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 AND m.scope = 'p' AND (m.type = 'reminder' OR m.type = 'deadline') AND m.start <= ? AND (m.end IS NULL OR m.end >= ?)
          `;
          
          let uNowSlots = await db.all(nowSlotsQuery, [nowStr, nowStr]);

          // Determine the active job status from active slots occurring now
          const allNowSlots = Array.isArray(uNowSlots) ? uNowSlots : [];
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
              title: s.type === "reminder" ? "Reminder Active" : "Active Slot",
              subtitle: s.title || "Active Item",
              time: s.start,
              action: s.type === "reminder" ? 504 : 100,
              status: "ACTIVE",
              raw: s
            }));

          const deriveTimeFromSeq = (seq: number) => {
            let ms = seq;
            if (seq > 1000000000000000) ms = Math.floor(seq / 1000);
            else if (seq < 1000000000000) ms = seq * 1000;
            return new Date(ms).toISOString();
          };

          const mapMotionRow = (r: any) => {
            let statusStr = "";
            let dataObj: any = {};
            try {
              dataObj = JSON.parse(r.data) || {};
              statusStr = dataObj.status || "";
            } catch (_) {}

            if (!statusStr) {
              statusStr = r.phase === 308 ? "COMPLETED" : (r.phase === 306 ? "OPEN" : "PENDING");
            }

            return {
              id: `${r.stream}_${r.seq}`,
              stream: r.stream,
              seq: r.seq,
              action: r.action,
              status: statusStr,
              delta: r.delta,
              data: r.data,
              time: deriveTimeFromSeq(r.seq),
              scope: "p",
              originDb: r.originDb || "user"
            };
          };

          const uPendingMotionsRaw = await db.all("SELECT stream, seq, action, phase, delta, data, 'user' as originDb FROM motion WHERE phase != 308 AND action != 201 ORDER BY seq DESC LIMIT 20");
          
          const pendingMotions = (uPendingMotionsRaw || []).map(mapMotionRow);

          // Load pending tasks (matter records of type 'task' that do not have a COMPLETED motion log)
          const pendingTasksQuery = `
            SELECT m.*, 'user' as originDb
            FROM matter m
            WHERE m.type = 'task' AND m.scope = 'p'
              AND NOT EXISTS (
                SELECT 1 FROM motion mot
                WHERE mot.stream = m.id AND mot.phase = 308
              )
          `;

          const uTasks = await db.all(pendingTasksQuery).catch(() => []);

          const taskItems = (Array.isArray(uTasks) ? uTasks : [])
            .map(t => ({
              id: t.id,
              isTaskMatter: true,
              originDb: t.originDb,
              title: "Task Pending",
              subtitle: t.title || "Untitled Task",
              time: t.time || nowStr,
              action: 504,
              status: "PENDING",
              raw: t
            }));

          const combinedNow = [...activeSlots, ...pendingMotions, ...taskItems];
          const groupedNow = groupOrderItems(combinedNow)
            .sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
            
          setNowItems(groupedNow);

          // 3. Load Past Items (completed motions, receipts, logs)
          const uPastMotionsRaw = await db.all("SELECT stream, seq, action, phase, delta, data, 'user' as originDb FROM motion WHERE (phase = 308 OR action = 201) ORDER BY seq DESC LIMIT 30");
          
          const combinedPast = (uPastMotionsRaw || []).map(mapMotionRow);
          const groupedPast = groupOrderItems(combinedPast)
            .sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")))
            .slice(0, 40);
            
          setPastItems(groupedPast);

          // Load selected mass overlay if any
          if (massId) {
            let massRow = await db.all(
              `SELECT m.*, t.title FROM mass m LEFT JOIN matter t ON m.matter = t.id WHERE m.id = ?`, 
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
    }, [massId, refreshTrigger])
  );

    const handleMarkDone = async (item: any) => {
    try {
      const db = getUserDb();
      
      if (item.isMass) {
        // Deactivate the mass scheduled reminder/slot
        await db.run("UPDATE mass SET active = 0 WHERE id = ?", [item.id]);
        
        // Log a completed motion log
        const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [item.raw.matter]);
        const seq = seqRow[0]?.next_seq || (Date.now() * 1000);
        
        await db.run(
          "INSERT INTO motion (stream, seq, action, phase, delta, data) VALUES (?, ?, ?, ?, ?, ?)",
          [
            item.raw.matter,
            seq,
            504, // TASK_ASSIGNED Opcode
            308, // phase: COMPLETED
            null,
            JSON.stringify({ task: item.subtitle, status: "COMPLETED", completed_at: new Date().toISOString() })
          ]
        );
      } else if (item.isTaskMatter) {
        // Mark task done by inserting a completed motion log for this matter stream
        const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [item.id]);
        const seq = seqRow[0]?.next_seq || (Date.now() * 1000);
        
        await db.run(
          "INSERT INTO motion (stream, seq, action, phase, delta, data) VALUES (?, ?, ?, ?, ?, ?)",
          [
            item.id,
            seq,
            504, // TASK_ASSIGNED Opcode
            308, // phase: COMPLETED
            null,
            JSON.stringify({ task: item.subtitle, status: "COMPLETED", completed_at: new Date().toISOString() })
          ]
        );
      } else {
        // Complete the motion task
        const [stream, seqStr] = item.id.split("_");
        const seq = Number(seqStr);
        if (stream && !isNaN(seq)) {
          const rows = await db.all("SELECT data FROM motion WHERE stream = ? AND seq = ?", [stream, seq]);
          let existingData = {};
          if (rows && rows[0]) {
            try {
              existingData = JSON.parse((rows[0] as any).data) || {};
            } catch (_) {}
          }
          const updatedData = JSON.stringify({ ...existingData, status: "COMPLETED" });
          await db.run("UPDATE motion SET phase = 308, data = ? WHERE stream = ? AND seq = ?", [updatedData, stream, seq]);
        }
      }
    } catch (e) {
      console.error("Failed to mark done:", e);
    }
  };

  const renderMassCard = (item: any) => {
    const isReminder = item.type === 'reminder';
    const startTime = item.start || item.time || (item.raw && item.raw.start);
    
    let displayTime = "";
    let displayDate = "";
    if (startTime) {
      try {
        const d = new Date(startTime);
        if (!isNaN(d.getTime())) {
          displayTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          displayDate = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      } catch (e) {}
    }

    return (
      <TouchableOpacity 
        key={`${item.originDb}_${item.id}`} 
        style={styles.motionItem}
        activeOpacity={0.7}
        onPress={() => setSelectedItem(item)}
      >
        <View style={styles.motionItemLeft}>
          <TouchableOpacity 
            style={styles.statusWrapper}
            onPress={() => setSelectedItem(item)}
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
          {displayDate || displayTime ? (
            <Text style={styles.futureTimeText}>{displayDate} {displayTime}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTaskMatterCard = (item: any) => {
    return (
      <TouchableOpacity 
        key={`${item.originDb}_${item.id}`} 
        style={styles.motionItem}
        activeOpacity={0.7}
        onPress={() => setSelectedItem(item)}
      >
        <View style={styles.motionItemLeft}>
          <TouchableOpacity 
            style={styles.statusWrapper}
            onPress={() => setSelectedItem(item)}
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
      </TouchableOpacity>
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
      <TouchableOpacity 
        key={`${motion.originDb || 'motion'}_${motion.id}`} 
        style={styles.motionItem}
        activeOpacity={0.7}
        onPress={() => setSelectedItem(motion)}
      >
        <View style={styles.motionItemLeft}>
          <TouchableOpacity 
            style={styles.statusWrapper}
            onPress={() => setSelectedItem(motion)}
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
      </TouchableOpacity>
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

        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity 
              style={styles.profileCircleBtn}
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}
            >
              <Image 
                source={{ uri: userProfile?.photo || "https://api.dicebear.com/7.x/notionists/png?seed=Alice&glassesProbability=100&backgroundColor=c0aede" }} 
                style={styles.profileImage} 
              />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>
              Hello, {userProfile?.name || "Guest"}
            </Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
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
            <View style={{ marginTop: 15 }}>
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

          {futureItems.length === 0 && nowItems.length === 0 && (
            <Animated.View 
              entering={FadeInDown.delay(400).duration(800)}
              style={styles.emptyState}
            >
              <Ionicons name="layers-outline" size={48} color="#e2e8f0" />
              <Text style={styles.emptyText}>No active slots or pending motions found.</Text>
            </Animated.View>
          )}
        </ScrollView>



        {/* Bottom Search Bar */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>

          <View style={styles.bottomBarRow}>
            <View style={styles.leftGroup}>
              <TouchableOpacity
                style={styles.bigWorkspaceChip}
                onPress={() => router.push("/workspace")}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={24} color="#4f46e5" />
              </TouchableOpacity>
            </View>

            <View style={styles.rightGroup}>
              <TouchableOpacity 
                style={styles.circleBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/aichat')}
              >
                <Text style={styles.aiText}>AI</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.circleBtn, { marginLeft: 6 }]}
                activeOpacity={0.8}
                onPress={() => router.push('/pos')}
              >
                <Ionicons name="arrow-up" size={18} color="#1a1a1a" />
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

        {/* Bottom Drawer Modal for Item Status Updates */}
        {selectedItem && (
          <>
            <TouchableOpacity 
              style={styles.backdrop} 
              activeOpacity={1} 
              onPress={() => setSelectedItem(null)} 
            />
            <View style={[styles.drawerOverlay, { paddingBottom: insets.bottom + 16 }]}>
              <View style={{ alignItems: "center", paddingTop: 8 }}>
                <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' }} />
              </View>
              <View style={styles.drawerCard}>
              <View style={styles.massHeader}>
                <View style={styles.massTitleRow}>
                  <View style={[styles.massIndicator, { backgroundColor: selectedItem.isMass ? '#ea580c' : selectedItem.isTaskMatter ? '#c026d3' : '#6366f1' }]} />
                  <Text style={styles.massTitleText} numberOfLines={1}>
                    {selectedItem.subtitle || selectedItem.title || 'Active Item'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedItem(null)}
                  style={styles.massCloseBtn}
                >
                  <Ionicons name="close-circle" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600' }}>
                  Type: <Text style={{ color: '#1e293b', fontWeight: '700' }}>{selectedItem.isMass ? 'Scheduled Slot' : selectedItem.isTaskMatter ? 'Pending Task' : 'Motion Flow'}</Text>
                </Text>
                {selectedItem.time && (
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 }}>
                    Time: <Text style={{ color: '#1e293b' }}>{formatRelativeTime(selectedItem.time)}</Text>
                  </Text>
                )}
              </View>

              <TouchableOpacity 
                style={styles.drawerActionBtn} 
                activeOpacity={0.8}
                onPress={async () => {
                  const dbItem = selectedItem.isMass 
                    ? { id: selectedItem.id, isMass: true, originDb: selectedItem.originDb, subtitle: selectedItem.title || "Reminder", raw: selectedItem.raw || selectedItem } 
                    : selectedItem;
                  await handleMarkDone(dbItem);
                  setSelectedItem(null);
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.drawerActionBtnText}>Mark as Completed</Text>
              </TouchableOpacity>
            </View>
          </View>
          </>
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
  avatarPlaceholder: {
    backgroundColor: "#f4f4f5",
    justifyContent: "center",
    alignItems: "center",
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
    paddingHorizontal: 12,
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
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  bigWorkspaceChip: {
    width: 100,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 0,
  },
  aiText: {
    fontSize: 13,
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
  },
  transcriptionOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 100,
  },
  recordingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  transcriptionText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 20,
    fontWeight: '500',
  },
  nonCommittedText: {
    color: '#94a3b8',
  },
  micBtnRecording: {
    backgroundColor: '#ff3b30',
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 20,
    marginTop: 25,
    marginBottom: 10,
  },
  historyBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  historyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
    zIndex: 199,
  },
  drawerActionBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 12,
  },
  drawerActionBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  drawerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 20,
  },
  drawerCard: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  suggestionChipsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 12,
  }
});
