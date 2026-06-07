import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { getUserDb, getSelfId, routeDbForEntity, isCollabSyncEnabled } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";
import { useLLM } from "react-native-executorch";
import * as SecureStore from "expo-secure-store";
import { LFM_MODELS } from "./profile";

const getSizeShortCode = (sizeStr: string): string => {
  const clean = sizeStr.trim().toLowerCase();
  if (clean === "small") return "S";
  if (clean === "medium") return "M";
  if (clean === "large") return "L";
  if (clean === "extra large" || clean === "xlarge" || clean === "xl") return "XL";
  if (clean === "double extra large" || clean === "xxl") return "XXL";
  if (clean === "extra small" || clean === "xs") return "XS";
  if (!isNaN(Number(clean))) return sizeStr.trim();
  if (clean.length <= 4) return sizeStr.trim().toUpperCase();
  return sizeStr.trim().charAt(0).toUpperCase();
};

const getVariantCombinations = (optionsObj: Record<string, string[]>) => {
  const keys = Object.keys(optionsObj).filter(k => optionsObj[k] && optionsObj[k].length > 0);
  if (keys.length === 0) {
    return [];
  }

  let combinations: Record<string, string>[] = [{}];
  for (const key of keys) {
    const nextCombinations: Record<string, string>[] = [];
    const values = optionsObj[key];
    for (const comb of combinations) {
      for (const val of values) {
        nextCombinations.push({
          ...comb,
          [key]: val
        });
      }
    }
    combinations = nextCombinations;
  }
  return combinations;
};

const getVariantKey = (comb: Record<string, string>) => {
  return Object.entries(comb)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
};

const GLOBAL_OPTIONS_PRESETS = [
  {
    key: "Color",
    presets: ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Purple", "Orange", "Grey"]
  },
  {
    key: "Size",
    presets: ["S", "M", "L", "XL", "XXL", "XS", "7", "8", "9", "10", "11", "12"]
  },
  {
    key: "Material",
    presets: ["Cotton", "Leather", "Polyester", "Wool", "Silk", "Canvas", "Denim"]
  },
  {
    key: "Fit",
    presets: ["Regular", "Slim", "Oversized", "Loose", "Athletic"]
  }
];

const OptionsModalInput = ({ onAdd }: { onAdd: (val: string) => void }) => {
  const [text, setText] = useState("");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
      <TextInput
        style={{
          flex: 1,
          height: 36,
          borderWidth: 1,
          borderColor: "#e4e4e7",
          borderRadius: 8,
          paddingHorizontal: 10,
          fontSize: 13,
          backgroundColor: "#fafafa",
          color: "#18181b"
        }}
        placeholder="Add custom value..."
        placeholderTextColor="#a1a1aa"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => {
          if (text.trim()) {
            onAdd(text.trim());
            setText("");
          }
        }}
      />
      <TouchableOpacity 
        style={{
          height: 36,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: "#18181b",
          justifyContent: "center",
          alignItems: "center"
        }}
        onPress={() => {
          if (text.trim()) {
            onAdd(text.trim());
            setText("");
          }
        }}
      >
        <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Add</Text>
      </TouchableOpacity>
    </View>
  );
};

const getColorsList = (colorVal: any): string[] => {
  if (!colorVal) return [];
  if (typeof colorVal === "string") {
    return colorVal.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
  }
  if (Array.isArray(colorVal)) {
    return colorVal.map(c => String(c).trim().toLowerCase()).filter(Boolean);
  }
  return [String(colorVal).trim().toLowerCase()];
};

const getSizesList = (sizeVal: any): string[] => {
  if (!sizeVal) return [];
  if (typeof sizeVal === "string") {
    return sizeVal.split(",").map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(sizeVal)) {
    return sizeVal.map(s => String(s).trim()).filter(Boolean);
  }
  return [String(sizeVal).trim()];
};

