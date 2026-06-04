import React, { useState, useEffect, useRef } from "react";
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
  Switch,
  ActivityIndicator,
  Image,
  Modal
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { getUserDb, getSelfId } from "../lib/db";
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

const mergeParsedFields = (prevData: Record<string, any>, parsedFields: Record<string, any>, isAddAction: boolean) => {
  const merged = { ...prevData };
  for (const key of Object.keys(parsedFields)) {
    const newVal = parsedFields[key];
    const prevVal = prevData[key];
    
    if (isAddAction && prevVal !== undefined && prevVal !== null) {
      const prevStr = String(prevVal).trim();
      const newStr = String(newVal).trim();
      
      const appendableKeys = ["color", "colour", "size", "fields", "categories", "tags", "options"];
      if (appendableKeys.includes(key)) {
        const prevArray = prevStr.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
        const newArray = newStr.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
        const combined = Array.from(new Set([...prevArray, ...newArray])).join(", ");
        merged[key] = combined;
      } else if (key === "stock" && !isNaN(Number(prevVal)) && !isNaN(Number(newVal))) {
        merged[key] = Number(prevVal) + Number(newVal);
      } else {
        merged[key] = newVal;
      }
    } else {
      merged[key] = newVal;
    }
  }
  return merged;
};

interface OptionValueInputProps {
  placeholder: string;
  onAdd: (text: string) => void;
}

const OptionValueInput = ({ placeholder, onAdd }: OptionValueInputProps) => {
  const [val, setVal] = useState("");
  return (
    <TextInput
      style={styles.customValueInput}
      placeholder={placeholder}
      placeholderTextColor="#94a3b8"
      value={val}
      onChangeText={setVal}
      onSubmitEditing={() => {
        const trimmed = val.trim();
        if (trimmed) {
          onAdd(trimmed);
          setVal("");
        }
      }}
    />
  );
};

