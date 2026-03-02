import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dbHelpers } from "../lib/db";

/**
 * ADD INSTANCE SCREEN
 * Simplified form to create instances tied to states.
 */

export default function AddInstanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // If we came from a specific state (e.g. Product), use that stateid
  const initialStateId =
    typeof params.stateid === "string" ? params.stateid : "";
  const initialStateTitle =
    typeof params.stateTitle === "string" ? params.stateTitle : "";

  const [stateid, setStateId] = useState(initialStateId);
  const [stateTitle, setStateTitle] = useState(initialStateTitle);
  const [qty, setQty] = useState("1");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [available, setAvailable] = useState(true);
  const [scope, setScope] = useState("");
  const [metadata, setMetadata] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [states, setStates] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStates();
  }, []);

  const fetchStates = async () => {
    try {
      const data = await dbHelpers.getStates();
      setStates(data);
    } catch (e) {
      console.error("Failed to fetch states:", e);
    }
  };

  const handleSave = async () => {
    if (!stateid) {
      Alert.alert("Error", "Please select a State (Product/Collection)");
      return;
    }

    setIsSaving(true);
    try {
      await dbHelpers.insertInstance({
        id: Math.random().toString(36).substring(7),
        stateid,
        qty: parseFloat(qty) || 0,
        value: parseFloat(value) || 0,
        currency,
        available: available ? 1 : 0,
        scope: scope.trim() || undefined,
        metadata: metadata.trim() || undefined,
      });
      router.back();
    } catch (error) {
      console.error("Failed to save instance:", error);
      Alert.alert("Error", "Failed to save instance.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderFormField = (
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    keyboardType: any = "default",
  ) => (
    <View style={s.fieldRowInline}>
      <View style={s.fieldLabelContainer}>
        <Text style={s.fieldLabelText}>{label}</Text>
      </View>
      <TextInput
        style={s.fieldInputInline}
        placeholder={placeholder}
        placeholderTextColor="#CBD5E1"
        value={value}
        onChangeText={setter}
        keyboardType={keyboardType}
      />
    </View>
  );

  const filteredStates = states.filter((s) => {
    const text = (s.title || s.ucode || "").toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.container}
    >
      <View style={{ backgroundColor: "#FFFFFF", paddingTop: insets.top }}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>New Instance</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#007AFF" size="small" />
            ) : (
              <Text style={[s.saveText, isSaving && { opacity: 0.5 }]}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Connection */}
        <Text style={s.sectionTitle}>CONNECTION</Text>
        <View style={s.card}>
          <View style={s.fieldRowInline}>
            <View style={s.fieldLabelContainer}>
              <Text style={s.fieldLabelText}>State</Text>
            </View>
            <TouchableOpacity
              style={s.pickerButtonInline}
              onPress={() => setShowPicker(!showPicker)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.pickerButtonText,
                  !stateTitle && { color: "#94A3B8" },
                ]}
                numberOfLines={1}
              >
                {stateTitle || "Select..."}
              </Text>
              <MaterialCommunityIcons
                name={showPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          <Modal
            visible={showPicker}
            animationType="slide"
            onRequestClose={() => setShowPicker(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "#FFFFFF",
                paddingTop: insets.top,
              }}
            >
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.headerTitle}>Select State</Text>
                <View style={{ width: 50 }} />
              </View>
              <View style={s.searchContainer}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
                  color="#94A3B8"
                />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search states..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={16}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={filteredStates}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.modalItem}
                    onPress={() => {
                      setStateId(item.id);
                      setStateTitle(item.title || item.ucode);
                      setShowPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickerItemText}>
                        {item.title || item.ucode}
                      </Text>
                      <Text style={s.pickerItemSub}>{item.type}</Text>
                    </View>
                    {stateid === item.id && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color="#007AFF"
                      />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={{ color: "#94A3B8" }}>No states found.</Text>
                  </View>
                }
              />
            </View>
          </Modal>
        </View>

        {/* Section 2: Properties */}
        <Text style={s.sectionTitle}>PROPERTIES</Text>
        <View style={s.card}>
          {renderFormField("Quantity", qty, setQty, "1", "numeric")}
          <View style={s.separator} />

          <View style={s.fieldRowInline}>
            <View style={s.fieldLabelContainer}>
              <Text style={s.fieldLabelText}>Status</Text>
            </View>
            <View style={s.switchWrapperInline}>
              <TouchableOpacity
                onPress={() => setAvailable(!available)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    s.switchLabelInline,
                    { color: available ? "#059669" : "#DC2626" },
                  ]}
                >
                  {available ? "Available" : "Unavailable"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.separator} />

          {renderFormField("Value", value, setValue, "0.00", "numeric")}
          <View style={s.separator} />
          {renderFormField("Currency", currency, setCurrency, "USD")}
        </View>

        {/* Section 3: Context */}
        <Text style={s.sectionTitle}>CONTEXT</Text>
        <View style={s.card}>
          {renderFormField("Scope", scope, setScope, "Location or batch...")}
          <View style={s.separator} />
          {renderFormField(
            "Metadata",
            metadata,
            setMetadata,
            "Additional data...",
          )}
        </View>

        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Instances track physical occurrences or inventory of a State.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" }, // Subtle gray background for contrast with cards
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 44, // iOS standard
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    letterSpacing: -0.4,
  },
  cancelText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "400",
  },
  saveText: {
    color: "#007AFF", // iOS blue
    fontSize: 17,
    fontWeight: "600",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    marginBottom: 24,
    // Linear style subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },

  fieldRowInline: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },

  fieldLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 110,
    gap: 10,
  },

  fieldLabelText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },

  fieldInputInline: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    textAlign: "right",
    paddingVertical: 0, // Tight fit
  },

  separator: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 16,
  },

  pickerButtonInline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },

  pickerButtonText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    maxWidth: 160,
  },

  switchWrapperInline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },

  switchLabelInline: {
    fontSize: 12,
    fontWeight: "600",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#111827",
  },
  modalItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F1F5F9",
  },
  pickerItemText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  pickerItemSub: {
    fontSize: 11,
    color: "#94A3B8",
    textTransform: "uppercase",
    marginTop: 2,
    fontWeight: "700",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    opacity: 0.7,
  },

  infoText: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
  },
});
