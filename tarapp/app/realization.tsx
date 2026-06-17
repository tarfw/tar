import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient } from "../lib/db";

// ─── ID generator ────────────────────────────────────────────────────────────
const genId = () => `mas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// ─── Vocabulary (from architecture/usecases.md + schema.md) ──────────────────
//
// TYPE  — what kind of physical realization this mass record captures:
//   • stock       → inventory quantity at a location / channel
//   • price       → monetary value tied to a channel / window
//   • slot        → time-block availability (appointment, shift, class)
//   • coupon      → usage-limited discount / promo
//   • quota       → capacity ceiling (seats, licences, downloads)
//   • loyalty     → points / credits balance for a customer entity
//   • listing     → marketplace or storefront visibility entry
//   • variant     → size / color / SKU-level differentiation of a matter
//   • reservation → confirmed hold on a resource (table, room, cab)
//   • bundle      → aggregated offer linking child matter items
//   • payout      → seller / staff settlement amount
//   • deposit     → upfront hold on value (security, pre-auth)
//
// SCOPE — the channel, location, or segment this mass applies to:
//   • retail      → physical shop floor
//   • online      → e-commerce / web store
//   • wholesale   → B2B bulk pricing
//   • delivery    → delivery channel (Swiggy, Zomato, own-fleet)
//   • pickup      → click-and-collect / takeaway
//   • warehouse   → back-store or hub stock
//   • shift_am    → morning shift window
//   • shift_pm    → afternoon / evening shift window
//   • restaurant  → dine-in context
//   • salon       → appointment / service context
//   • global      → applies everywhere (default fallback)
//   • b2b         → enterprise / partner pricing

const TYPE_OPTIONS = [
  "stock", "price", "slot", "coupon", "quota",
  "loyalty", "listing", "variant", "variance", "reservation",
  "bundle", "payout", "deposit", "availability", "capacity",
];

const SCOPE_OPTIONS = [
  "retail", "online", "wholesale", "delivery", "pickup",
  "shift_morning", "shift_evening", "shift_am", "shift_pm",
  "adyar", "tnagar", "warehouse", "store", "salon", "restaurant",
  "global", "b2b",
];

// ─── Chip picker ─────────────────────────────────────────────────────────────
function ChipPicker({
  label,
  options,
  value,
  onSelect,
  accentColor = "#6366f1",
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  accentColor?: string;
}) {
  return (
    <View style={chipStyles.group}>
      <Text style={chipStyles.label}>{label}</Text>
      {/* Free-text field */}
      <TextInput
        style={chipStyles.input}
        value={value}
        onChangeText={onSelect}
        placeholder={`Custom ${label.toLowerCase()}…`}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
      />
      {/* Preset chips */}
      <View style={chipStyles.row}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(active ? "" : opt)}
              style={[
                chipStyles.chip,
                active && { backgroundColor: accentColor, borderColor: accentColor },
              ]}
            >
              <Text style={[chipStyles.chipText, active && { color: "#fff" }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  group: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f1f5f9",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
});

// ─── Quantity stepper ─────────────────────────────────────────────────────────
function QtyStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const step = (dir: 1 | -1) => {
    const n = parseFloat(value) || 0;
    const next = Math.max(0, n + dir);
    onChange(String(next % 1 === 0 ? Math.round(next) : next));
  };
  return (
    <View style={stepperStyles.container}>
      <TouchableOpacity onPress={() => step(-1)} style={stepperStyles.btn}>
        <Ionicons name="remove-outline" size={20} color="#1e293b" />
      </TouchableOpacity>
      <TextInput
        style={stepperStyles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        textAlign="center"
        placeholder="0"
        placeholderTextColor="#94a3b8"
      />
      <TouchableOpacity onPress={() => step(1)} style={stepperStyles.btn}>
        <Ionicons name="add-outline" size={20} color="#1e293b" />
      </TouchableOpacity>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    height: 50,
    overflow: "hidden",
    marginTop: 4,
  },
  btn: {
    width: 50,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    padding: 0,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RealizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Accept optional matter ID passed as route param (e.g. from a matter detail screen)
  const { matterId: prefilledMatter } = useLocalSearchParams<{ matterId?: string }>();

  const [id] = useState(genId);
  const [matter, setMatter] = useState(prefilledMatter ?? "");
  const [type, setType] = useState("");
  const [scope, setScope] = useState("");
  const [qty, setQty] = useState("");
  const [value, setValue] = useState("");
  const [geo, setGeo] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!matter.trim()) {
      Alert.alert("Error", "Matter reference is required.");
      return;
    }
    if (!type && !scope) {
      Alert.alert("Validation", "At least one of Type or Scope is required.");
      return;
    }

    setSaving(true);
    try {
      const db = getDbClient();
      const time = new Date().toISOString();
      const parsedQty = qty.trim() !== "" ? parseFloat(qty) : null;
      const parsedValue = value.trim() !== "" ? parseFloat(value) : null;

      await db.run(
        `INSERT INTO matter (id, form, type, scope, qty, value, active, geo, start, end, data, time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          matter.trim(),
          type || null,
          scope || null,
          parsedQty,
          parsedValue,
          1,
          geo || null,
          start || null,
          end || null,
          data || null,
          time,
        ]
      );

      router.back();

      // No-op sync in local mode
    } catch (err: any) {
      console.error("Realization save failed:", err);
      Alert.alert("Save Error", err?.message || "Failed to save.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* ── Header (mirrors matter.tsx detailHeader style) ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="close-outline" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Realization</Text>
          {/* Simple text Save button — same visual language as matter.tsx */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Matter reference */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Matter ID</Text>
            <TextInput
              style={styles.fieldInput}
              value={matter}
              onChangeText={setMatter}
              placeholder="mat_… or enter ID"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldHint}>
              The matter this realization belongs to (product, service, customer, etc.)
            </Text>
          </View>

          {/* Type chip picker */}
          <ChipPicker
            label="Type"
            options={TYPE_OPTIONS}
            value={type}
            onSelect={setType}
            accentColor="#6366f1"
          />

          {/* Scope chip picker */}
          <ChipPicker
            label="Scope"
            options={SCOPE_OPTIONS}
            value={scope}
            onSelect={setScope}
            accentColor="#b45309"
          />

          {/* Quantity stepper */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <QtyStepper value={qty} onChange={setQty} />
            <Text style={styles.fieldHint}>
              Units of stock, seats, usage-count, or any countable resource
            </Text>
          </View>

          {/* Value */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Value</Text>
            <TextInput
              style={styles.fieldInput}
              value={value}
              onChangeText={setValue}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
            <Text style={styles.fieldHint}>
              Monetary value, points balance, or any scalar amount (₹, pts, %)
            </Text>
          </View>

          {/* Geo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Location (Geo)</Text>
            <TextInput
              style={styles.fieldInput}
              value={geo}
              onChangeText={setGeo}
              placeholder="Adyar, Chennai · H3 cell · lat,lng"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.fieldHint}>
              H3 index, city name, or address where this mass physically exists
            </Text>
          </View>

          {/* Start / End dates */}
          <View style={styles.rowGroup}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.fieldLabel}>Start</Text>
              <TextInput
                style={styles.fieldInput}
                value={start}
                onChangeText={setStart}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>End</Text>
              <TextInput
                style={styles.fieldInput}
                value={end}
                onChangeText={setEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
          <Text style={[styles.fieldHint, { marginTop: -12, marginBottom: 20 }]}>
            Time window: flash sale, shift, slot, or validity period
          </Text>

          {/* Extra JSON data */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Data (JSON)</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea]}
              value={data}
              onChangeText={setData}
              placeholder='{"sku":"ABC123","shelf":"A3"}'
              placeholderTextColor="#94a3b8"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
            <Text style={styles.fieldHint}>
              Any extra structured payload: SKU, shelf, route, metadata
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Header — same visual DNA as matter.tsx detailHeader
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    height: 52,
  },
  headerBack: { padding: 8, marginLeft: -4 },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  // ← identical to matter.tsx detailSaveBtn / detailSaveText
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#6366f1" },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },

  fieldGroup: { marginBottom: 20 },
  rowGroup: { flexDirection: "row", marginBottom: 20 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
  },
  fieldHint: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 5,
    lineHeight: 16,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
  },
});
