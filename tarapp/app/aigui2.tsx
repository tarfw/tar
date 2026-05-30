import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  ScrollView
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useLLM } from "react-native-executorch";
import { LFM_MODELS } from "./profile";
import { routeDbForEntity, getUserDb, getSelfId } from "../lib/db";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

type ActiveTab = "all" | "matter" | "mass" | "motion" | "relation";

interface FeedItem {
  id: string;
  type: string;
  table: "matter" | "mass" | "motion" | "relation";
  title?: string;
  code?: string;
  scope?: string;
  time?: string;
  qty?: number;
  value?: number;
  matter?: string;
  status?: string;
  seq?: number;
  action?: number;
  stream?: string;
  src?: string;
  tgt?: string;
  weight?: number;
}

interface Slot {
  key: string;
  label: string;
  value: string | null;
}

interface SuggestionOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
  resolvedValue: string;
}

export default function Aigui2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [selfId, setSelfId] = useState<string>("guest");
  
  // Database State
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Omnibox Core States
  const [inputText, setInputText] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<"delivery" | "commerce" | "task" | "shift" | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);

  // Floating Suggestions State
  const [suggestions, setSuggestions] = useState<SuggestionOption[]>([]);

  // Debug Console States
  const [showLogs, setShowLogs] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  // LLM Status Indicator States
  const [activeModel, setActiveModel] = useState<any>(LFM_MODELS.LFM2_5_350M_FP16);
  const [isModelLoading, setIsModelLoading] = useState(true);

  const logEvent = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    console.log(formatted);
    setLogs(prev => [formatted, ...prev].slice(0, 50));
  };

  // Load configuration & DB entries
  useEffect(() => {
    async function loadConfig() {
      const id = await getSelfId();
      setSelfId(id);
      logEvent(`[Session] Self user initialized as: ${id}`);
      
      try {
        const storedModelId = await SecureStore.getItemAsync("selected_lfm_model_id");
        if (storedModelId && LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]) {
          setActiveModel(LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]);
          logEvent(`[LFM Config] Loaded stored model option: ${storedModelId}`);
        } else {
          logEvent(`[LFM Config] Defaulting to model: ${LFM_MODELS.LFM2_5_350M_FP16.name}`);
        }
      } catch (e) {
        logEvent(`[LFM Config Error] Failed loading option: ${String(e)}`);
      } finally {
        setIsModelLoading(false);
      }
      refreshDatabaseViews();
    }
    loadConfig();
  }, [activeTab]);

  const llm = useLLM({
    model: activeModel,
    preventLoad: isModelLoading,
  });

  // Log LLM status transitions
  useEffect(() => {
    logEvent(`[LFM Hook] isReady: ${llm.isReady} | isGenerating: ${llm.isGenerating} | Model: ${activeModel.name}`);
  }, [llm.isReady, llm.isGenerating, activeModel]);

  // Debounced effect for running the local LFM 350M model logic parser
  useEffect(() => {
    if (!llm.isReady || inputText.trim().length < 5 || llm.isGenerating) return;

    const delayDebounceFn = setTimeout(async () => {
      logEvent(`[LFM 350M Inference] Triggering token slot-filling inference for: "${inputText}"`);
      
      try {
        // Standard slot-filling instructions tailored for local LFM 350M execution
        const prompt = `System: You are an agentic parser. Extract parameter values from this user instruction: "${inputText}".
Return ONLY a valid JSON string mapping extracted keywords to categories. Do not include chat explanations.
JSON Format: {"item": "parsed item", "qty": "parsed qty", "location": "parsed location", "notes": "parsed notes"}`;
        
        logEvent(`[LFM 350M Prompt] Sending request...`);
        await llm.sendMessage(prompt);
      } catch (e) {
        logEvent(`[LFM 350M Error] Generation failed: ${String(e)}`);
      }
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText, llm.isReady]);

  // Handle local LLM response output
  useEffect(() => {
    if (!llm.isGenerating && llm.response && selectedIntent) {
      logEvent(`[LFM 350M Response] Raw output generated: "${llm.response}"`);
      
      try {
        // Clean markdown format wrappers if present
        const jsonMatch = llm.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          logEvent(`[LFM 350M Success] Parsed slots payload: ${JSON.stringify(parsed)}`);
          
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const updatedSlots = slots.map(s => {
            // Map LLM properties to appropriate slot keys
            let matchedValue = null;
            if (s.key === "item" && parsed.item) matchedValue = parsed.item;
            if (s.key === "qty" && parsed.qty) matchedValue = parsed.qty;
            if (s.key === "warehouse" && parsed.location) matchedValue = parsed.location;
            if (s.key === "to" && parsed.location) matchedValue = parsed.location;
            if (s.key === "notes" && parsed.notes) matchedValue = parsed.notes;

            return matchedValue ? { ...s, value: matchedValue } : s;
          });

          setSlots(updatedSlots);
          
          // Auto focus next empty parameter slot
          const nextEmpty = updatedSlots.find(s => s.value === null);
          if (nextEmpty) {
            setActiveSlotKey(nextEmpty.key);
            logEvent(`[Slot Transition] AI auto-filled parameters. Focused next empty: "${nextEmpty.key}"`);
          } else {
            setActiveSlotKey(null);
            logEvent("[Slot Transition] AI populated all slots successfully!");
          }
        }
      } catch (e) {
        logEvent(`[LFM 350M Parse Error] Failed decoding slot JSON structure: ${String(e)}`);
      }
    }
  }, [llm.isGenerating]);

  const refreshDatabaseViews = async () => {
    setIsLoadingDb(true);
    logEvent(`[SQLite Query] Loading feed entries for activeTab filter: "${activeTab}"`);
    try {
      const db = getUserDb();
      let combinedFeed: FeedItem[] = [];

      if (activeTab === "all" || activeTab === "matter") {
        const rows = await db.all("SELECT * FROM matter ORDER BY time DESC LIMIT 30").catch(() => []);
        rows.forEach((r: any) => combinedFeed.push({ ...r, table: "matter" }));
      }
      if (activeTab === "all" || activeTab === "mass") {
        const rows = await db.all("SELECT * FROM mass ORDER BY time DESC LIMIT 30").catch(() => []);
        rows.forEach((r: any) => combinedFeed.push({ ...r, table: "mass" }));
      }
      if (activeTab === "all" || activeTab === "motion") {
        const rows = await db.all("SELECT * FROM motion ORDER BY time DESC LIMIT 30").catch(() => []);
        rows.forEach((r: any) => combinedFeed.push({ ...r, table: "motion" }));
      }
      if (activeTab === "all" || activeTab === "relation") {
        const rows = await db.all("SELECT * FROM relation ORDER BY time DESC LIMIT 30").catch(() => []);
        rows.forEach((r: any) => combinedFeed.push({ ...r, table: "relation", id: `${r.src}-${r.tgt}-${r.type}` }));
      }

      combinedFeed.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
      setFeedItems(combinedFeed);
      logEvent(`[SQLite Query Complete] Retrieved ${combinedFeed.length} feed entries.`);
    } catch (e) {
      logEvent(`[SQLite Query Error] ${String(e)}`);
    } finally {
      setIsLoadingDb(false);
    }
  };

  // Keystroke Intent Predictor (Fast Loop)
  const handleTextChange = async (text: string) => {
    setInputText(text);
    logEvent(`[Keystroke] User typed: "${text}"`);

    const lower = text.toLowerCase();
    
    // 1. Resolve domain use-case intents
    if (lower.startsWith("deliver") || lower.startsWith("order") || lower.startsWith("food") || lower.includes("pickup")) {
      if (selectedIntent !== "delivery") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedIntent("delivery");
        setSlots([
          { key: "item", label: "what food", value: null },
          { key: "to", label: "to where", value: null },
          { key: "notes", label: "instructions", value: null }
        ]);
        setActiveSlotKey("item");
        logEvent("[Fast Loop] Detected DELIVERY intent. Initialized slots: [item, to, notes]");
      }
    } else if (lower.startsWith("buy") || lower.startsWith("purchase") || lower.startsWith("stock") || lower.includes("thermos")) {
      if (selectedIntent !== "commerce") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedIntent("commerce");
        setSlots([
          { key: "item", label: "what product", value: null },
          { key: "qty", label: "quantity", value: null },
          { key: "warehouse", label: "destination", value: null }
        ]);
        setActiveSlotKey("item");
        logEvent("[Fast Loop] Detected COMMERCE/POS intent. Initialized slots: [item, qty, warehouse]");
      }
    } else if (lower.startsWith("clock") || lower.startsWith("shift")) {
      if (selectedIntent !== "shift") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedIntent("shift");
        setSlots([
          { key: "action", label: "clock status", value: null },
          { key: "role", label: "role", value: null }
        ]);
        setActiveSlotKey("action");
        logEvent("[Fast Loop] Detected SHIFT HR intent. Initialized slots: [action, role]");
      }
    } else if (lower.startsWith("assign") || lower.startsWith("job") || lower.startsWith("task") || lower.includes("plumb")) {
      if (selectedIntent !== "task") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedIntent("task");
        setSlots([
          { key: "task", label: "what task", value: null },
          { key: "technician", label: "technician", value: null },
          { key: "slot", label: "scheduled slot", value: null }
        ]);
        setActiveSlotKey("task");
        logEvent("[Fast Loop] Detected TASK DISPATCH intent. Initialized slots: [task, technician, slot]");
      }
    } else if (text.trim() === "") {
      setSelectedIntent(null);
      setSlots([]);
      setActiveSlotKey(null);
      setSuggestions([]);
      logEvent("[Fast Loop] Input cleared. Reset parameters.");
    }
  };

  // Populate suggestions based on active slot
  useEffect(() => {
    if (!activeSlotKey) {
      setSuggestions([]);
      return;
    }

    async function loadSuggestionsForSlot() {
      const db = getUserDb();
      let options: SuggestionOption[] = [];
      logEvent(`[Smart Loop] Active slot is now "${activeSlotKey}". Loading context suggestions...`);

      try {
        if (activeSlotKey === "item") {
          const rows = await db.all("SELECT id, title, type, scope FROM matter LIMIT 6");
          options = rows.map((r: any) => ({
            id: r.id,
            title: r.title || r.id,
            subtitle: `Type: ${r.type} | Scope: ${r.scope || "p"}`,
            icon: r.type === "food" ? "fast-food-outline" : r.type === "product" ? "cube-outline" : "document-text-outline",
            resolvedValue: r.id
          }));
        } else if (activeSlotKey === "to" || activeSlotKey === "warehouse") {
          options = [
            { id: "w_ch03", title: "T-Nagar Warehouse", subtitle: "Scope: w:ch03", icon: "business-outline", badge: "home", resolvedValue: "w:ch03" },
            { id: "s_pos", title: "Sales Counter POS", subtitle: "Scope: s:pos", icon: "card-outline", badge: "recent", resolvedValue: "s:pos" },
            { id: "p_local", title: "Private Local Space", subtitle: "Scope: p", icon: "shield-checkmark-outline", resolvedValue: "p" }
          ];
        } else if (activeSlotKey === "qty") {
          options = [
            { id: "q1", title: "10 Units", subtitle: "Small replenishment", icon: "cart-outline", resolvedValue: "10" },
            { id: "q2", title: "50 Units", subtitle: "Standard warehouse restock", icon: "cube-outline", resolvedValue: "50" },
            { id: "q3", title: "100 Units", subtitle: "Bulk shipment", icon: "trending-up-outline", resolvedValue: "100" }
          ];
        } else if (activeSlotKey === "notes") {
          options = [
            { id: "n1", title: "Deliver to back door", subtitle: "Gate code is *4082", icon: "chatbox-ellipses-outline", resolvedValue: "Deliver to back door. Gate code is *4082." },
            { id: "n2", title: "Immediate Priority", subtitle: "Call on arrival", icon: "alert-circle-outline", resolvedValue: "Immediate priority. Call on arrival." }
          ];
        } else if (activeSlotKey === "action") {
          options = [
            { id: "a1", title: "Clock In (Shift Start)", subtitle: "Action opcode 501", icon: "time-outline", resolvedValue: "Clock In (501)" },
            { id: "a2", title: "Clock Out (Shift End)", subtitle: "Action opcode 204", icon: "log-out-outline", resolvedValue: "Clock Out (204)" }
          ];
        } else if (activeSlotKey === "role") {
          options = [
            { id: "r1", title: "Lead Cashier", subtitle: "POS Counter Operations", icon: "person-outline", resolvedValue: "Cashier" },
            { id: "r2", title: "Delivery Rider", subtitle: "Logistics", icon: "bicycle-outline", resolvedValue: "Rider" }
          ];
        } else if (activeSlotKey === "task") {
          const rows = await db.all("SELECT id, title FROM matter WHERE type = 'task' LIMIT 4");
          options = rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            subtitle: `Task: ${r.id}`,
            icon: "construct-outline",
            resolvedValue: r.id
          }));
        } else if (activeSlotKey === "technician") {
          options = [
            { id: "t1", title: "Sarah Jenkins", subtitle: "ID: tech_092 | Senior Plumber", icon: "person-outline", resolvedValue: "tech_092" },
            { id: "t2", title: "John Adams", subtitle: "ID: tech_104 | HVAC Lead", icon: "person-outline", resolvedValue: "tech_104" }
          ];
        } else if (activeSlotKey === "slot") {
          options = [
            { id: "s1", title: "Morning Slot (09:00 - 12:00)", subtitle: "Today", icon: "calendar-outline", resolvedValue: "morning_slot" },
            { id: "s2", title: "Afternoon Slot (14:00 - 17:00)", subtitle: "Today", icon: "calendar-outline", resolvedValue: "afternoon_slot" }
          ];
        }
      } catch (e) {
        logEvent(`[Suggestions Error] Failed: ${String(e)}`);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSuggestions(options);
      logEvent(`[Smart Loop Suggestions] Loaded ${options.length} resolved suggestions for active parameter.`);
    }

    loadSuggestionsForSlot();
  }, [activeSlotKey, feedItems]);

  const handleSelectSuggestion = (option: SuggestionOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logEvent(`[Slot Fill] Selected value: "${option.resolvedValue}" for parameter: "${activeSlotKey}"`);
    
    const updatedSlots = slots.map(s => {
      if (s.key === activeSlotKey) {
        return { ...s, value: option.resolvedValue };
      }
      return s;
    });

    setSlots(updatedSlots);

    const nextEmptySlot = updatedSlots.find(s => s.value === null);
    if (nextEmptySlot) {
      setActiveSlotKey(nextEmptySlot.key);
      logEvent(`[Slot Transition] Moving focus to next empty slot parameter: "${nextEmptySlot.key}"`);
    } else {
      setActiveSlotKey(null);
      logEvent("[Slot Transition] All slots populated. Ready to execute command.");
    }
  };

  const handleExecuteAction = async () => {
    const unfilledSlot = slots.find(s => s.value === null);
    if (unfilledSlot) {
      Alert.alert("Pending Slots", `Please fill in the "${unfilledSlot.label}" parameter before submitting.`);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoadingDb(true);
    const time = new Date().toISOString();

    try {
      if (selectedIntent === "delivery") {
        const itemVal = slots.find(s => s.key === "item")?.value || "Unknown Item";
        const destVal = slots.find(s => s.key === "to")?.value || "p";
        const notesVal = slots.find(s => s.key === "notes")?.value || "";

        const orderId = `ord_delivery_${Date.now()}`;
        const db = routeDbForEntity("matter", destVal);

        logEvent(`[SQLite Write] Mutating matter table. Target scope: ${destVal}`);
        const sqlMatter = "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        const valsMatter = [orderId, `DEL_${Date.now().toString().slice(-4)}`, "food", destVal, selfId, itemVal, JSON.stringify({ notes: notesVal }), time];
        logEvent(`[SQL Execute] ${sqlMatter} with params: ${JSON.stringify(valsMatter)}`);
        await db.run(sqlMatter, valsMatter);

        logEvent(`[SQLite Write] Mutating motion table. Append strategy.`);
        const sqlMotion = "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) VALUES (?, ?, 1, 201, 'READY_FOR_PICKUP', null, ?, ?, ?)";
        const valsMotion = [`mot_${Date.now()}`, orderId, destVal, JSON.stringify({ instructions: notesVal }), time];
        logEvent(`[SQL Execute] ${sqlMotion} with params: ${JSON.stringify(valsMotion)}`);
        await db.run(sqlMotion, valsMotion);

      } else if (selectedIntent === "commerce") {
        const itemVal = slots.find(s => s.key === "item")?.value || "";
        const qtyVal = parseFloat(slots.find(s => s.key === "qty")?.value || "1");
        const warehouseVal = slots.find(s => s.key === "warehouse")?.value || "p";

        const db = routeDbForEntity("mass", warehouseVal);

        logEvent(`[SQLite Write] Mutating mass table. Target scope: ${warehouseVal}`);
        const sqlMass = "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, time) VALUES (?, ?, ?, ?, ?, ?, 1, ?)";
        const valsMass = [`mas_stock_${Date.now()}`, itemVal, "stock", warehouseVal, qtyVal, 899.00, time];
        logEvent(`[SQL Execute] ${sqlMass} with params: ${JSON.stringify(valsMass)}`);
        await db.run(sqlMass, valsMass);

        logEvent(`[SQLite Write] Mutating relation table.`);
        const sqlRelation = "INSERT OR REPLACE INTO relation (src, tgt, type, weight, time) VALUES (?, ?, 'located_in', 1.0, ?)";
        const valsRelation = [itemVal, warehouseVal, time];
        logEvent(`[SQL Execute] ${sqlRelation} with params: ${JSON.stringify(valsRelation)}`);
        await db.run(sqlRelation, valsRelation);

      } else if (selectedIntent === "shift") {
        const actionText = slots.find(s => s.key === "action")?.value || "";
        const roleVal = slots.find(s => s.key === "role")?.value || "";
        const actionCode = actionText.includes("In") ? 501 : 204;

        const db = routeDbForEntity("motion", "s:pos");
        const streamKey = `shift_pos_${selfId}`;

        const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [streamKey]);
        const nextSeq = seqRow[0]?.next_seq || 1;

        logEvent(`[SQLite Write] Mutating motion table stream: "${streamKey}" at sequence seq=${nextSeq}`);
        const sqlMotion = "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) VALUES (?, ?, ?, ?, ?, null, 's:pos', ?, ?)";
        const valsMotion = [`mot_shift_${Date.now()}`, streamKey, nextSeq, actionCode, actionCode === 501 ? "CLOCKED_IN" : "OFFLINE", JSON.stringify({ role: roleVal }), time];
        logEvent(`[SQL Execute] ${sqlMotion} with params: ${JSON.stringify(valsMotion)}`);
        await db.run(sqlMotion, valsMotion);

      } else if (selectedIntent === "task") {
        const taskVal = slots.find(s => s.key === "task")?.value || "";
        const techVal = slots.find(s => s.key === "technician")?.value || "";
        const slotVal = slots.find(s => s.key === "slot")?.value || "";

        const db = routeDbForEntity("mass", "dispatch");

        logEvent("[SQLite Write] Allocating dispatch task schedule inside mass table.");
        const sqlMass = "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'slot', 'dispatch', 1, null, 1, ?, ?, ?, ?)";
        const valsMass = [`mas_job_${Date.now()}`, taskVal, time, time, JSON.stringify({ assigned_tech: techVal, time_slot: slotVal }), time];
        logEvent(`[SQL Execute] ${sqlMass} with params: ${JSON.stringify(valsMass)}`);
        await db.run(sqlMass, valsMass);
      }

      Alert.alert("Success", "Executed transaction mutation on local database workspace.");
      setInputText("");
      setSelectedIntent(null);
      setSlots([]);
      setActiveSlotKey(null);
      refreshDatabaseViews();
    } catch (err: any) {
      logEvent(`[Execution Failure] ${err.message || String(err)}`);
      Alert.alert("Execution Failed", err.message || String(err));
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleDeleteItem = async (table: string, idVal: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to remove this record from ${table}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const db = getUserDb();
              if (table === "relation") {
                const parts = idVal.split("|");
                logEvent(`[SQLite Delete] Mutating relation table. Removing row with src=${parts[0]} tgt=${parts[1]} type=${parts[2]}`);
                await db.run("DELETE FROM relation WHERE src = ? AND tgt = ? AND type = ?", [parts[0], parts[1], parts[2]]);
              } else {
                logEvent(`[SQLite Delete] Mutating ${table} table. Removing row id: ${idVal}`);
                await db.run(`DELETE FROM ${table} WHERE id = ?`, [idVal]);
              }
              refreshDatabaseViews();
            } catch (err: any) {
              logEvent(`[Delete Failure] ${err.message}`);
              Alert.alert("Delete Failed", err.message);
            }
          }
        }
      ]
    );
  };

  const getLLMIndicatorColor = () => {
    if (isModelLoading) return "#eab308";
    if (llm.isReady) return "#22c55e";
    return "#3b82f6";
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    return (
      <View style={styles.recordCard}>
        <View style={styles.cardHeader}>
          <View style={styles.tableBadge}>
            <Text style={styles.tableBadgeText}>{item.table.toUpperCase()}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => handleDeleteItem(item.table, item.table === "relation" ? `${item.src}|${item.tgt}|${item.type}` : item.id)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {item.table === "matter" && (
          <View>
            <Text style={styles.cardTitle}>{item.title || "Untitled"}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeLabel}>Code: {item.code || "N/A"}</Text>
              <Text style={styles.badgeLabel}>Type: {item.type}</Text>
              <Text style={styles.badgeLabel}>Scope: {item.scope || "p"}</Text>
            </View>
          </View>
        )}

        {item.table === "mass" && (
          <View>
            <Text style={styles.cardTitle}>Qty: {item.qty} | Value: ₹{item.value}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeLabel}>Matter: {item.matter?.slice(0, 12)}...</Text>
              <Text style={styles.badgeLabel}>Type: {item.type}</Text>
              <Text style={styles.badgeLabel}>Scope: {item.scope}</Text>
            </View>
          </View>
        )}

        {item.table === "motion" && (
          <View>
            <Text style={styles.cardTitle}>Status: {item.status} (Seq: {item.seq})</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeLabel}>Stream: {item.stream?.slice(0, 12)}...</Text>
              <Text style={styles.badgeLabel}>Opcode: {item.action}</Text>
              <Text style={styles.badgeLabel}>Scope: {item.scope}</Text>
            </View>
          </View>
        )}

        {item.table === "relation" && (
          <View>
            <Text style={styles.cardTitle}>{item.type?.toUpperCase()}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeLabel}>Source: {item.src?.slice(0, 10)}...</Text>
              <Text style={styles.badgeLabel}>Target: {item.tgt?.slice(0, 10)}...</Text>
              <Text style={styles.badgeLabel}>Weight: {item.weight}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/home")}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>AI Autocomplete CRUD</Text>
            
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity onPress={() => setShowLogs(!showLogs)} style={styles.debugToggleBtn}>
                <Ionicons name="terminal-outline" size={20} color={showLogs ? "#4f46e5" : "#64748b"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.refreshBtn} onPress={refreshDatabaseViews}>
                <Ionicons name="sync" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dev Debug Console Section */}
          {showLogs && (
            <View style={styles.logsTray}>
              <View style={styles.logsHeader}>
                <Text style={styles.logsHeaderTitle}>SYSTEM ENGINE DEBUG CONSOLE</Text>
                <TouchableOpacity onPress={() => setLogs([])}>
                  <Text style={styles.logsClearText}>CLEAR</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.logsScroll} nestedScrollEnabled={true}>
                {logs.length === 0 ? (
                  <Text style={styles.logTextEmpty}>No diagnostic logs yet. Start typing to view traces...</Text>
                ) : (
                  logs.map((log, index) => (
                    <Text key={index} style={styles.logText}>{log}</Text>
                  ))
                )}
              </ScrollView>
            </View>
          )}

          {/* Entity Tables Tab Row */}
          <View style={styles.tabContainer}>
            {(["all", "matter", "mass", "motion", "relation"] as ActiveTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Database List Workspace */}
          {isLoadingDb && feedItems.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#6366f1" />
          ) : (
            <FlatList
              data={feedItems}
              renderItem={renderFeedItem}
              keyExtractor={(item) => `${item.table}-${item.id}`}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <Text style={styles.emptyTableText}>No workspace records found</Text>
              }
            />
          )}

          {/* Floating Context Autocomplete Suggestion Card */}
          {suggestions.length > 0 && (
            <Animated.View entering={FadeIn.duration(150)} style={styles.floatingSuggestionCard}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="sparkles-outline" size={14} color="#4f46e5" />
                <Text style={styles.suggestionTitle}>
                  Suggestions for slot: <Text style={{ fontWeight: "700" }}>{activeSlotKey?.toUpperCase()}</Text>
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                {suggestions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectSuggestion(opt)}
                  >
                    <View style={styles.iconCircle}>
                      <Ionicons name={opt.icon as any} size={15} color="#4f46e5" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.suggestionRowText}>{opt.title}</Text>
                      <Text style={styles.suggestionRowSub}>{opt.subtitle}</Text>
                    </View>
                    {opt.badge && (
                      <View style={styles.suggestionBadge}>
                        <Ionicons name={opt.badge === "home" ? "home-outline" : "time-outline"} size={10} color="#64748b" style={{ marginRight: 2 }} />
                        <Text style={styles.suggestionBadgeText}>{opt.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* AI Autocomplete Input Card */}
          <View style={[styles.omniInputOuter, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            
            {/* Input Capsule Wrapper */}
            <View style={styles.capsuleWrapper}>
              <View style={[styles.llmIndicatorDot, { backgroundColor: getLLMIndicatorColor() }]} />
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.capsuleContent}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  style={styles.capsuleInput}
                  value={inputText}
                  onChangeText={handleTextChange}
                  placeholder={selectedIntent ? "" : "Deliver food, buy thermos..."}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.key}
                    style={[
                      styles.slotPill,
                      slot.key === activeSlotKey && styles.slotPillActive,
                      slot.value !== null && styles.slotPillFilled
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveSlotKey(slot.key);
                    }}
                  >
                    <Text style={[
                      styles.slotPillText,
                      slot.key === activeSlotKey && styles.slotPillTextActive,
                      slot.value !== null && styles.slotPillTextFilled
                    ]}>
                      {slot.value || slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity 
                style={[
                  styles.arrowSubmitBtn, 
                  slots.every(s => s.value !== null) && slots.length > 0 && styles.arrowSubmitBtnActive
                ]} 
                onPress={handleExecuteAction}
              >
                <Ionicons name="arrow-up" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    padding: 4,
  },
  refreshBtn: {
    padding: 4,
  },
  debugToggleBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  logsTray: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    maxHeight: 120,
    padding: 10,
  },
  logsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  logsHeaderTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "#38bdf8",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  logsClearText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ef4444",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  logsScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 10,
    color: "#34d399",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 14,
    marginBottom: 2,
  },
  logTextEmpty: {
    fontSize: 10,
    color: "#64748b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontStyle: "italic",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#6366f1",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 220,
  },
  emptyTableText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 30,
  },
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tableBadge: {
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#4f46e5",
  },
  deleteBtn: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badgeLabel: {
    fontSize: 10,
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    color: "#475569",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontWeight: "600",
  },
  floatingSuggestionCard: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    padding: 8,
    zIndex: 100,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 4,
  },
  suggestionTitle: {
    fontSize: 11,
    color: "#64748b",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionRowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  suggestionRowSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  suggestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  suggestionBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748b",
  },
  omniInputOuter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  capsuleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 28,
    paddingLeft: 14,
    paddingRight: 6,
    height: 52,
  },
  llmIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  capsuleContent: {
    alignItems: "center",
    gap: 8,
    paddingRight: 20,
  },
  capsuleInput: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    minWidth: 120,
    height: "100%",
  },
  slotPill: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderColor: "transparent",
    borderWidth: 1.5,
  },
  slotPillActive: {
    backgroundColor: "#fce7f3",
    borderColor: "#fbcfe8",
  },
  slotPillFilled: {
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
  },
  slotPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  slotPillTextActive: {
    color: "#db2777",
  },
  slotPillTextFilled: {
    color: "#0369a1",
  },
  arrowSubmitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  arrowSubmitBtnActive: {
    backgroundColor: "#4f46e5",
  }
});
