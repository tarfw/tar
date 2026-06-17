import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

const TURSO_WORKER_URL = "https://turso-db.tar-54d.workers.dev";

// ── Category map ─────────────────────────────────────────────────────────────

interface Category {
  key: string;
  emoji: string;
  label: string;
  color: string;
  bg: string;
}

const CATEGORIES: Category[] = [
  { key: "product",    emoji: "🛒", label: "Shopping",  color: "#6366f1", bg: "#eef2ff" },
  { key: "restaurant", emoji: "🍔", label: "Food",       color: "#ea580c", bg: "#fff7ed" },
  { key: "transport",  emoji: "🚕", label: "Transport",  color: "#0891b2", bg: "#ecfeff" },
  { key: "event",      emoji: "🎫", label: "Tickets",    color: "#7c3aed", bg: "#f5f3ff" },
  { key: "hotel",      emoji: "🏨", label: "Hotels",     color: "#0d9488", bg: "#f0fdfa" },
  { key: "service",    emoji: "🏠", label: "Services",   color: "#d97706", bg: "#fffbeb" },
];

function categoryMeta(type: string): Category {
  return CATEGORIES.find((c) => c.key === type) ?? CATEGORIES[0];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResultItem {
  id: string;
  title: string;
  type: string;
  data: string | null;
  score?: number;
}

interface MassRow {
  id: string;
  matter: string;
  type: string;
  qty: number | null;
  value: number | null;
  active: number;
  start: string | null;
  end: string | null;
  data: string | null;
}

function parseData(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function useDebounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SuperAgentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery]                         = useState("");
  const [activeCategory, setActiveCategory]       = useState<Category | null>(null);
  const [results, setResults]                     = useState<ResultItem[]>([]);
  const [matterMap, setMassMap]                     = useState<Record<string, MassRow[]>>({});
  const [loading, setLoading]                     = useState(false);
  const [searched, setSearched]                   = useState(false);
  const [selectedItem, setSelectedItem]           = useState<ResultItem | null>(null);
  const [selectedMatter, setSelectedMass]           = useState<MassRow | null>(null);

  // ── Search ──────────────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string, cat: Category | null) => {
    const trimmed = q.trim();
    if (!trimmed && !cat) { setResults([]); setSearched(false); return; }

    setLoading(true);
    setSearched(true);
    const payload = { query: trimmed, category: cat?.key ?? "", limit: 20 };
    console.log("[SuperAgent] →", JSON.stringify(payload));

    try {
      const res  = await fetch(`${TURSO_WORKER_URL}/api/global/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log("[SuperAgent] ←", res.status, text.slice(0, 300));
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);

      const data = JSON.parse(text) as { forms: any[]; matters: any[]; vectorUsed?: boolean };
      console.log(`[SuperAgent] ${data.forms?.length ?? 0} forms, ${data.matters?.length ?? 0} matter rows, vector=${data.vectorUsed}`);

      // Index matter rows by form id
      const newMap: Record<string, MassRow[]> = {};
      for (const m of (data.matters || [])) {
        const key = m.matter;
        if (!newMap[key]) newMap[key] = [];
        newMap[key].push(m as MassRow);
      }
      setMassMap(newMap);

      setResults((data.matters || []).map((m: any) => ({
        id: m.id, title: m.title, type: m.type, data: m.data, score: m.score,
      })));
    } catch (e: any) {
      console.warn("[SuperAgent] error:", e?.message || e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce(doSearch, 400);

  const onQueryChange = (text: string) => { setQuery(text); debouncedSearch(text, activeCategory); };

  const onCategoryPress = (cat: Category) => {
    const next = activeCategory?.key === cat.key ? null : cat;
    setActiveCategory(next);
    doSearch(query, next);
  };

  const onClear = () => { setQuery(""); setResults([]); setSearched(false); };

  const openDetail = (item: ResultItem) => {
    setSelectedItem(item);
    setSelectedMass(null);
  };

  const closeDetail = () => { setSelectedItem(null); setSelectedMass(null); };

  const handleBook = () => {
    if (!selectedItem || !selectedMatter) return;
    const matterD = parseData(selectedMatter.data);
    Alert.alert(
      "Booking Confirmed 🎉",
      `${selectedItem.title}\n${matterD.label ?? ""}\n₹${Number(selectedMatter.value ?? 0).toLocaleString()}`,
      [{ text: "OK", onPress: closeDetail }]
    );
    // TODO: write motion record to user's collab DB
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderResult = ({ item, index }: { item: ResultItem; index: number }) => {
    const meta  = categoryMeta(item.type);
    const d     = parseData(item.data);
    const price = d.price ?? d.base_price ?? null;
    const sub   = d.subtitle ?? d.description ?? d.address ?? d.cuisine ?? "";
    const matterRows = matterMap[item.id] ?? [];

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(260)}>
        <TouchableOpacity style={styles.resultRow} activeOpacity={0.7} onPress={() => openDetail(item)}>
          <View style={[styles.resultDot, { backgroundColor: meta.bg }]}>
            <Text style={styles.resultEmoji}>{meta.emoji}</Text>
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.resultSub} numberOfLines={1}>
              {sub || meta.label}
              {matterRows.length > 0 ? `  ·  ${matterRows.length} option${matterRows.length > 1 ? "s" : ""}` : ""}
            </Text>
          </View>
          {price !== null && (
            <Text style={[styles.resultPrice, { color: meta.color }]}>₹{Number(price).toLocaleString()}</Text>
          )}
          <Ionicons name="chevron-forward" size={14} color="#cbd5e1" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <View style={styles.resultDivider} />
      </Animated.View>
    );
  };

  const renderSkeleton = () => (
    <View>
      {[0,1,2,3,4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonDot} />
          <View style={{ flex: 1 }}>
            <View style={[styles.skeletonLine, { width: "65%" }]} />
            <View style={[styles.skeletonLine, { width: "40%", marginTop: 6, opacity: 0.5 }]} />
          </View>
        </View>
      ))}
    </View>
  );

  // ── Detail sheet content ──────────────────────────────────────────────────

  const renderDetailSheet = () => {
    if (!selectedItem) return null;
    const meta      = categoryMeta(selectedItem.type);
    const d         = parseData(selectedItem.data);
    const matterRows  = matterMap[selectedItem.id] ?? [];
    const desc      = d.subtitle ?? d.description ?? d.address ?? d.cuisine ?? "";

    // Label for the "select" section header by category
    const sectionLabel: Record<string, string> = {
      product:    "Choose Variant",
      restaurant: "Choose Item",
      transport:  "Available Now",
      event:      "Select Class",
      hotel:      "Room Types",
      service:    "Available Slots",
    };

    return (
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.sheetKnob} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={[styles.sheetDot, { backgroundColor: meta.bg }]}>
            <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{selectedItem.title}</Text>
            <Text style={[styles.sheetType, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={26} color="#e2e8f0" />
          </TouchableOpacity>
        </View>

        {desc ? <Text style={styles.sheetDesc}>{desc}</Text> : null}

        {/* Mass selection */}
        {matterRows.length > 0 && (
          <>
            <Text style={styles.matterLabel}>{sectionLabel[selectedItem.type] ?? "Options"}</Text>
            <ScrollView
              style={styles.matterScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {matterRows.map((m) => {
                const md       = parseData(m.data);
                const label    = md.label ?? m.type;
                const isActive = selectedMatter?.id === m.id;
                const outOfStock = (m.qty !== null && m.qty <= 0) || m.active === 0;

                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.matterRow,
                      isActive && { borderColor: meta.color, backgroundColor: meta.bg },
                      outOfStock && styles.matterRowDisabled,
                    ]}
                    activeOpacity={outOfStock ? 1 : 0.7}
                    disabled={outOfStock}
                    onPress={() => setSelectedMass(isActive ? null : m)}
                  >
                    {/* Selection indicator */}
                    <View style={[styles.matterCheck, isActive && { backgroundColor: meta.color, borderColor: meta.color }]}>
                      {isActive && <Ionicons name="checkmark" size={12} color="white" />}
                    </View>

                    {/* Label + sub info */}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.matterRowLabel, outOfStock && { color: "#cbd5e1" }]}>{label}</Text>
                      {md.eta_mins != null && (
                        <Text style={styles.matterRowSub}>ETA {md.eta_mins} min</Text>
                      )}
                      {md.rating != null && (
                        <Text style={styles.matterRowSub}>⭐ {md.rating}</Text>
                      )}
                      {md.class != null && (
                        <Text style={styles.matterRowSub}>Class: {md.class}</Text>
                      )}
                      {outOfStock && <Text style={[styles.matterRowSub, { color: "#f87171" }]}>Unavailable</Text>}
                    </View>

                    {/* Qty badge */}
                    {m.qty !== null && !outOfStock && (
                      <Text style={styles.matterQty}>{m.qty} left</Text>
                    )}

                    {/* Price */}
                    {m.value !== null && (
                      <Text style={[styles.matterPrice, isActive && { color: meta.color }]}>
                        {m.value === 0 ? "Free" : `₹${Number(m.value).toLocaleString()}`}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.bookBtn,
            { backgroundColor: selectedMatter ? meta.color : "#e2e8f0" },
          ]}
          activeOpacity={selectedMatter ? 0.8 : 1}
          disabled={!selectedMatter}
          onPress={handleBook}
        >
          <Text style={[styles.bookBtnText, !selectedMatter && { color: "#94a3b8" }]}>
            {selectedMatter
              ? `Book · ₹${Number(selectedMatter.value ?? 0).toLocaleString()}`
              : matterRows.length > 0
                ? "Select an option above"
                : "Coming Soon"}
          </Text>
          {selectedMatter && <Ionicons name="arrow-forward" size={16} color="white" style={{ marginLeft: 6 }} />}
        </TouchableOpacity>
      </View>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Super Agent</Text>
        </View>
        <View style={styles.planetBadge}>
          <Ionicons name="globe" size={18} color="#4f46e5" />
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#5f6368" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search anything..."
            placeholderTextColor="#747775"
            value={query}
            onChangeText={onQueryChange}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query, activeCategory)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="#5f6368" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category chips (Horizontal scrollable, flat & modern) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        {CATEGORIES.map((cat, i) => {
          const active = activeCategory?.key === cat.key;
          return (
            <Animated.View key={cat.key} entering={ZoomIn.delay(i * 50).duration(260)}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  active ? { backgroundColor: cat.color } : { backgroundColor: "#f4f4f5" }
                ]}
                onPress={() => onCategoryPress(cat)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                <Text style={[styles.chipLabel, active ? { color: "white" } : { color: "#52525b" }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Results */}
      {loading ? renderSkeleton()
        : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : searched ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No results for &quot;{query}&quot;</Text>
            <Text style={styles.emptySub}>Try a different term or category</Text>
          </View>
        ) : (
          <View style={styles.idleState}>
            <Ionicons name="globe" size={44} color="#4f46e5" style={{ opacity: 0.2, marginBottom: 12 }} />
            <Text style={styles.idleText}>Search for anything</Text>
          </View>
        )}

      {/* Detail modal */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeDetail} />
        {renderDetailSheet()}
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    backgroundColor: "white",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  planetBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f0f4ff", justifyContent: "center", alignItems: "center",
  },

  searchContainer: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "white" },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f3f4f6", borderRadius: 28,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#1f1f1f", fontWeight: "400" },

  chipScroll: {
    flexGrow: 0,
    backgroundColor: "white",
    paddingBottom: 12,
  },
  chipScrollContent: {
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    gap: 4,
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 12, fontWeight: "600", color: "#64748b" },

  resultRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  resultDot: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 14 },
  resultEmoji: { fontSize: 18 },
  resultText: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  resultSub: { fontSize: 12, color: "#94a3b8", fontWeight: "500", marginTop: 2 },
  resultPrice: { fontSize: 14, fontWeight: "700", marginLeft: 8 },
  resultDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#f1f5f9", marginLeft: 70 },

  skeletonRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  skeletonDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f5f9", marginRight: 14 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: "#f1f5f9" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#475569" },
  emptySub: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  idleState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  idleText: { fontSize: 15, color: "#cbd5e1", fontWeight: "500", marginTop: 12 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },

  // Detail sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 14,
    maxHeight: "85%",
  },
  sheetKnob: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 18,
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 10 },
  sheetDot: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3, flex: 1 },
  sheetType: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  sheetDesc: { fontSize: 13, color: "#64748b", lineHeight: 19, marginBottom: 14 },

  // Mass rows
  matterLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" },
  matterScroll: { maxHeight: 260, marginBottom: 14 },
  matterRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: "#f1f5f9",
    backgroundColor: "#fafafa", marginBottom: 8, gap: 12,
  },
  matterRowDisabled: { opacity: 0.45 },
  matterCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#e2e8f0",
    justifyContent: "center", alignItems: "center",
  },
  matterRowLabel: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  matterRowSub: { fontSize: 11, color: "#94a3b8", fontWeight: "500", marginTop: 2 },
  matterQty: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  matterPrice: { fontSize: 15, fontWeight: "800", color: "#1e293b", marginLeft: 4 },

  // Book CTA
  bookBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 15, borderRadius: 20, marginTop: 4,
  },
  bookBtnText: { fontSize: 15, fontWeight: "700", color: "white" },
});
