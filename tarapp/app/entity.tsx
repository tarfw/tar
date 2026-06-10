import React, { useState, useEffect, useCallback } from "react";
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
  Modal,
  Image
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { getSelfId, routeDbForEntity, isCollabSyncEnabled, cachedSelfId } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";
import { getCurrentUser, UserProfile } from "../lib/auth";

// Color constants matching workspace
const ACCENT = "#6366f1"; // Indigo
const DIVIDER = "#f1f5f9";
const TEXT_PRIMARY = "#1e293b";
const TEXT_SECONDARY = "#475569";
const TEXT_TERTIARY = "#94a3b8";

const ENTITY_GROUPS = [
  { type: "customer", category: "Customers", prefix: "c" },
  { type: "business", category: "Businesses", prefix: "b" },
  { type: "person", category: "Individuals / Teams", prefix: "p" },
  { type: "family", category: "Family / Contacts", prefix: "f" },
  { type: "warehouse", category: "Warehouses", prefix: "w" },
  { type: "carrier", category: "Carriers", prefix: "r" },
  { type: "vehicle", category: "Vehicles / Fleet", prefix: "v" },
  { type: "finance", category: "Finance & Budget", prefix: "fin" },
  { type: "product", category: "Products", prefix: "prod" },
  { type: "profile", category: "Storefront Profiles", prefix: "prof" }
];

interface CustomerRow {
  id: string;
  code: string;
  type: string;
  title: string;
  owner: string | null;
  data: string | null;
  time: string;
}

function parseData(jsonStr: string | null): any {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return {};
  }
}

function InitialAvatar({ name, size = 40, isSquare = false }: { name: string; size?: number; isSquare?: boolean }) {
  const cleanName = name.replace(/\(.*\)/, "").replace(/@\w+/, "").trim();
  const parts = cleanName.split(/\s+/);
  let initials = "";
  if (parts.length > 0 && parts[0] && parts[0][0]) {
    initials += parts[0][0];
  }
  if (parts.length > 1 && parts[1] && parts[1][0]) {
    initials += parts[1][0];
  }
  initials = initials.toUpperCase();

  const colors = [
    "#b6e3f4", // light blue
    "#c0aede", // lavender
    "#ffd5dc", // rose
    "#ffdf00", // pastel yellow
    "#c2f0c2", // pastel green
    "#ffe0b2", // peach
    "#d1d4f9", // indigo
    "#cbd5e1"  // slate
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: isSquare ? 8 : size / 2,
      backgroundColor: color,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12
    }}>
      <Text style={{
        fontSize: size * 0.38,
        fontWeight: "700",
        color: "#0f172a"
      }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

function EntityThumbnail({ 
  name, 
  photoUrl, 
  isProduct, 
  size = 40 
}: { 
  name: string; 
  photoUrl?: string | null; 
  isProduct?: boolean; 
  size?: number 
}) {
  const borderRadius = isProduct ? 8 : size / 2;

  if (photoUrl && photoUrl.trim().startsWith("http")) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: borderRadius,
          marginRight: 12,
          backgroundColor: "#f1f5f9"
        }}
        resizeMode="cover"
      />
    );
  }

  return <InitialAvatar name={name} size={size} isSquare={isProduct} />;
}