export default function CreateProductScreen() {
  const router = useRouter();

  const type = "product";
  const [matterId, setMatterId] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("g");
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [time, setTime] = useState("");
  const [data, setData] = useState<Record<string, any>>({});

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [quickAddText, setQuickAddText] = useState("");
  const [variantInputs, setVariantInputs] = useState<Record<string, { stock?: string; price?: string }>>({});

  const optionsObj: Record<string, string[]> = {};
  const directColor = getColorsList(data.color || data.colour);
  if (directColor && directColor.length > 0) optionsObj["Color"] = directColor;
  const directSize = getSizesList(data.size);
  if (directSize && directSize.length > 0) optionsObj["Size"] = directSize;
  if (data.options) {
    Object.entries(data.options as Record<string, string[]>).forEach(([k, v]) => {
      if (v && v.length > 0) {
        const normalizedKey = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
        optionsObj[normalizedKey] = Array.from(new Set([...(optionsObj[normalizedKey] || []), ...v]));
      }
    });
  }

  // Action log state
  const [selectedOpcode, setSelectedOpcode] = useState<any | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [actionDelta, setActionDelta] = useState("");
  const [actionData, setActionData] = useState("");
  const [isExecutingOpcode, setIsExecutingOpcode] = useState(false);

  const PRODUCT_OPCODES = [
    { code: 101, label: "SOLD", defaultStatus: "SOLD", hasDelta: true, defaultDelta: -1, defaultData: { qty: 1, reason: "direct_sale" }, color: "#ef4444" },
    { code: 102, label: "CART ADD", defaultStatus: "CART_ADD", hasDelta: false, defaultData: { qty: 1 }, color: "#3b82f6" },
    { code: 103, label: "CART REMOVE", defaultStatus: "CART_REMOVE", hasDelta: false, defaultData: { qty: 1 }, color: "#6b7280" },
    { code: 105, label: "ORDER PLACED", defaultStatus: "PLACED", hasDelta: true, defaultDelta: 1, defaultData: { note: "web_checkout" }, color: "#f59e0b" },
    { code: 109, label: "DELIVERED", defaultStatus: "DELIVERED", hasDelta: false, defaultData: { carrier: "express" }, color: "#10b981" },
    { code: 111, label: "REFUND", defaultStatus: "REFUNDED", hasDelta: true, defaultDelta: -1, defaultData: { reason: "customer_return" }, color: "#ec4899" },
    { code: 201, label: "SALE (POS)", defaultStatus: "SALE", hasDelta: true, defaultDelta: 150.00, defaultData: { payment_mode: "cash" }, color: "#8b5cf6" },
    { code: 802, label: "PAYMENT SUCCESS", defaultStatus: "SUCCESS", hasDelta: true, defaultDelta: 150.00, defaultData: { gateway: "stripe" }, color: "#06b6d4" },
  ];

  const executeOpcodeAction = async (opcodeOpt: any) => {
    const finalId = matterId.trim();
    const finalTitle = title.trim();
    if (!finalId) {
      Alert.alert("Validation Error", "Please provide a unique Matter ID first.");
      return;
    }
    if (!finalTitle) {
      Alert.alert("Validation Error", "Please enter a title first.");
      return;
    }

    setIsExecutingOpcode(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const db = routeDbForEntity("motion", scope);
      const time = new Date().toISOString();

      // Automatically save the matter itself so the stream ID has a valid parent matter.
      const finalCleanData = data;
      const matterDb = getUserDb();
      await matterDb.run(
        "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalId,
          code.trim() || null,
          type,
          scope.trim(),
          owner.trim() || null,
          finalTitle,
          isPublic ? 1 : 0,
          JSON.stringify(finalCleanData),
          time
        ]
      );
      
      // Also write initial stock realization to the mass table
      const combinations = getVariantCombinations(optionsObj);
      if (combinations.length > 0) {
        for (let i = 0; i < combinations.length; i++) {
          const comb = combinations[i];
          const key = getVariantKey(comb);
          const vPrice = parseFloat(variantInputs[key]?.price ?? data.price ?? "0.00");
          const vStock = parseFloat(variantInputs[key]?.stock ?? "0");
          const massId = `mas_stock_${finalId}_${i}`;
          await matterDb.run(
            "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, data, time) VALUES (?, ?, 'stock', ?, ?, ?, 1, ?, ?)",
            [
              massId,
              finalId,
              scope.trim(),
              vStock,
              vPrice,
              JSON.stringify({ options: comb }),
              time
            ]
          );
        }
      } else {
        const stockQty = data.stock ? parseFloat(data.stock) : 0;
        const productPrice = data.price ? parseFloat(data.price) : 0.0;
        const massId = `mas_stock_${finalId}`;
        await matterDb.run(
          "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, time) VALUES (?, ?, 'stock', ?, ?, ?, 1, ?)",
          [
            massId,
            finalId,
            scope.trim(),
            stockQty,
            productPrice,
            time
          ]
        );
      }
      
      try {
        await upsertMatterVector(finalId, {
          title: finalTitle,
          type,
          scope: scope.trim(),
          code: code.trim() || null,
          data: JSON.stringify(finalCleanData)
        });
      } catch (vErr) {
        console.warn("Vector sync failed:", vErr);
      }

      // Compute next monotonic seq for this stream
      const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [finalId]);
      const nextSeq = seqRow[0]?.next_seq || 1;

      // Parse delta and data
      const deltaVal = opcodeOpt.hasDelta ? Number(actionDelta || opcodeOpt.defaultDelta || 0) : null;
      let parsedDataPayload = opcodeOpt.defaultData;
      try {
        if (actionData.trim()) {
          parsedDataPayload = JSON.parse(actionData);
        }
      } catch (_) {
        parsedDataPayload = { ...opcodeOpt.defaultData, raw_input: actionData };
      }

      const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const targetStatus = actionStatus.trim() || opcodeOpt.defaultStatus;

      await db.run(
        "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          motionId,
          finalId,
          nextSeq,
          opcodeOpt.code,
          targetStatus,
          deltaVal,
          scope.trim(),
          JSON.stringify(parsedDataPayload),
          time
        ]
      );

      const syncEnabled = await isCollabSyncEnabled();
      if (syncEnabled) {
        await db.push().catch((err) => console.warn("Failed to push sync:", err));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Action Executed",
        `Successfully logged Opcode ${opcodeOpt.code} (${opcodeOpt.label}) to the Kinetic Ledger.`,
        [{ text: "OK", onPress: () => setSelectedOpcode(null) }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to execute opcode action.");
    } finally {
      setIsExecutingOpcode(false);
    }
  };
  const [isWaitingForClassification, setIsWaitingForClassification] = useState(false);
  const [classificationQuery, setClassificationQuery] = useState("");

  const toggleOptionValue = (key: string, val: string) => {
    setData(prev => {
      const currentOptions = { ...(prev.options || {}) };
      const currentVals = currentOptions[key] ? [...currentOptions[key]] : [];
      const idx = currentVals.indexOf(val);
      if (idx > -1) {
        currentVals.splice(idx, 1);
      } else {
        currentVals.push(val);
      }
      if (currentVals.length === 0) {
        delete currentOptions[key];
      } else {
        currentOptions[key] = currentVals;
      }
      return { ...prev, options: currentOptions };
    });
  };

  const shiftOptionValueLeft = (key: string, index: number) => {
    if (index === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key.toLowerCase() === "color" || key.toLowerCase() === "colour") {
      const hasDirectColor = data.color || data.colour;
      if (hasDirectColor) {
        const colors = getColorsList(hasDirectColor);
        if (colors.length > 1 && index < colors.length) {
          const newColors = [...colors];
          const temp = newColors[index];
          newColors[index] = newColors[index - 1];
          newColors[index - 1] = temp;
          setData(prev => {
            const updated = { ...prev };
            if (prev.color) updated.color = newColors.join(", ");
            if (prev.colour) updated.colour = newColors.join(", ");
            return updated;
          });
          return;
        }
      }
    }
    setData(prev => {
      const currentOptions = { ...(prev.options || {}) };
      const currentVals = currentOptions[key] ? [...currentOptions[key]] : [];
      if (currentVals.length > 1 && index < currentVals.length) {
        const temp = currentVals[index];
        currentVals[index] = currentVals[index - 1];
        currentVals[index - 1] = temp;
        currentOptions[key] = currentVals;
      }
      return { ...prev, options: currentOptions };
    });
  };

  const [activeModel, setActiveModel] = useState<any>(LFM_MODELS.LFM2_5_350M_FP16);
  const [isModelLoading, setIsModelLoading] = useState(true);

  useEffect(() => {
    async function loadSelectedModel() {
      try {
        const storedModelId = await SecureStore.getItemAsync("selected_lfm_model_id");
        if (storedModelId && LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]) {
          setActiveModel(LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsModelLoading(false);
      }
    }
    loadSelectedModel();
  }, []);

  const llm = useLLM({
    model: activeModel,
    preventLoad: isModelLoading,
  });

  const { isReady } = llm;

  const handleQuickAddSubmit = async () => {
    if (!quickAddText.trim()) return;
    const query = quickAddText.trim();
    setQuickAddText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const fitKeywords = ["regular", "slim", "oversized", "loose", "athletic", "fit", "relaxed"];
    const sizeKeywords = ["s", "m", "l", "xl", "xxl", "xs", "size", "short", "tall", "long"];
    const colorKeywords = ["black", "white", "red", "blue", "green", "yellow", "pink", "purple", "orange", "grey", "gray", "navy", "crimson", "khaki"];
    const matKeywords = ["cotton", "leather", "polyester", "wool", "silk", "canvas", "denim", "linen", "nylon"];

    const word = query.toLowerCase();
    if (fitKeywords.some(k => word.includes(k))) {
      toggleOptionValue("Fit", query);
      return;
    }
    if (sizeKeywords.some(k => word.includes(k)) || /^\d+$/.test(query)) {
      toggleOptionValue("Size", query);
      return;
    }
    if (colorKeywords.some(k => word.includes(k))) {
      toggleOptionValue("Color", query);
      return;
    }
    if (matKeywords.some(k => word.includes(k))) {
      toggleOptionValue("Material", query);
      return;
    }

    if (!isReady || llm.isGenerating) {
      const formattedVal = query.charAt(0).toUpperCase() + query.slice(1);
      toggleOptionValue("Material", formattedVal);
      return;
    }

    setIsWaitingForClassification(true);
    setClassificationQuery(query);

    try {
      const promptText = `System: Classify the input as Color, Size, Material, or Fit. Output ONLY the category name.

Input: "navy blue"
Output: Color

Input: "cotton"
Output: Material

Input: "xxlarge"
Output: Size

Input: "loose"
Output: Fit

Input: "${query}"
Output:`;
      await llm.sendMessage(promptText);
    } catch {
      setIsWaitingForClassification(false);
      const formattedVal = query.charAt(0).toUpperCase() + query.slice(1);
      toggleOptionValue("Material", formattedVal);
    }
  };

  useEffect(() => {
    if (isWaitingForClassification && !llm.isGenerating) {
      setIsWaitingForClassification(false);
      const responseText = llm.response;
      if (responseText && classificationQuery) {
        const cleanText = responseText.trim().replace(/[^a-zA-Z\s]/g, "");
        const words = cleanText.toLowerCase().split(/\s+/);
        let category = "Material";
        if (words.includes("fit")) category = "Fit";
        else if (words.includes("size")) category = "Size";
        else if (words.includes("color") || words.includes("colour")) category = "Color";
        else if (words.includes("material")) category = "Material";
        else {
          const lower = cleanText.toLowerCase();
          if (lower.includes("fit")) category = "Fit";
          else if (lower.includes("size")) category = "Size";
          else if (lower.includes("color") || lower.includes("colour")) category = "Color";
          else if (lower.includes("material")) category = "Material";
        }
        const formattedVal = classificationQuery.charAt(0).toUpperCase() + classificationQuery.slice(1);
        toggleOptionValue(category, formattedVal);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setClassificationQuery("");
    }
  }, [llm.isGenerating, isWaitingForClassification, llm.response, classificationQuery]);

  useEffect(() => {
    async function initFields() {
      const userId = await getSelfId();
      setOwner(userId);
      setTime(new Date().toISOString());
      const randSuffix = Math.random().toString(36).substring(2, 8);
      setMatterId(`product_${randSuffix}`);
      setData({
        category: "retail",
        price: "0.00",
        stock: "0"
      });
    }
    initFields();
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need camera roll permissions to select a product image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setData((prev) => ({ ...prev, imageUri: result.assets[0].uri }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image.");
    }
  };

  const handleSave = async () => {
    const finalId = matterId.trim();
    const finalTitle = title.trim();
    if (!finalId) {
      Alert.alert("Validation Error", "Please provide a unique Matter ID.");
      return;
    }
    if (!finalTitle) {
      Alert.alert("Validation Error", "Please enter a title.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const db = getUserDb();
      const finalTime = time.trim() || new Date().toISOString();
      await db.run(
        "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalId,
          code.trim() || null,
          type,
          scope.trim(),
          owner.trim() || null,
          finalTitle,
          isPublic ? 1 : 0,
          JSON.stringify(data),
          finalTime
        ]
      );

      // Also write initial stock realization to the mass table
      const combinations = getVariantCombinations(optionsObj);
      if (combinations.length > 0) {
        for (let i = 0; i < combinations.length; i++) {
          const comb = combinations[i];
          const key = getVariantKey(comb);
          const vPrice = parseFloat(variantInputs[key]?.price ?? data.price ?? "0.00");
          const vStock = parseFloat(variantInputs[key]?.stock ?? "0");
          const massId = `mas_stock_${finalId}_${i}`;
          await db.run(
            "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, data, time) VALUES (?, ?, 'stock', ?, ?, ?, 1, ?, ?)",
            [
              massId,
              finalId,
              scope.trim(),
              vStock,
              vPrice,
              JSON.stringify({ options: comb }),
              finalTime
            ]
          );
        }
      } else {
        const stockQty = data.stock ? parseFloat(data.stock) : 0;
        const productPrice = data.price ? parseFloat(data.price) : 0.0;
        const massId = `mas_stock_${finalId}`;
        await db.run(
          "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, time) VALUES (?, ?, 'stock', ?, ?, ?, 1, ?)",
          [
            massId,
            finalId,
            scope.trim(),
            stockQty,
            productPrice,
            finalTime
          ]
        );
      }
      try {
        await upsertMatterVector(finalId, {
          title: finalTitle,
          type,
          scope: scope.trim(),
          code: code.trim() || null,
          data: JSON.stringify(data)
        });
      } catch (vectorErr) {
        console.error(vectorErr);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save.");
    }
  };

  const renderPill = (
    fieldKey: string,
    label: string,
    color: string,
    value: string | undefined,
    placeholder: string,
    styleOverrides?: { container?: any; text?: any; placeholderTextColor?: string }
  ) => {
    if (fieldKey === "data.category") {
      const current = String(value || "").toLowerCase();
      const cycle = () => {
        const categories = ["beverage", "food", "retail", "service", "other"];
        const idx = categories.indexOf(current);
        const next = categories[(idx + 1) % categories.length];
        setData((prev) => ({ ...prev, category: next }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      };
      const displayVal = current ? current.toUpperCase() : placeholder;
      return (
        <TouchableOpacity
          onPress={cycle}
          style={[styles.sentencePill, { backgroundColor: color + "12", borderColor: color + "30" }, styleOverrides?.container]}
          activeOpacity={0.7}
        >
          <Text style={[styles.sentencePillText, { color }, styleOverrides?.text]}>{displayVal}</Text>
        </TouchableOpacity>
      );
    }

    const displayValue = fieldKey === "data.price" && value ? String(value).replace(/^\$/, "") : (value ?? "");
    return (
      <TextInput
        style={[
          styles.sentencePill,
          styles.sentencePillText,
          { backgroundColor: color + "12", borderColor: color + "30", color, minWidth: 80, textAlign: "center" },
          styleOverrides?.container,
          styleOverrides?.text
        ]}
        value={displayValue}
        onChangeText={(text) => {
          let cleanText = text;
          if (fieldKey === "data.price") cleanText = text.replace(/^\$/, "");
          if (fieldKey === "title") setTitle(cleanText);
          else if (fieldKey.startsWith("data.")) {
            const subKey = fieldKey.split(".")[1];
            setData((prev) => ({ ...prev, [subKey]: cleanText }));
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={styleOverrides?.placeholderTextColor ?? (color + "80")}
        multiline={false}
        autoCapitalize="none"
      />
    );
  };



  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, marginTop: 10 }}>
        <ScrollView style={styles.editorArea} contentContainerStyle={styles.editorScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.sentenceTypeBadge}>
                <Text style={styles.sentenceTypeBadgeText}>PRODUCT</Text>
              </View>
              <View style={[styles.badgeBase, { backgroundColor: "#3b82f612" }]}>
                {renderPill("data.category", "Category", "#3b82f6", data.category, "CATEGORY", {
                  container: { borderWidth: 0, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: "transparent" },
                  text: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }
                })}
              </View>
            </View>
          </View>

          <View style={{ width: "100%", gap: 16 }}>
            <View style={{ alignItems: 'flex-start', marginBottom: 4 }}>
              {renderPill("title", "Title", "#18181b", title, "Everyday Sneakers", {
                container: {
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  fontSize: 26,
                  fontWeight: "800",
                  textAlign: "left",
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                  borderRadius: 0,
                  width: "100%",
                },
                placeholderTextColor: "#d1d5db"
              })}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#52525b", marginRight: 2 }}>USD$</Text>
                  {renderPill("data.price", "Price", "#18181b", data.price, "89.00", {
                    container: {
                      backgroundColor: "transparent",
                      borderWidth: 0,
                      fontSize: 14,
                      fontWeight: "700",
                      textAlign: "left",
                      paddingVertical: 0,
                      paddingHorizontal: 0,
                      minWidth: 60,
                    },
                    placeholderTextColor: "#a1a1aa"
                  })}
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#52525b", marginRight: 4 }}>Stock:</Text>
                  {renderPill("data.stock", "Stock", "#18181b", data.stock, "10", {
                    container: {
                      backgroundColor: "transparent",
                      borderWidth: 0,
                      fontSize: 14,
                      fontWeight: "700",
                      textAlign: "left",
                      paddingVertical: 0,
                      paddingHorizontal: 0,
                      minWidth: 60,
                    },
                    placeholderTextColor: "#a1a1aa"
                  })}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 16,
                backgroundColor: "#f4f4f5",
                overflow: "hidden",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 8
              }}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {data.imageUri ? (
                <Image source={{ uri: data.imageUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="image-outline" size={48} color="#d4d4d8" />
                  <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Add product photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {Object.entries(optionsObj).map(([key, vals]) => {
              if (!vals || vals.length === 0) return null;
              const isColor = key.toLowerCase() === "color" || key.toLowerCase() === "colour";
              const isSize = key.toLowerCase() === "size";
              return (
                <View key={key} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#18181b", marginRight: 8 }}>{key}</Text>
                    {isColor && <Text style={{ fontSize: 13, fontWeight: "500", color: "#a1a1aa" }}>{vals[0]}</Text>}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {vals.map((val, idx) => {
                      if (isColor) {
                        const hasColorCircle = [
                          "red", "blue", "green", "yellow", "orange", "purple", 
                          "pink", "brown", "black", "white", "gray", "grey", "silver", "gold"
                        ].includes(val.toLowerCase());
                        return (
                          <TouchableOpacity 
                            key={idx} 
                            onPress={() => shiftOptionValueLeft(key, idx)}
                            activeOpacity={0.7}
                            style={{ 
                              width: 28, height: 28, borderRadius: 14, 
                              backgroundColor: hasColorCircle ? val.toLowerCase() : "#e4e4e7",
                              borderWidth: val.toLowerCase() === "white" ? 1 : 0,
                              borderColor: "#d4d4d8",
                              shadowColor: "#000", shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1
                            }} 
                          />
                        );
                      } else if (isSize) {
                        return (
                          <TouchableOpacity 
                            key={idx}
                            onPress={() => shiftOptionValueLeft(key, idx)}
                            activeOpacity={0.7}
                            style={{ 
                              minWidth: 44, height: 36, paddingHorizontal: 8, borderRadius: 8, 
                              backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e4e4e7",
                              justifyContent: "center", alignItems: "center"
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#18181b" }}>{getSizeShortCode(val)}</Text>
                          </TouchableOpacity>
                        );
                      } else {
                        return (
                          <TouchableOpacity 
                            key={idx}
                            onPress={() => shiftOptionValueLeft(key, idx)}
                            activeOpacity={0.7}
                            style={{ 
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, 
                              backgroundColor: "#f4f4f5", borderWidth: 1, borderColor: "#e4e4e7",
                              justifyContent: "center", alignItems: "center"
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#3f3f46" }}>{val}</Text>
                          </TouchableOpacity>
                        );
                      }
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Variants Inventory & Pricing Table */}
          {Object.keys(optionsObj).length > 0 && (
            <View style={{ marginTop: 20, borderTopWidth: 1, borderColor: "#e4e4e7", paddingTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#71717a", marginBottom: 12, letterSpacing: 0.5 }}>
                VARIANTS STOCK & PRICING
              </Text>
              {getVariantCombinations(optionsObj).map((comb) => {
                const key = getVariantKey(comb);
                const displayLabel = Object.entries(comb)
                  .map(([k, v]) => `${v}`)
                  .join(" / ");
                  
                const vPrice = variantInputs[key]?.price ?? data.price ?? "0.00";
                const vStock = variantInputs[key]?.stock ?? "0";
                
                return (
                  <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 0.5, borderColor: "#f4f4f5" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#3f3f46", flex: 1 }}>
                      {displayLabel}
                    </Text>
                    
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {/* Price Input */}
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f4f4f5", borderRadius: 8, paddingHorizontal: 8, height: 32 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#71717a", marginRight: 2 }}>$</Text>
                        <TextInput
                          style={{ fontSize: 12, fontWeight: "600", color: "#18181b", width: 50, padding: 0 }}
                          value={vPrice}
                          onChangeText={(text) => {
                            setVariantInputs(prev => ({
                              ...prev,
                              [key]: { ...(prev[key] || {}), price: text }
                            }));
                          }}
                          keyboardType="numeric"
                          placeholder="0.00"
                        />
                      </View>
                      
                      {/* Stock Input */}
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f4f4f5", borderRadius: 8, paddingHorizontal: 8, height: 32 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#71717a", marginRight: 4 }}>Qty:</Text>
                        <TextInput
                          style={{ fontSize: 12, fontWeight: "600", color: "#18181b", width: 40, padding: 0 }}
                          value={vStock}
                          onChangeText={(text) => {
                            setVariantInputs(prev => ({
                              ...prev,
                              [key]: { ...(prev[key] || {}), stock: text }
                            }));
                          }}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Kinetic Ledger / Opcode Operations Section */}
          <View style={styles.opcodeSection}>
            <View style={styles.opcodeSectionHeader}>
              <Ionicons name="git-network-outline" size={16} color="#71717a" />
              <Text style={styles.opcodeSectionTitle}>KINETIC LEDGER ACTIONS</Text>
            </View>
            <Text style={styles.opcodeSectionDesc}>
              Simulate actions and log status transitions in the append-only timeline stream (motion ledger).
            </Text>

            <View style={styles.opcodeGrid}>
              {PRODUCT_OPCODES.map((opt) => {
                const isActive = selectedOpcode?.code === opt.code;
                return (
                  <TouchableOpacity
                    key={opt.code}
                    style={[
                      styles.opcodeBtn,
                      { borderColor: opt.color + "40" },
                      isActive && { backgroundColor: opt.color + "10", borderColor: opt.color }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isActive) {
                        setSelectedOpcode(null);
                      } else {
                        setSelectedOpcode(opt);
                        setActionStatus(opt.defaultStatus);
                        setActionDelta(opt.hasDelta ? String(opt.defaultDelta ?? 0) : "");
                        setActionData(JSON.stringify(opt.defaultData));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.opcodeIndicator, { backgroundColor: opt.color }]} />
                    <Text style={styles.opcodeBtnLabel}>{opt.label}</Text>
                    <Text style={styles.opcodeBtnSub}>OP {opt.code}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedOpcode && (
              <View style={[styles.opcodeDetailsCard, { borderColor: selectedOpcode.color + "40" }]}>
                <View style={styles.opcodeDetailsHeader}>
                  <Text style={[styles.opcodeDetailsTitle, { color: selectedOpcode.color }]}>
                    Configure OP {selectedOpcode.code}: {selectedOpcode.label}
                  </Text>
                </View>

                <View style={styles.opcodeInputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opcodeInputLabel}>Status</Text>
                    <TextInput
                      style={styles.opcodeInput}
                      value={actionStatus}
                      onChangeText={setActionStatus}
                      placeholder="e.g. COMPLETED"
                    />
                  </View>

                  {selectedOpcode.hasDelta && (
                    <View style={{ width: 100 }}>
                      <Text style={styles.opcodeInputLabel}>Delta Value</Text>
                      <TextInput
                        style={styles.opcodeInput}
                        value={actionDelta}
                        onChangeText={setActionDelta}
                        keyboardType="numeric"
                        placeholder="e.g. 150"
                      />
                    </View>
                  )}
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.opcodeInputLabel}>JSON Payload (data)</Text>
                  <TextInput
                    style={[styles.opcodeInput, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, height: 60 }]}
                    value={actionData}
                    onChangeText={setActionData}
                    multiline
                    placeholder="{}"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.opcodeSubmitBtn, { backgroundColor: selectedOpcode.color }]}
                  onPress={() => executeOpcodeAction(selectedOpcode)}
                  disabled={isExecutingOpcode}
                  activeOpacity={0.8}
                >
                  {isExecutingOpcode ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.opcodeSubmitBtnText}>LOG TRANSACTION</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomStickyBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContainer}>
            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                const scopes = ["g", "p", "d"];
                const idx = scopes.indexOf(scope);
                const next = scopes[(idx + 1) % scopes.length];
                setScope(next);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }} 
              activeOpacity={0.7}
            >
              <Ionicons name="earth" size={14} color="#52525b" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{scope.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                if (Platform.OS === "ios" || Platform.OS === "android") {
                  Alert.prompt("Edit SKU Code", "Enter SKU / matter code:", [{ text: "Cancel", style: "cancel" }, { text: "OK", onPress: (val?: string) => setCode(val || "") }], "plain-text", code);
                } else {
                  const val = prompt("Enter SKU / matter code:", code);
                  if (val !== null) setCode(val);
                }
              }} 
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag-outline" size={14} color="#52525b" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{code || "Code"}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsPublic(!isPublic);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={isPublic ? "eye-outline" : "eye-off-outline"} size={14} color="#52525b" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{isPublic ? "Public" : "Private"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.chip} onPress={() => setShowOptionsModal(true)} activeOpacity={0.7}>
              <Text style={styles.chipText}>Options</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />
            <TouchableOpacity style={[styles.chip, { backgroundColor: "#ec4899", borderColor: "#ec4899" }]} onPress={handleSave} activeOpacity={0.8}>
              <Text style={[styles.chipText, { color: "white" }]}>Publish</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showOptionsModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowOptionsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#18181b" }}>Product Options</Text>
            <TouchableOpacity onPress={() => setShowOptionsModal(false)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#18181b" }}>
              <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f4f4f5", backgroundColor: "#fafafa" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                style={{ flex: 1, height: 40, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 20, paddingHorizontal: 16, fontSize: 14, color: "#18181b" }}
                placeholder="Quick add (e.g. 'navy', 'linen', 'L')..."
                placeholderTextColor="#a1a1aa"
                value={quickAddText}
                onChangeText={setQuickAddText}
                onSubmitEditing={handleQuickAddSubmit}
              />
              <TouchableOpacity onPress={handleQuickAddSubmit} style={{ height: 40, paddingHorizontal: 16, backgroundColor: "#18181b", borderRadius: 20, justifyContent: "center", alignItems: "center" }}>
                {isWaitingForClassification ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>Add</Text>}
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: "#a1a1aa", marginTop: 6, marginLeft: 8 }}>
              {"AI classifies your entry (e.g. 'crimson' → Color, 'XL' → Size)."}
            </Text>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {GLOBAL_OPTIONS_PRESETS.map((optionGroup) => {
              const key = optionGroup.key;
              const currentVals = data.options?.[key] || [];
              const allValues = Array.from(new Set([...optionGroup.presets, ...currentVals]));
              return (
                <View key={key} style={{ marginBottom: 24, borderBottomWidth: 1, borderBottomColor: "#f4f4f5", paddingBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#18181b", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{key}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    {allValues.map((val) => {
                      const isSelected = currentVals.includes(val);
                      return (
                        <TouchableOpacity
                          key={val}
                          onPress={() => toggleOptionValue(key, val)}
                          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: isSelected ? "#18181b" : "#e4e4e7", backgroundColor: isSelected ? "#18181b" : "#ffffff" }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 13, fontWeight: isSelected ? "700" : "500", color: isSelected ? "#ffffff" : "#52525b" }}>{val}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <OptionsModalInput onAdd={(newVal) => toggleOptionValue(key, newVal)} />
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  editorArea: { flex: 1 },
  editorScrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  bottomStickyBar: { backgroundColor: "white", borderTopWidth: 0.5, borderTopColor: "#e4e4e7" },
  chipsScrollContainer: { paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", gap: 6, flexGrow: 1 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "#f4f4f5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  sentenceTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#f4f4f5" },
  sentenceTypeBadgeText: { fontSize: 11, fontWeight: "700", color: "#18181b" },
  badgeBase: { borderRadius: 6, overflow: "hidden" },
  sentencePill: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center" },
  sentencePillText: { fontSize: 14, fontWeight: "600", color: "#27272a" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#f4f4f5", paddingBottom: 12, marginBottom: 16 },
  opcodeSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 20,
    paddingBottom: 20,
  },
  opcodeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  opcodeSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#71717a",
    letterSpacing: 1,
  },
  opcodeSectionDesc: {
    fontSize: 12,
    color: "#a1a1aa",
    marginBottom: 14,
    lineHeight: 16,
  },
  opcodeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  opcodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
    gap: 6,
  },
  opcodeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  opcodeBtnLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#27272a",
  },
  opcodeBtnSub: {
    fontSize: 9,
    fontWeight: "700",
    color: "#a1a1aa",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  opcodeDetailsCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    padding: 14,
    marginTop: 8,
  },
  opcodeDetailsHeader: {
    marginBottom: 10,
  },
  opcodeDetailsTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  opcodeInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  opcodeInputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  opcodeInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: "#18181b",
    marginTop: 4,
  },
  opcodeSubmitBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  opcodeSubmitBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
});