export default function CreateMatterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Core Matter Fields (matching all 9 schema columns)
  const [matterId, setMatterId] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("note"); // product, task, profile, form, note
  const [scope, setScope] = useState("p"); // p, g, d, s:diner
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [time, setTime] = useState("");

  // Visual "data" state (JSON properties payload)
  const [data, setData] = useState<Record<string, any>>({});

  // Local AI Input State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isWaitingForAi, setIsWaitingForAi] = useState(false);
  const isAddActionRef = useRef(false);

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [quickAddText, setQuickAddText] = useState("");
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
    if (index === 0) return; // Can't shift first item left
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Check if color is stored in data.color / data.colour
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
    
    // Check if size is stored in data.size
    if (key.toLowerCase() === "size") {
      if (data.size) {
        const sizes = getSizesList(data.size);
        if (sizes.length > 1 && index < sizes.length) {
          const newSizes = [...sizes];
          const temp = newSizes[index];
          newSizes[index] = newSizes[index - 1];
          newSizes[index - 1] = temp;
          setData(prev => ({ ...prev, size: newSizes.join(", ") }));
          return;
        }
      }
    }
    
    // Otherwise it is in data.options
    setData(prev => {
      const currentOptions = { ...(prev.options || {}) };
      const existingKey = Object.keys(currentOptions).find(k => k.toLowerCase() === key.toLowerCase());
      if (existingKey) {
        const currentVals = [...(currentOptions[existingKey] || [])];
        if (currentVals.length > 1 && index < currentVals.length) {
          const temp = currentVals[index];
          currentVals[index] = currentVals[index - 1];
          currentVals[index - 1] = temp;
          currentOptions[existingKey] = currentVals;
        }
      }
      return { ...prev, options: currentOptions };
    });
  };

  const handleQuickAddSubmit = async () => {
    const query = quickAddText.trim();
    if (!query) return;
    
    setQuickAddText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // 1. Check exact/partial presets first
    for (const group of GLOBAL_OPTIONS_PRESETS) {
      const found = group.presets.find(p => p.toLowerCase() === query.toLowerCase());
      if (found) {
        toggleOptionValue(group.key, found);
        return;
      }
    }
    
    // 2. Client-side common keywords classifier
    const colorsList = [
      "red", "blue", "green", "yellow", "black", "white", "purple", "pink", "orange", "grey", "gray", 
      "brown", "silver", "gold", "beige", "navy", "teal", "crimson", "magenta", "olive", "burgundy", 
      "lavender", "violet", "peach", "rust", "plum", "charcoal", "maroon", "khaki", "tan", "mustard"
    ];
    const sizesList = ["s", "m", "l", "xl", "xxl", "xs", "small", "medium", "large", "extra large", "xxxl", "xxxxl", "petite", "tall"];
    const materialsList = [
      "cotton", "leather", "polyester", "wool", "silk", "canvas", "denim", "linen", "satin", "nylon", 
      "velvet", "suede", "fleece", "mesh", "wood", "metal", "plastic", "glass", "corduroy", "acrylic", 
      "cashmere", "spandex", "viscose", "flannel", "chiffon", "rayon"
    ];
    const fitsList = [
      "regular", "slim", "oversized", "loose", "athletic", "relaxed", "skinny", "tapered", "baggy", 
      "fitted", "straight", "cropped", "wide leg", "bootcut"
    ];
    
    let matchedKey: string | null = null;
    if (colorsList.includes(query.toLowerCase())) {
      matchedKey = "Color";
    } else if (sizesList.includes(query.toLowerCase()) || !isNaN(Number(query)) || /^\d+(\.\d+)?$/.test(query)) {
      matchedKey = "Size";
    } else if (materialsList.includes(query.toLowerCase())) {
      matchedKey = "Material";
    } else if (fitsList.includes(query.toLowerCase())) {
      matchedKey = "Fit";
    }
    
    if (matchedKey) {
      const formattedVal = query.charAt(0).toUpperCase() + query.slice(1);
      toggleOptionValue(matchedKey, formattedVal);
      return;
    }
    
    // 3. Fallback to Local LLM classification
    if (!isReady || llm.isGenerating) {
      const formattedVal = query.charAt(0).toUpperCase() + query.slice(1);
      toggleOptionValue("Material", formattedVal);
      return;
    }
    
    setIsWaitingForClassification(true);
    setClassificationQuery(query);
    
    try {
      const promptText = `System: Classify the input value into one of these category names: Color, Size, Material, Fit. Output ONLY the category name.
      
      Input: "crimson"
      Output: Color
      
      Input: "linen"
      Output: Material
      
      Input: "xxlarge"
      Output: Size
      
      Input: "loose"
      Output: Fit
      
      Input: "${query}"
      Output:`;
      
      await llm.sendMessage(promptText);
    } catch (e) {
      console.error("Local LLM Classification error:", e);
      setIsWaitingForClassification(false);
      const formattedVal = query.charAt(0).toUpperCase() + query.slice(1);
      toggleOptionValue("Material", formattedVal);
    }
  };

  // New custom metadata fields state
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");

  // Local LLM initialization
  const [activeModel, setActiveModel] = useState<any>(LFM_MODELS.LFM2_5_350M_FP16);
  const [isModelLoading, setIsModelLoading] = useState(true);

  const logAiStep = (
    step: "input" | "output" | "fill" | "error" | "info",
    title: string,
    details: string
  ) => {
    console.log(`\n=================== [AI ${step.toUpperCase()}] ===================`);
    console.log(`Title: ${title}`);
    console.log(`Details:\n${details}`);
    console.log(`=========================================================\n`);
  };

  useEffect(() => {
    async function loadSelectedModel() {
      try {
        const storedModelId = await SecureStore.getItemAsync("selected_lfm_model_id");
        if (storedModelId && LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]) {
          const model = LFM_MODELS[storedModelId as keyof typeof LFM_MODELS];
          setActiveModel(model);
          logAiStep("info", "Selected Model Loaded", `Loaded stored model: ${storedModelId}\nName: ${model.name || 'Unnamed'}`);
        } else {
          logAiStep("info", "Default Model Loaded", `Using default model: LFM2_5_350M_FP16`);
        }
      } catch (e) {
        console.error("Error loading selected model for compose AI:", e);
        logAiStep("error", "Failed to Load Selected Model", String(e));
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

  const { configure, isReady } = llm;

  useEffect(() => {
    if (isReady) {
      logAiStep("info", "Local LLM Ready", "The local LLM engine is configured and ready for processing.");
    }
  }, [isReady]);

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
        const selectedUri = result.assets[0].uri;
        setData((prev) => ({ ...prev, imageUri: selectedUri }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image from gallery.");
    }
  };

  // Helper to get standard keys for each type
  const getStandardKeys = (currentType: string): string[] => {
    if (currentType === "product") return ["price", "category", "supplier", "color", "colour", "size", "options", "image", "imageUri"];
    if (currentType === "task") return ["priority", "status", "assignee"];
    if (currentType === "profile") return ["email", "role", "phone"];
    if (currentType === "note") return ["text"];
    if (currentType === "form") return ["fields"];
    return [];
  };

  // Helper to filter data keys based on type
  const filterDataForType = (currentType: string, currentData: Record<string, any>) => {
    const filtered: Record<string, any> = {};
    const standardKeys = getStandardKeys(currentType);
    
    // Standard keys of all OTHER types to strip when changing types
    const otherTypesStandardKeys = [
      "price", "stock", "category", "supplier",
      "priority", "status", "assignee",
      "email", "role", "phone",
      "text",
      "fields"
    ].filter((k) => !standardKeys.includes(k));

    Object.keys(currentData).forEach((k) => {
      if (!otherTypesStandardKeys.includes(k) && currentData[k] !== undefined) {
        filtered[k] = currentData[k];
      }
    });
    return filtered;
  };



  const renderInteractiveSentence = () => {
    const renderPill = (
      fieldKey: string,
      label: string,
      color: string,
      value: string | undefined,
      placeholder: string,
      styleOverrides?: {
        container?: any;
        text?: any;
        placeholderTextColor?: string;
      }
    ) => {
      if (fieldKey === "data.priority") {
        const current = String(value || "").toLowerCase();
        const cycle = () => {
          const priorities = ["low", "medium", "high"];
          const idx = priorities.indexOf(current);
          const next = priorities[(idx + 1) % priorities.length];
          setData((prev) => ({ ...prev, priority: next }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        };
        const displayVal = current ? current.toUpperCase() : placeholder;
        return (
          <TouchableOpacity
            onPress={cycle}
            style={[
              styles.sentencePill,
              { backgroundColor: color + "12", borderColor: color + "30" },
              styleOverrides?.container
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.sentencePillText, { color: color }, styleOverrides?.text]}>
              {displayVal}
            </Text>
          </TouchableOpacity>
        );
      }

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
            style={[
              styles.sentencePill,
              { backgroundColor: color + "12", borderColor: color + "30" },
              styleOverrides?.container
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.sentencePillText, { color: color }, styleOverrides?.text]}>
              {displayVal}
            </Text>
          </TouchableOpacity>
        );
      }


      if (fieldKey === "data.status") {
        const current = String(value || "").toLowerCase();
        const cycle = () => {
          const statuses = ["todo", "in_progress", "done", "backlog"];
          const idx = statuses.indexOf(current);
          const next = statuses[(idx + 1) % statuses.length];
          setData((prev) => ({ ...prev, status: next }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        };
        const displayVal = current ? current.replace("_", " ").toUpperCase() : placeholder;
        return (
          <TouchableOpacity
            onPress={cycle}
            style={[
              styles.sentencePill,
              { backgroundColor: color + "12", borderColor: color + "30" },
              styleOverrides?.container
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.sentencePillText, { color: color }, styleOverrides?.text]}>
              {displayVal}
            </Text>
          </TouchableOpacity>
        );
      }

      const isPlaceholder = !value || String(value).trim() === "";
      const displayValue = fieldKey === "data.price" && value ? String(value).replace(/^\$/, "") : (value ?? "");
      return (
        <TextInput
          style={[
            styles.sentencePill,
            styles.sentencePillText,
            { 
              backgroundColor: color + "12", 
              borderColor: color + "30",
              color: color,
              minWidth: 80,
              textAlign: "center",
            },
            styleOverrides?.container,
            styleOverrides?.text
          ]}
          value={displayValue}
          onChangeText={(text) => {
            let cleanText = text;
            if (fieldKey === "data.price") {
              cleanText = text.replace(/^\$/, "");
            }
            if (fieldKey === "title") {
              setTitle(cleanText);
            } else if (fieldKey.startsWith("data.")) {
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

    const customFields = Object.entries(data).filter(([k]) => !getStandardKeys(type).includes(k));

    const renderTypePill = () => {
      return (
        <View style={{ zIndex: 1000, display: "flex", flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity 
            style={styles.sentenceTypeBadge} 
            onPress={() => setShowTypeDropdown(!showTypeDropdown)}
            activeOpacity={0.7}
          >
            <Text style={styles.sentenceTypeBadgeText}>{type.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={10} color="#18181b" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {showTypeDropdown && (
            <View style={styles.typeDropdownMenu}>
              {["task", "product", "profile", "form", "note"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeDropdownItem, type === t && styles.typeDropdownItemActive]}
                  onPress={() => {
                    handleTypeSelect(t);
                    setShowTypeDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeDropdownItemText, type === t && styles.typeDropdownItemTextActive]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      );
    };

    const renderText = (str: string) => (
      <Text style={styles.sentenceDirectText}>{str}</Text>
    );

    const renderOptionsPill = () => {
      const optionsObj = data.options || {};
      const keys = Object.keys(optionsObj);
      const color = "#8b5cf6"; // Purple color for options

      return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
          {keys.map((k) => {
            const valsCount = optionsObj[k]?.length || 0;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => {
                  setActiveValuesKey(k);
                }}
                style={[
                  styles.sentencePill,
                  { backgroundColor: color + "12", borderColor: color + "30" }
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.sentencePillText, { color: color }]}>
                  {k} ({valsCount})
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={() => {
              setShowOptionsPanel(true);
            }}
            style={[
              styles.sentencePill,
              { backgroundColor: "#f4f4f5", borderColor: "#e4e4e7" }
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.sentencePillText, { color: "#71717a" }]}>
              + Manage
            </Text>
          </TouchableOpacity>
        </View>
      );
    };

    const renderCardHeader = () => {
      return (
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {renderTypePill()}
            {type === "product" && (
              <View style={[styles.badgeBase, { backgroundColor: "#3b82f612" }]}>
                {renderPill("data.category", "Category", "#3b82f6", data.category, "CATEGORY", {
                  container: { borderWidth: 0, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: "transparent" },
                  text: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }
                })}
              </View>
            )}
          </View>

          {/* Right-side status indicators */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>


            {type === "task" && (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                {renderPill("data.priority", "Priority", "#ef4444", data.priority, "PRIORITY", {
                  container: { borderStyle: "solid", paddingVertical: 3, paddingHorizontal: 8 },
                  text: { fontSize: 9, fontWeight: "700" }
                })}
                {renderPill("data.status", "Status", "#10b981", data.status, "STATUS", {
                  container: { borderStyle: "solid", paddingVertical: 3, paddingHorizontal: 8 },
                  text: { fontSize: 9, fontWeight: "700" }
                })}
              </View>
            )}

            {type === "profile" && (
              <View style={styles.avatarCircleSmall}>
                <Text style={styles.avatarInitialSmall}>{(title || "U").charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
      );
    };

    const renderCardFooter = () => {
      if (type === "product") {
        return null;
      }

      if (type === "profile") {
        return (
          <View style={{ marginTop: 16 }}>
            <View style={styles.profileContactList}>
              {data.email && (
                <View style={styles.contactItem}>
                  <Ionicons name="mail-outline" size={14} color="#71717a" style={{ marginRight: 6 }} />
                  <Text style={styles.contactItemText}>{data.email}</Text>
                </View>
              )}
              {data.phone && (
                <View style={styles.contactItem}>
                  <Ionicons name="call-outline" size={14} color="#71717a" style={{ marginRight: 6 }} />
                  <Text style={styles.contactItemText}>{data.phone}</Text>
                </View>
              )}
            </View>
          </View>
        );
      }

      if (type === "form") {
        const fields = data.fields ? data.fields.split(",").map((f: string) => f.trim()).filter(Boolean) : [];
        return (
          <View style={{ marginTop: 16 }}>
            {fields.length > 0 ? (
              <View style={styles.formFieldsList}>
                {fields.map((f: string, i: number) => (
                  <View key={i} style={styles.formPreviewField}>
                    <Text style={styles.formPreviewFieldLabel}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                    <View style={styles.formPreviewInputPlaceholder} />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.formCardHelp}>Specify fields above to build form inputs.</Text>
            )}
          </View>
        );
      }

      return null;
    };

    return (
      <View style={styles.unifiedInteractiveCard}>
        {renderCardHeader()}
        
        <View style={styles.cardSentenceBody}>
          {type === "product" && (() => {
            return (
              <View style={{ width: "100%", gap: 16 }}>
                {/* Header: Title and Price */}
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
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
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
                </View>

                {/* Huge Image Placeholder */}
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

                {/* Dynamic Selected Options Display */}
                {(() => {
                  const optionsObj: Record<string, string[]> = {};
                  
                  const directColor = getColorsList(data.color || data.colour);
                  if (directColor && directColor.length > 0) {
                    optionsObj["Color"] = directColor;
                  }
                  
                  const directSize = getSizesList(data.size);
                  if (directSize && directSize.length > 0) {
                    optionsObj["Size"] = directSize;
                  }
                  
                  if (data.options) {
                    Object.entries(data.options as Record<string, string[]>).forEach(([k, v]) => {
                      if (v && v.length > 0) {
                        const normalizedKey = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
                        optionsObj[normalizedKey] = Array.from(new Set([...(optionsObj[normalizedKey] || []), ...v]));
                      }
                    });
                  }
                  
                  return Object.entries(optionsObj).map(([key, vals]) => {
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
                  });
                })()}
              </View>
            );
          })()}

          {type === "task" && (
            <View style={{ width: "100%", gap: 12 }}>
              {renderPill("title", "Title", "#18181b", title, "Untitled Task", {
                container: {
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  fontSize: 24,
                  fontWeight: "800",
                  textAlign: "left",
                  paddingVertical: 6,
                  paddingHorizontal: 0,
                  borderRadius: 0,
                  width: "100%",
                },
                placeholderTextColor: "#d1d5db"
              })}
              
              <View style={styles.storefrontDetailsRow}>
                <Text style={styles.storefrontDetailsLabel}>Assignee</Text>
                {renderPill("data.assignee", "Assignee", "#71717a", data.assignee, "Assign to...", {
                  container: {
                    backgroundColor: "#fafafa",
                    borderColor: "#e4e4e7",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    flex: 1,
                    textAlign: "left"
                  },
                  placeholderTextColor: "#a1a1aa"
                })}
              </View>
            </View>
          )}

          {type === "profile" && (
            <View style={{ width: "100%", gap: 12 }}>
              {renderPill("title", "Name", "#18181b", title, "Untitled Profile", {
                container: {
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  fontSize: 24,
                  fontWeight: "800",
                  textAlign: "left",
                  paddingVertical: 6,
                  paddingHorizontal: 0,
                  borderRadius: 0,
                  width: "100%",
                },
                placeholderTextColor: "#d1d5db"
              })}

              <View style={styles.storefrontDetailsSection}>
                <View style={styles.storefrontDetailsRow}>
                  <Text style={styles.storefrontDetailsLabel}>Role</Text>
                  {renderPill("data.role", "Role", "#71717a", data.role, "Job Role...", {
                    container: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e4e4e7",
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      flex: 1,
                      textAlign: "left"
                    },
                    placeholderTextColor: "#a1a1aa"
                  })}
                </View>

                <View style={styles.storefrontDetailsRow}>
                  <Text style={styles.storefrontDetailsLabel}>Email</Text>
                  {renderPill("data.email", "Email", "#71717a", data.email, "email@example.com", {
                    container: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e4e4e7",
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      flex: 1,
                      textAlign: "left"
                    },
                    placeholderTextColor: "#a1a1aa"
                  })}
                </View>

                <View style={styles.storefrontDetailsRow}>
                  <Text style={styles.storefrontDetailsLabel}>Phone</Text>
                  {renderPill("data.phone", "Phone", "#71717a", data.phone, "+1 (555) 000-0000", {
                    container: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e4e4e7",
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      flex: 1,
                      textAlign: "left"
                    },
                    placeholderTextColor: "#a1a1aa"
                  })}
                </View>
              </View>
            </View>
          )}

          {type === "note" && (
            <View style={{ width: "100%", gap: 12 }}>
              {renderPill("title", "Title", "#18181b", title, "Untitled Note", {
                container: {
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  fontSize: 24,
                  fontWeight: "800",
                  textAlign: "left",
                  paddingVertical: 6,
                  paddingHorizontal: 0,
                  borderRadius: 0,
                  width: "100%",
                },
                placeholderTextColor: "#d1d5db"
              })}
              
              <TextInput
                style={[
                  styles.canvasNotesInput,
                  {
                    backgroundColor: "#fafafa",
                    borderColor: "#e4e4e7",
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 100,
                    fontSize: 14,
                    color: "#18181b",
                    textAlignVertical: "top"
                  }
                ]}
                value={data.text || ""}
                onChangeText={(text) => setData((prev) => ({ ...prev, text }))}
                placeholder="Type note content here..."
                placeholderTextColor="#a1a1aa"
                multiline={true}
                numberOfLines={4}
              />
            </View>
          )}

          {type === "form" && (
            <View style={{ width: "100%", gap: 12 }}>
              {renderPill("title", "Title", "#18181b", title, "Untitled Form", {
                container: {
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  fontSize: 24,
                  fontWeight: "800",
                  textAlign: "left",
                  paddingVertical: 6,
                  paddingHorizontal: 0,
                  borderRadius: 0,
                  width: "100%",
                },
                placeholderTextColor: "#d1d5db"
              })}
              
              <View style={styles.storefrontDetailsRow}>
                <Text style={styles.storefrontDetailsLabel}>Fields</Text>
                {renderPill("data.fields", "Fields", "#71717a", data.fields, "e.g. Name, Email, Age", {
                  container: {
                    backgroundColor: "#fafafa",
                    borderColor: "#e4e4e7",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    flex: 1,
                    textAlign: "left"
                  },
                  placeholderTextColor: "#a1a1aa"
                })}
              </View>
            </View>
          )}
        </View>

        {customFields.length > 0 && (
          <View style={styles.sentenceCustomSection}>
            <Text style={styles.featureLabel}>Custom Attributes</Text>
            <View style={styles.sentenceCustomList}>
              {customFields.map(([k, val]) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", marginRight: 8, marginBottom: 8 }}>
                  <Text style={[styles.sentenceDirectText, { marginRight: 4 }]}>{k}:</Text>
                  <TextInput
                    style={[
                      styles.sentencePill,
                      styles.sentencePillText,
                      { 
                        backgroundColor: "#6b728012", 
                        borderColor: "#6b728030",
                        color: "#4b5563",
                        minWidth: 80,
                        textAlign: "center",
                      }
                    ]}
                    value={String(val)}
                    onChangeText={(text) => {
                      setData((prev) => ({ ...prev, [k]: text }));
                    }}
                    placeholder={`[${k}]`}
                    placeholderTextColor="#6b728080"
                    multiline={false}
                    autoCapitalize="none"
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {renderCardFooter()}
      </View>
    );
  };

  // Monitor LLM state for processing result
  useEffect(() => {
    if (isWaitingForAi && !llm.isGenerating) {
      setIsWaitingForAi(false);
      const finalResponse = llm.response;
      console.log("LOG: AI processing finished. Raw response from LLM:", finalResponse);
      
      if (finalResponse) {
        logAiStep("output", "AI Raw Output Received", finalResponse);
        
        let cleanResponse = finalResponse.trim();
        console.log("LOG: Trimmed response:", cleanResponse);
        
        // Clean markdown code blocks if present
        if (cleanResponse.startsWith("```")) {
          cleanResponse = cleanResponse.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
          console.log("LOG: Removed code block wrapping. Cleaned:", cleanResponse);
          logAiStep("info", "Removed Markdown Wrapping", cleanResponse);
        }
        
        try {
          // Robust brace extraction parsing
          const firstBrace = cleanResponse.indexOf("{");
          const lastBrace = cleanResponse.lastIndexOf("}");
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error("No opening/closing curly brace found in response");
          }
          
          let candidate = cleanResponse.substring(firstBrace, lastBrace + 1);
          console.log("LOG: Extracted brace candidate block:", candidate);
          
          // Match open/close braces to discard trailing noise or extra braces
          let openCount = 0;
          let finalJsonString = "";
          for (let i = 0; i < candidate.length; i++) {
            const char = candidate[i];
            if (char === "{") openCount++;
            if (char === "}") openCount--;
            finalJsonString += char;
            if (openCount === 0 && i > 0) {
              break;
            }
          }
          
          console.log("LOG: Final parsed candidate string:", finalJsonString);
          logAiStep("info", "JSON Block Extracted", finalJsonString);
          
          const parsed = JSON.parse(finalJsonString);
          console.log("LOG: JSON successfully parsed:", parsed);
          
          if (parsed && typeof parsed === "object") {
            const cleanedParsed = filterDataForType(type, parsed);
            const currentFiltered = filterDataForType(type, data);
            const merged = mergeParsedFields(currentFiltered, cleanedParsed, isAddActionRef.current);
            
            setData((prev) => {
              const updated = mergeParsedFields(filterDataForType(type, prev), cleanedParsed, isAddActionRef.current);
              console.log("LOG: Merged data payload state:", updated);
              return updated;
            });
            
            logAiStep("fill", "Form Fields Populated (Fill)", `Extracted Fields:\n${JSON.stringify(cleanedParsed, null, 2)}\n\nMerged State Data:\n${JSON.stringify(merged, null, 2)}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            throw new Error("Parsed result is not a JSON object");
          }
        } catch (e: any) {
          console.error("LOG: Parsing failure:", e);
          logAiStep("error", "AI Output Parsing Failed", `Cleaned response was:\n"${cleanResponse}"\n\nError: ${e?.message || String(e)}`);
          Alert.alert("AI Error", `Failed to parse AI output. Output: "${cleanResponse}". Error: ${e?.message || e}`);
        }
      } else {
        logAiStep("error", "Empty Output Received", "Local LLM returned an empty or undefined response.");
      }
    }
  }, [llm.isGenerating, isWaitingForAi, llm.response]);

  useEffect(() => {
    if (isWaitingForClassification && !llm.isGenerating) {
      setIsWaitingForClassification(false);
      const responseText = llm.response;
      if (responseText && classificationQuery) {
        console.log("LOG: Raw LLM classification response:", responseText);
        // Extract words from the response
        const cleanText = responseText.trim().replace(/[^a-zA-Z\s]/g, "");
        const words = cleanText.toLowerCase().split(/\s+/);
        
        let category = "Material"; // Default fallback
        
        // Prioritize Fit, then Size, then Color, then Material checks based on exact word matches
        if (words.includes("fit")) {
          category = "Fit";
        } else if (words.includes("size")) {
          category = "Size";
        } else if (words.includes("color") || words.includes("colour")) {
          category = "Color";
        } else if (words.includes("material")) {
          category = "Material";
        } else {
          // If no exact word, check presence of substring
          const lower = cleanText.toLowerCase();
          if (lower.includes("fit")) category = "Fit";
          else if (lower.includes("size")) category = "Size";
          else if (lower.includes("color") || lower.includes("colour")) category = "Color";
          else if (lower.includes("material")) category = "Material";
        }
        
        console.log(`LOG: Classified "${classificationQuery}" as "${category}"`);
        const formattedVal = classificationQuery.charAt(0).toUpperCase() + classificationQuery.slice(1);
        toggleOptionValue(category, formattedVal);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setClassificationQuery("");
    }
  }, [llm.isGenerating, isWaitingForClassification, llm.response]);

  // Initialize fields on Mount
  useEffect(() => {
    async function initFields() {
      const userId = await getSelfId();
      setOwner(userId);
      setTime(new Date().toISOString());
      
      const randSuffix = Math.random().toString(36).substring(2, 8);
      setMatterId(`note_${randSuffix}`);
    }
    initFields();
  }, []);

  const handleTypeSelect = (selectedType: string) => {
    setType(selectedType);
    setData({}); // clear data attributes for new visual canvas type
    const cleanType = selectedType.toLowerCase().replace(/[^a-z0-9]/g, "");
    const randSuffix = Math.random().toString(36).substring(2, 8);
    setMatterId(`${cleanType}_${randSuffix}`);
  };

  const generateRandomId = () => {
    const cleanType = type.toLowerCase().replace(/[^a-z0-9]/g, "");
    const prefix = cleanType ? `${cleanType}_` : "mat_";
    const randSuffix = Math.random().toString(36).substring(2, 8);
    setMatterId(`${prefix}${randSuffix}`);
  };

  // Helper to update visual data payload fields
  const updateDataField = (key: string, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // AI local LLM processing routine
  const handleAiProcess = async () => {
    if (!aiPrompt.trim()) return;
    const prompt = aiPrompt.trim();
    setAiPrompt("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // 1. Try to parse directly on client-side first for instant/reliable response
    const patterns = [
      /^(?:add|set|change|update)\s+([a-z0-9_-]+)[\s,:]+(?:is|to|level)?\s*(.+)$/i,
      /^([a-z0-9_-]+)[\s,:]+(?:is|to|level)?\s*(.+)$/i
    ];

    let directParsed: Record<string, any> | null = null;
    for (const regex of patterns) {
      const match = prompt.match(regex);
      if (match) {
        let key = match[1].toLowerCase();
        if (key === "colour") key = "color";
        const valStr = match[2].trim();
        let val: any = valStr;
        if (/^\d+$/.test(valStr)) {
          val = parseInt(valStr, 10);
        } else if (/^\d+\.\d+$/.test(valStr)) {
          val = parseFloat(valStr);
        }
        directParsed = { [key]: val };
        break;
      }
    }

    const isAddAction = prompt.toLowerCase().startsWith("add");
    isAddActionRef.current = isAddAction;

    if (directParsed) {
      console.log("LOG: Direct parser matched successfully:", directParsed);
      logAiStep("fill", "Direct Parse Match (Instant)", JSON.stringify(directParsed, null, 2));
      
      const cleanedParsed = filterDataForType(type, directParsed);
      setData((prev) => {
        const updated = mergeParsedFields(filterDataForType(type, prev), cleanedParsed, isAddAction);
        console.log("LOG: Merged data payload state:", updated);
        return updated;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // 2. Fall back to LLM for complex/natural language prompts
    if (!isReady || llm.isGenerating) return;
    setIsWaitingForAi(true);

    try {
      const query = `System: Extract the key-value pairs from the request as a valid JSON object. Output ONLY the JSON.

Request: "Price is 50 and category kitchen"
Output: {"price": 50, "category": "kitchen"}

Request: "Add size large"
Output: {"size": "large"}

Request: "${prompt}"
Output:`;

      console.log("LOG: Initiating local LLM call. Prompt query:", query);
      logAiStep("input", "AI Input Submitted (LLM Fallback)", `User Prompt:\n"${prompt}"`);
      logAiStep("info", "LLM Prompt Formatted", `Formatted Query Sent to Local LLM:\n\n${query}`);
      await llm.sendMessage(query);
    } catch (err: any) {
      console.error("LOG: Local LLM error on submit:", err);
      logAiStep("error", "LLM Submission Error", err?.message || String(err));
      setIsWaitingForAi(false);
      Alert.alert("AI Error", err.message || "Failed to process prompt using local LLM.");
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
      const finalCleanData = filterDataForType(type, data);

      // 1. Insert Matter into user database
      await db.run(
        "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalId,
          code.trim() || null,
          type.trim(),
          scope.trim(),
          owner.trim() || null,
          finalTitle,
          isPublic ? 1 : 0,
          JSON.stringify(finalCleanData),
          finalTime
        ]
      );

      // Sync with Vector Embeddings for Search
      try {
        await upsertMatterVector(finalId, {
          title: finalTitle,
          type: type.trim(),
          scope: scope.trim(),
          code: code.trim() || null,
          data: JSON.stringify(data)
        });
      } catch (vectorErr) {
        console.error("Failed to index matter vector:", vectorErr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      console.error("Failed to insert matter:", err);
      Alert.alert("Error", err.message || "Failed to save the matter.");
    }
  };

  // Helper formatting routines
  const getTypeIcon = (t: string) => {
    switch (t) {
      case "task": return "checkbox-outline";
      case "product": return "cube-outline";
      case "profile": return "person-outline";
      case "form": return "document-outline";
      default: return "document-text-outline";
    }
  };

  const capitalize = (str: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatChipDate = (timeStr: string) => {
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return "Mon, Jun 01";
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
    } catch (_) {
      return "Mon, Jun 01";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, marginTop: 10 }}
      >
        {/* Main Editor Text Inputs & Visual Data Canvas */}
        <ScrollView 
          style={styles.editorArea} 
          contentContainerStyle={styles.editorScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderInteractiveSentence()}

        </ScrollView>

        {/* AI Input Field above the bottom bar */}
        <View style={styles.aiInputContainer}>
          <View style={styles.aiInputRow}>
            <TextInput
              style={styles.aiTextInput}
              placeholder={
                !isReady
                  ? "Loading Offline AI..."
                  : "Ask AI to fill fields (e.g. 'price 150')..."
              }
              placeholderTextColor="#a1a1aa"
              value={aiPrompt}
              onChangeText={setAiPrompt}
              editable={isReady && !llm.isGenerating}
            />
            {llm.isGenerating ? (
              <ActivityIndicator size="small" color="#d946ef" />
            ) : (
              <TouchableOpacity 
                onPress={handleAiProcess} 
                disabled={!isReady || !aiPrompt.trim()}
                style={[
                  styles.aiProcessBtn, 
                  (!isReady || !aiPrompt.trim()) && styles.aiProcessBtnDisabled
                ]}
              >
                <Ionicons name="arrow-up" size={14} color={(!isReady || !aiPrompt.trim()) ? "#a1a1aa" : "white"} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sticky Bottom Chips Bar */}
        <View style={styles.bottomStickyBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollContainer}
          >
            {/* Chip 1: Scope */}
            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                const scopes = ["p", "g", "d"];
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

            {/* Chip 2: SKU / Code */}
            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                if (Platform.OS === "ios" || Platform.OS === "android") {
                  Alert.prompt(
                    "Edit SKU Code",
                    "Enter SKU / matter code:",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "OK", onPress: (val?: string) => setCode(val || "") }
                    ],
                    "plain-text",
                    code
                  );
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

            {/* Chip 3: Visibility */}
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

            {/* Chip 4: Options */}
            {type === "product" && (
              <TouchableOpacity 
                style={styles.chip} 
                onPress={() => setShowOptionsModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>Options</Text>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />
            {/* Send / Create Chip Button */}
            <TouchableOpacity 
              style={[styles.chip, { backgroundColor: "#ec4899", borderColor: "#ec4899" }]} 
              onPress={handleSave} 
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, { color: "white" }]}>Publish</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Options Full Screen Modal */}
      <Modal
        visible={showOptionsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
          {/* Header */}
          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            alignItems: "center", 
            paddingHorizontal: 20, 
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#e4e4e7"
          }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#18181b" }}>Product Options</Text>
            <TouchableOpacity 
              onPress={() => setShowOptionsModal(false)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: "#18181b"
              }}
            >
              <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* AI Quick Add Option Input */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f4f4f5", backgroundColor: "#fafafa" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  height: 40,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e4e4e7",
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  fontSize: 14,
                  color: "#18181b"
                }}
                placeholder="Quick add (e.g. 'navy', 'linen', 'L')..."
                placeholderTextColor="#a1a1aa"
                value={quickAddText}
                onChangeText={setQuickAddText}
                onSubmitEditing={handleQuickAddSubmit}
              />
              <TouchableOpacity 
                onPress={handleQuickAddSubmit}
                style={{
                  height: 40,
                  paddingHorizontal: 16,
                  backgroundColor: "#18181b",
                  borderRadius: 20,
                  justifyContent: "center",
                  alignItems: "center"
                }}
              >
                {isWaitingForClassification ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: "#a1a1aa", marginTop: 6, marginLeft: 8 }}>
              AI classifies your entry (e.g. 'crimson' → Color, 'XL' → Size).
            </Text>
          </View>

          {/* List of global options */}
          <ScrollView 
            style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {GLOBAL_OPTIONS_PRESETS.map((optionGroup) => {
              const key = optionGroup.key;
              const currentVals = data.options?.[key] || [];
              
              // Also include any custom values added by user
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
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isSelected ? "#18181b" : "#e4e4e7",
                            backgroundColor: isSelected ? "#18181b" : "#ffffff"
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ 
                            fontSize: 13, 
                            fontWeight: isSelected ? "700" : "500", 
                            color: isSelected ? "#ffffff" : "#52525b" 
                          }}>
                            {val}
                          </Text>
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
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  editorArea: {
    flex: 1,
  },
  editorScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  titleInput: {
    fontSize: 30,
    fontWeight: "700",
    color: "#18181b",
    lineHeight: 38,
    padding: 0,
    marginBottom: 8,
  },
  bottomStickyBar: {
    backgroundColor: "white",
    borderTopWidth: 0.5,
    borderTopColor: "#e4e4e7",
  },
  chipsScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 6,
    flexGrow: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3f3f46",
  },
  drawerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  drawerDismiss: {
    flex: 1,
  },
  drawerContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
  },
  drawerDoneText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563eb",
  },
  drawerBody: {
    marginBottom: 10,
  },
  drawerInput: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#18181b",
    backgroundColor: "#fafafa",
  },
  editorPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  presetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f4f4f5",
  },
  presetBadgeActive: {
    backgroundColor: "#e0e7ff",
  },
  presetBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  presetBadgeTextActive: {
    color: "#4f46e5",
  },
  actionBtn: {
    backgroundColor: "#eff6ff",
    borderWidth: 0.5,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f5",
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#27272a",
  },
  aiInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
    borderTopWidth: 0.5,
    borderTopColor: "#e4e4e7",
  },
  aiInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  aiTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#18181b",
    padding: 0,
  },
  aiProcessBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d946ef",
    justifyContent: "center",
    alignItems: "center",
  },
  aiProcessBtnDisabled: {
    backgroundColor: "#f4f4f5",
  },
  dataCanvasContainer: {
    marginTop: 20,
  },
  canvasSectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  canvasNotesInput: {
    fontSize: 18,
    color: "#52525b",
    lineHeight: 26,
    padding: 0,
    minHeight: 200,
  },
  canvasForm: {
    gap: 12,
  },
  canvasFormRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f5",
    paddingVertical: 8,
  },
  canvasFormLabel: {
    width: 100,
    fontSize: 14,
    fontWeight: "600",
    color: "#71717a",
  },
  canvasFormInput: {
    flex: 1,
    fontSize: 15,
    color: "#18181b",
    padding: 0,
    fontWeight: "500",
  },
  canvasPresets: {
    flexDirection: "row",
    gap: 6,
  },
  canvasPresetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f4f4f5",
  },
  canvasPresetBadgeActive: {
    backgroundColor: "#e0e7ff",
  },
  canvasPresetBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
  },
  canvasPresetBadgeTextActive: {
    color: "#4f46e5",
  },
  canvasFormHelp: {
    fontSize: 13,
    color: "#a1a1aa",
    fontStyle: "italic",
    marginBottom: 8,
  },
  rawJsonText: {
    fontFamily: Platform.OS === "ios" ? "CourierNewPSMT" : "monospace",
    fontSize: 12,
    color: "#71717a",
    backgroundColor: "#fafafa",
    padding: 10,
    borderRadius: 6,
  },
  customFieldsSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 16,
  },
  customFieldsHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  customFormRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f5",
    paddingVertical: 8,
    gap: 8,
  },
  customFieldLabelCol: {
    width: 100,
  },
  customFormInput: {
    flex: 1,
    fontSize: 15,
    color: "#18181b",
    padding: 0,
    fontWeight: "500",
  },
  deleteCustomFieldBtn: {
    padding: 6,
  },
  addCustomFieldInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  customFieldKeyInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    backgroundColor: "#fafafa",
    color: "#18181b",
  },
  customFieldValueInput: {
    flex: 1.5,
    height: 36,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    backgroundColor: "#fafafa",
    color: "#18181b",
  },
  addCustomFieldBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  storefrontPreviewCard: {
    marginBottom: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
  },
  previewCardTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#a1a1aa",
    letterSpacing: 1,
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: "#fbfbfb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    padding: 16,
  },
  productCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  productCardCategory: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3b82f6",
    letterSpacing: 0.5,
  },
  productCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181b",
    marginBottom: 8,
  },
  productCardPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: "#10b981",
    marginBottom: 12,
  },
  productCardSupplier: {
    fontSize: 11,
    color: "#71717a",
    marginTop: 12,
    fontStyle: "italic",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  stockDotIn: {
    backgroundColor: "#10b981",
  },
  stockDotOut: {
    backgroundColor: "#ef4444",
  },
  stockText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#52525b",
  },
  productCardFeatureRow: {
    marginTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#e4e4e7",
    paddingTop: 10,
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 6,
  },
  customPreviewDetails: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 12,
  },
  customDetailsList: {
    marginTop: 6,
    gap: 6,
  },
  customDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customDetailKey: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  customDetailValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#27272a",
  },
  colorsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorBadgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 0.5,
    borderColor: "#e4e4e7",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  colorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3f3f46",
  },
  sizesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sizeBadgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 0.5,
    borderColor: "#e4e4e7",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  sizeCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f4f4f5",
    justifyContent: "center",
    alignItems: "center",
  },
  sizeShortCode: {
    fontSize: 9,
    fontWeight: "800",
    color: "#27272a",
  },
  sizeLabelText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3f3f46",
  },
  taskCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    padding: 16,
    gap: 8,
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: "#fee2e2",
  },
  priorityMedium: {
    backgroundColor: "#fef3c7",
  },
  priorityLow: {
    backgroundColor: "#f4f4f5",
  },
  priorityText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#3f3f46",
  },
  statusBadge: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#0369a1",
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  assigneeText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "500",
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    padding: 16,
    gap: 12,
  },
  profileAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  profileRoleText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  profileContactList: {
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    gap: 6,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactItemText: {
    fontSize: 12,
    color: "#4b5563",
  },
  noteCard: {
    backgroundColor: "#fef08a",
    borderRadius: 8,
    padding: 16,
    minHeight: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  noteCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#854d0e",
    marginBottom: 6,
  },
  noteCardBody: {
    fontSize: 13,
    color: "#713f12",
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    padding: 16,
    gap: 12,
  },
  formCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  formCardHelp: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  formFieldsList: {
    gap: 10,
  },
  formPreviewField: {
    gap: 4,
  },
  formPreviewFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  formPreviewInputPlaceholder: {
    height: 32,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
  },
  sentenceContainerDirect: {
    paddingVertical: 12,
    marginBottom: 20,
    zIndex: 1000,
  },
  sentenceTypeBadge: {
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#e4e4e7",
    flexDirection: "row",
    alignItems: "center",
  },
  typeDropdownMenu: {
    position: "absolute",
    top: 36,
    left: 0,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 130,
    zIndex: 9999,
    padding: 4,
  },
  typeDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  typeDropdownItemActive: {
    backgroundColor: "#f4f4f5",
  },
  typeDropdownItemText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
  },
  typeDropdownItemTextActive: {
    color: "#18181b",
  },
  sentenceTypeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#18181b",
  },
  sentenceParagraphRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 12,
    columnGap: 6,
  },
  sentenceDirectText: {
    fontSize: 17,
    color: "#18181b",
    fontWeight: "500",
  },
  sentencePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  sentencePillText: {
    fontSize: 16,
    fontWeight: "700",
  },
  sentenceCustomSection: {
    marginTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#e4e4e7",
    paddingTop: 12,
  },
  sentenceCustomList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  optionsSubCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 12,
    marginTop: 12,
  },
  optionsSubCardTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#71717a",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  optionPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  optionPreviewKey: {
    fontSize: 13,
    fontWeight: "700",
    color: "#27272a",
    width: 75,
  },
  optionPreviewValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    flex: 1,
  },
  optionNoValues: {
    fontSize: 12,
    color: "#a1a1aa",
    fontStyle: "italic",
  },
  optionPreviewValueChip: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  optionPreviewValueChipText: {
    fontSize: 11,
    color: "#3f3f46",
    fontWeight: "600",
  },
  optionsDrawer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 16,
    zIndex: 10000,
  },
  optionsDrawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  optionsDrawerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
  },
  optionsKeySection: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionKeysList: {
    flexDirection: "row",
    gap: 8,
  },
  keySelectButton: {
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  keySelectButtonActive: {
    backgroundColor: "#e0e7ff",
    borderColor: "#a5b4fc",
  },
  keySelectButtonSelected: {
    borderWidth: 1.5,
    borderColor: "#4f46e5",
  },
  keySelectButtonText: {
    fontSize: 13,
    color: "#71717a",
    fontWeight: "500",
  },
  keySelectButtonTextActive: {
    color: "#4f46e5",
    fontWeight: "700",
  },
  keySelectButtonTextSelected: {
    color: "#4338ca",
  },
  optionsValuesSection: {
    marginTop: 4,
  },
  valuesPresetsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  valuePresetChip: {
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  valuePresetChipActive: {
    backgroundColor: "#f5e6ff",
    borderColor: "#d8b4fe",
  },
  valuePresetChipText: {
    fontSize: 13,
    color: "#52525b",
    fontWeight: "500",
  },
  valuePresetChipTextActive: {
    color: "#9333ea",
    fontWeight: "700",
  },
  customValueInputRow: {
    marginTop: 4,
  },
  customValueInput: {
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#18181b",
  },
  noKeySelected: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  noKeySelectedText: {
    fontSize: 13,
    color: "#a1a1aa",
    fontStyle: "italic",
  },
  unifiedInteractiveCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 20,
    marginBottom: 20,
  },
  imageThumbnailContainer: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  imageThumbnail: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  imagePlaceholderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    marginTop: 4,
  },
  imageThumbnailContainerSquare: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  imageThumbnailSquare: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholderSquare: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f5",
    paddingBottom: 12,
    marginBottom: 16,
  },
  cardSentenceBody: {
    marginBottom: 12,
  },
  priceCalloutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  priceCalloutLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },
  priceCalloutValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#059669",
  },
  avatarCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f4f4f5",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialSmall: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3f3f46",
  },
  badgeBase: {
    borderRadius: 6,
    overflow: "hidden",
  },
  storefrontPriceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  storefrontPricePrefix: {
    fontSize: 24,
    fontWeight: "800",
    color: "#10b981",
    marginRight: 2,
  },
  storefrontDetailsSection: {
    gap: 8,
    marginTop: 6,
  },
  storefrontDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storefrontDetailsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
    width: 70,
  },
  notionImagePickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  notionImageThumbnailSmall: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#d4d4d8",
  },
  notionImagePickerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3f3f46",
  },
  notionImagePickerPlaceholderText: {
    fontSize: 13,
    color: "#a1a1aa",
    fontWeight: "500",
  },
  optionSectionCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 12,
    marginBottom: 12,
  },
  optionSectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  optionSectionCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
  },
  optionRemoveText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  }
});