export default function EntityDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selfId, setSelfId] = useState<string | null>(cachedSelfId);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scope = selfId ? `c:${selfId}` : null;
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Entities state
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Entity Modal / Bottom Sheet State
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("customer");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  // Load list of entities from database
  const loadCustomers = useCallback(async (activeScope: string) => {
    try {
      const db = routeDbForEntity("customer", activeScope);
      const rows = await db.all(
        "SELECT id, code, type, title, owner, data, time FROM matter WHERE type IN ('customer', 'business', 'person', 'family', 'warehouse', 'carrier', 'vehicle', 'finance', 'product', 'profile') AND scope = ? ORDER BY time DESC",
        [activeScope]
      );
      setCustomers((rows as any[]) || []);
    } catch (e) {
      console.warn("[CRM] Failed to load entities:", e);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      // 1. If cachedSelfId is already present, load customers immediately!
      if (cachedSelfId) {
        try {
          await loadCustomers(`c:${cachedSelfId}`);
        } catch (e) {
          console.warn("Cached load failed:", e);
        } finally {
          if (active) setIsLoading(false);
        }
      }

      // 2. Load User Profile
      try {
        const user = await getCurrentUser();
        if (active) setUserProfile(user);
      } catch (e) {
        console.warn("Failed to load user profile in Entity Directory:", e);
      }

      // 3. Refresh/Verify in background
      try {
        const id = await getSelfId();
        if (active) {
          setSelfId(id);
          setSyncEnabled(await isCollabSyncEnabled());
          // Only re-load if the selfId changed from what was cached
          if (id !== cachedSelfId) {
            await loadCustomers(`c:${id}`);
          }
        }
      } catch (err) {
        console.warn("Boot failed:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, [loadCustomers]);

  // Open entity sheet
  const openCustomerSheet = (customer?: CustomerRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (customer) {
      setEditingCustomerId(customer.id);
      setEntityType(customer.type);
      setCustName(customer.title);
      const parsed = parseData(customer.data);
      setCustEmail(parsed.email || "");
      setCustPhone(parsed.phone || "");
    } else {
      setEditingCustomerId(null);
      setEntityType("customer");
      setCustName("");
      setCustEmail("");
      setCustPhone("");
    }
    setSheetOpen(true);
  };

  // Create or Update entity
  const saveCustomer = async () => {
    if (!custName.trim()) {
      Alert.alert("Required", "Please provide a name/title");
      return;
    }
    if (!scope) return;
    setBusy(true);
    try {
      const db = routeDbForEntity("customer", scope);
      const now = new Date().toISOString();
      const entityId = editingCustomerId || `${entityType.slice(0, 4)}_${Date.now()}`;
      const payload = {
        email: custEmail.trim(),
        phone: custPhone.trim()
      };
      const jsonStr = JSON.stringify(payload);

      await db.run(
        `INSERT INTO matter (id, code, type, scope, owner, title, public, data, time)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type=excluded.type,
           title=excluded.title,
           data=excluded.data,
           time=excluded.time`,
        [entityId, entityId, entityType, scope, selfId, custName.trim(), jsonStr, now]
      );

      // Upsert vector search
      try {
        await upsertMatterVector(entityId, {
          title: custName.trim(),
          type: entityType,
          scope: scope,
          code: entityId,
          data: jsonStr
        });
      } catch (ve) {
        console.warn("[VectorStore] Matter vector upsert skipped:", ve);
      }

      setSheetOpen(false);
      await loadCustomers(scope);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error("[CRM] Failed to save entity:", e);
      Alert.alert("Error", "Could not save entity details.");
    } finally {
      setBusy(false);
    }
  };

  // Filter entities based on search query
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const parsed = parseData(c.data);
    return (
      c.title.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (parsed.email && parsed.email.toLowerCase().includes(q)) ||
      (parsed.phone && parsed.phone.includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <>
            {/* Google Keep style search bar */}
            <View style={styles.searchBarContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={TEXT_TERTIARY} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search entities, type, email..."
                  placeholderTextColor={TEXT_TERTIARY}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color={TEXT_TERTIARY} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false}
        >
          {/* Virtual Group: Personal Workspace (Only shown if matching search or search is empty) */}
          {(!searchQuery || 
            "general / personal".includes(searchQuery.toLowerCase()) || 
            "private tasks & notes".includes(searchQuery.toLowerCase()) ||
            (userProfile?.name && userProfile.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (userProfile?.email && userProfile.email.toLowerCase().includes(searchQuery.toLowerCase()))) && (
            <View style={styles.scopeItemWrapper}>
              <View style={styles.scopeHeaderRow}>
                <View>
                  <Text style={styles.scopeCategoryName}>Personal Workspace</Text>
                  <Text style={styles.scopeDatabaseName}>user_private_{selfId || "guest"}.db</Text>
                </View>
                <View style={styles.scopePrefixBadge}>
                  <Text style={styles.scopePrefixText}>p</Text>
                </View>
              </View>
              <View style={styles.membersContainer}>
                <TouchableOpacity
                  style={styles.memberRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace({
                      pathname: "/workspace",
                      params: { entityId: "general_personal" }
                    });
                  }}
                  activeOpacity={0.6}
                >
                  <EntityThumbnail 
                    name={userProfile?.name || "General / Personal"} 
                    photoUrl={userProfile?.photo} 
                    isProduct={false} 
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{userProfile?.name || "General / Personal"}</Text>
                    <Text style={styles.memberRole}>
                      {userProfile?.email ? `${userProfile.email} · Private tasks & notes` : "Private tasks & notes"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Grouped / Listed Entities by Kind */}
          {ENTITY_GROUPS.map((group) => {
            const groupMembers = filteredCustomers.filter(c => c.type === group.type);
            if (groupMembers.length === 0) return null;

            return (
              <View key={group.type} style={styles.scopeItemWrapper}>
                <View style={styles.scopeHeaderRow}>
                  <View>
                    <Text style={styles.scopeCategoryName}>{group.category}</Text>
                    <Text style={styles.scopeDatabaseName}>
                      {group.type === "finance" || group.type === "product" || group.type === "profile" 
                        ? "global.db" 
                        : `user_sync_${selfId || "guest"}.db`}
                    </Text>
                  </View>
                  <View style={styles.scopePrefixBadge}>
                    <Text style={styles.scopePrefixText}>{group.prefix}</Text>
                  </View>
                </View>

                <View style={styles.membersContainer}>
                  {groupMembers.map((c, idx) => {
                    const d = parseData(c.data);
                    const subText = d.email || d.phone || c.code || c.id;
                    
                    return (
                      <View key={c.id}>
                        {idx > 0 && <View style={[styles.divider, { marginVertical: 4 }]} />}
                        <TouchableOpacity
                          style={styles.memberRow}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.replace({
                              pathname: "/workspace",
                              params: { entityId: c.id }
                            });
                          }}
                          onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            openCustomerSheet(c);
                          }}
                          delayLongPress={500}
                          activeOpacity={0.6}
                        >
                          <EntityThumbnail name={c.title} photoUrl={d.photo || d.image || d.avatar || d.thumbnail} isProduct={c.type === "product"} />
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>{c.title}</Text>
                            <Text style={styles.memberRole}>{subText}</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {filteredCustomers.length === 0 && searchQuery.length > 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={TEXT_TERTIARY} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No matching entities found</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => openCustomerSheet()}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.addBtnText}>Add contact / entity</Text>
          </TouchableOpacity>
        </ScrollView>
          </>
        )}

        {/* Add/Edit Entity Drawer/Modal */}
        <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSheetOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
              <View style={{ alignItems: "center" }}>
                <View style={styles.modalKnob} />
              </View>
              
              <Text style={styles.modalTitle}>{editingCustomerId ? "Edit contact / entity" : "Add contact / entity"}</Text>
              <Text style={styles.modalSchemaHint}>matter (type, title, data: JSON)</Text>

              <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>Entity Kind:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {[
                  { id: "customer", label: "Customer" },
                  { id: "business", label: "Business" },
                  { id: "person", label: "Team Member" },
                  { id: "family", label: "Family" },
                  { id: "warehouse", label: "Warehouse" },
                  { id: "carrier", label: "Carrier" },
                  { id: "vehicle", label: "Vehicle / Fleet" },
                  { id: "finance", label: "Finance / Budget" },
                  { id: "product", label: "Product" },
                  { id: "profile", label: "Storefront Profile" }
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.segment, entityType === opt.id && styles.segmentActive, { marginRight: 6, minWidth: 80 }]}
                    onPress={() => setEntityType(opt.id)}
                  >
                    <Text style={[styles.segmentText, entityType === opt.id && styles.segmentTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                style={styles.modalInput}
                value={custName}
                onChangeText={setCustName}
                placeholder="Name / Title"
                placeholderTextColor={TEXT_TERTIARY}
                autoFocus
              />
              <TextInput
                style={styles.modalInput}
                value={custEmail}
                onChangeText={setCustEmail}
                placeholder="Email address (Optional)"
                placeholderTextColor={TEXT_TERTIARY}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.modalInput}
                value={custPhone}
                onChangeText={setCustPhone}
                placeholder="Phone number (Optional)"
                placeholderTextColor={TEXT_TERTIARY}
                keyboardType="phone-pad"
              />

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={saveCustomer} disabled={busy} activeOpacity={0.8}>
                {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>{editingCustomerId ? "Update Details" : "Create Entity"}</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9"
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_PRIMARY
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: "white"
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    paddingVertical: 8
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40
  },
  scopeItemWrapper: {
    paddingBottom: 8,
  },
  scopeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginTop: 8,
  },
  scopeCategoryName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  scopeDatabaseName: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  scopePrefixBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  scopePrefixText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  membersContainer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  memberRole: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  divider: {
    height: 0.5,
    backgroundColor: "#f1f5f9"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY
  },
  addBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 20
  },
  addBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600"
  },
  // Modal styles matching workspace
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.32)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, borderWidth: 0 },
  modalKnob: { width: 32, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", marginTop: 8, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "600", color: "#1f1f1f", marginBottom: 4 },
  modalSchemaHint: { fontSize: 10, color: "#747775", marginBottom: 16, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  modalInput: { backgroundColor: "#f1f5f9", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: TEXT_PRIMARY, marginBottom: 12, borderWidth: 0 },
  segment: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: DIVIDER, alignItems: "center", backgroundColor: "white", minWidth: "30%", flexGrow: 1 },
  segmentActive: { backgroundColor: "#f3f6fd", borderColor: ACCENT },
  segmentText: { fontSize: 12, color: TEXT_SECONDARY },
  segmentTextActive: { color: ACCENT, fontWeight: "700" },
  modalSubmitBtn: { backgroundColor: ACCENT, borderRadius: 24, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  modalSubmitBtnText: { fontSize: 15, fontWeight: "600", color: "white" }
});
