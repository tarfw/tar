import { useState, useEffect } from "react";
import {
  StyleSheet,
  Pressable,
  View,
  TextInput,
  Text,
  ActivityIndicator,
  Modal,
  FlatList,
  BackHandler,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useTheme } from "@/hooks/use-theme";
import { useDb } from "@/db/provider";
import { useFormById, type FormRow } from "@/hooks/use-form";
import { searchSkills, type SkillSearchResult } from "@/skills/store";
import type { SkillDef } from "@/skills/definitions";
import SkillForm from "@/components/SkillForm";
import StorefrontTab from "@/components/StorefrontTab";

function parseData(data: string): Record<string, any> {
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export default function EntityScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { row, loading: rowLoading } = useFormById(params.id);

  const [localTitle, setLocalTitle] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [motions, setMotions] = useState<any[]>([]);
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [storeTransactions, setStoreTransactions] = useState<any[]>([]);
  const [storeTab, setStoreTab] = useState<
    "items" | "transactions" | "storefront"
  >("items");
  const [detailTab, setDetailTab] = useState<
    "activity" | "details" | "members"
  >("activity");
  const [skillQuery, setSkillQuery] = useState("");
  const [skillResults, setSkillResults] = useState<SkillSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillDef | null>(null);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [members, setMembers] = useState<FormRow[]>([]);
  const [showPickMember, setShowPickMember] = useState(false);
  const [allPeople, setAllPeople] = useState<FormRow[]>([]);

  const loadMatter = async () => {
    if (!row) return;

    setLocalTitle(row.title);

    const mov = await db.getAllAsync<any>(
      "SELECT * FROM motion WHERE stream = ? ORDER BY seq DESC LIMIT 20",
      row.id,
    );
    setMotions(mov);

    // Load store items (matter rows linked via graph)
    if (row.type === "store") {
      const items = await db.getAllAsync<any>(
        `SELECT m.*, f.title as product_name, f.data as product_data
         FROM matter m
         JOIN graph g ON g.src = m.id AND g.type = 'belongs_to'
         JOIN form f ON f.id = m.form
         WHERE g.tgt = ? AND m.type = 'stock' AND m.active = 1`,
        row.id,
      );
      setStoreItems(items);

      // Load recent transactions for all items in this store
      const itemIds = items.map((i: any) => i.id);
      if (itemIds.length > 0) {
        const placeholders = itemIds.map(() => "?").join(",");
        const txns = await db.getAllAsync<any>(
          `SELECT mo.*, m.form as product_id, f.title as product_name, m.data as item_data
           FROM motion mo
           JOIN matter m ON m.id = mo.stream
           JOIN form f ON f.id = m.form
           WHERE mo.stream IN (${placeholders})
           ORDER BY mo.time DESC LIMIT 20`,
          ...itemIds,
        );
        setStoreTransactions(txns);
      } else {
        setStoreTransactions([]);
      }
    }

    // Load members for team/work entities
    if (row.type === "team") {
      const memberLinks = await db.getAllAsync<{ tgt: string }>(
        "SELECT tgt FROM graph WHERE src = ? AND type = 'has_member' AND active = 1",
        row.id,
      );
      const memberIds = memberLinks.map((l) => l.tgt);
      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => "?").join(",");
        const membersList = await db.getAllAsync<FormRow>(
          `SELECT * FROM form WHERE id IN (${placeholders}) AND active = 1`,
          ...memberIds,
        );
        setMembers(membersList);
      } else {
        setMembers([]);
      }
    }
  };

  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      setLocalTitle(row.title);

      const mov = await db.getAllAsync<any>(
        "SELECT * FROM motion WHERE stream = ? ORDER BY seq DESC LIMIT 20",
        row.id,
      );
      if (cancelled) return;
      setMotions(mov);

      if (row.type === "store") {
        const items = await db.getAllAsync<any>(
          `SELECT m.*, f.title as product_name, f.data as product_data
           FROM matter m
           JOIN graph g ON g.src = m.id AND g.type = 'belongs_to'
           JOIN form f ON f.id = m.form
           WHERE g.tgt = ? AND m.type = 'stock' AND m.active = 1`,
          row.id,
        );
        if (cancelled) return;
        setStoreItems(items);

        const itemIds = items.map((i: any) => i.id);
        if (itemIds.length > 0) {
          const placeholders = itemIds.map(() => "?").join(",");
          const txns = await db.getAllAsync<any>(
            `SELECT mo.*, m.form as product_id, f.title as product_name, m.data as item_data
             FROM motion mo
             JOIN matter m ON m.id = mo.stream
             JOIN form f ON f.id = m.form
             WHERE mo.stream IN (${placeholders})
             ORDER BY mo.time DESC LIMIT 20`,
            ...itemIds,
          );
          if (cancelled) return;
          setStoreTransactions(txns);
        } else {
          setStoreTransactions([]);
        }
      }

      if (row.type === "team") {
        const memberLinks = await db.getAllAsync<{ tgt: string }>(
          "SELECT tgt FROM graph WHERE src = ? AND type = 'has_member' AND active = 1",
          row.id,
        );
        const memberIds = memberLinks.map((l) => l.tgt);
        if (memberIds.length > 0) {
          const placeholders = memberIds.map(() => "?").join(",");
          const membersList = await db.getAllAsync<FormRow>(
            `SELECT * FROM form WHERE id IN (${placeholders}) AND active = 1`,
            ...memberIds,
          );
          if (cancelled) return;
          setMembers(membersList);
        } else {
          setMembers([]);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [db, row]);

  const handleSaveTitle = async () => {
    if (!row || !localTitle.trim()) return;
    await db.runAsync(
      "UPDATE form SET title = ? WHERE id = ?",
      localTitle.trim(),
      row.id,
    );
  };

  useEffect(() => {
    if (!skillQuery.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const results = await searchSkills(skillQuery, 5);
      if (!cancelled) {
        setSkillResults(results);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [skillQuery]);

  useEffect(() => {
    if (!showPickMember) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setShowPickMember(false);
      return true;
    });
    return () => sub.remove();
  }, [showPickMember]);

  const handleSelectSkill = (skill: SkillDef) => {
    setSelectedSkill(skill);
    setShowSkillForm(true);
    setSkillQuery("");
    setSkillResults([]);
  };

  const handleSkillDone = async () => {
    setShowSkillForm(false);
    if (selectedSkill && row) {
      const seq =
        (
          await db.getFirstAsync<{ max_seq: number }>(
            "SELECT COALESCE(MAX(seq), 0) + 1 as max_seq FROM motion WHERE stream = ?",
            row.id,
          )
        )?.max_seq ?? 1;
      await db.runAsync(
        "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 900, 0, ?, ?)",
        row.id,
        seq,
        JSON.stringify({ skill: selectedSkill.name }),
        new Date().toISOString(),
      );
    }
    setSelectedSkill(null);
    await loadMatter();
  };

  const handleDelete = async () => {
    if (!row) return;
    await db.runAsync("UPDATE form SET active = 0 WHERE id = ?", row.id);
    await db.runAsync("UPDATE matter SET active = 0 WHERE form = ?", row.id);
    await db.runAsync("DELETE FROM motion WHERE stream = ?", row.id);
    setShowMenu(false);
  };

  const loadAllPeople = async () => {
    const people = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'profile' AND active = 1 ORDER BY time DESC",
    );
    setAllPeople(people);
    setShowPickMember(true);
  };

  const handleAddMember = async (personId: string) => {
    if (!row) return;
    await db.runAsync(
      "INSERT OR REPLACE INTO graph (src, tgt, type, weight, active) VALUES (?, ?, ?, ?, 1)",
      row.id,
      personId,
      "has_member",
      0,
    );
    setShowPickMember(false);
    loadMatter();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!row) return;
    await db.runAsync(
      "UPDATE graph SET active = 0 WHERE src = ? AND tgt = ? AND type = ?",
      row.id,
      memberId,
      "has_member",
    );
    loadMatter();
  };

  const formatTime = (time: string) => {
    const d = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  const motionLabel = (action: number) => {
    const labels: Record<number, string> = {
      100: "Subtask added",
      207: "Due soon",
      208: "Overdue",
      301: "Store visit",
      302: "Review",
      303: "Created",
      306: "Ticket opened",
      307: "Reply",
      401: "Dispatched",
      402: "In transit",
      407: "Return",
      410: "Delivered",
      501: "Clock in",
      502: "Clock out",
      505: "Performance note",
      506: "Leave request",
      601: "Push sent",
      602: "SMS sent",
      603: "Referral",
      701: "Booked",
      702: "Completed",
      703: "Cancelled",
      801: "Payment init",
      802: "Payment success",
      803: "Partial pay",
      806: "Expense",
      900: "Skill executed",
    };
    return labels[action] || `Action ${action}`;
  };

  if (rowLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text
          style={{
            color: theme.text,
            paddingTop: insets.top + 16,
            paddingHorizontal: 16,
          }}
        >
          Not found
        </Text>
      </View>
    );
  }

  const data = parseData(row.data);
  const avatarColor = data.color || "#5E6AD2";
  const isPerson = row.type === "profile";
  const isBusiness = row.type === "team";
  const isStore = row.type === "store";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.titleRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: avatarColor, borderRadius: isPerson ? 20 : 8 },
            ]}
          >
            <Text style={styles.avatarText}>
              {row.title.charAt(0).toUpperCase()}
            </Text>
          </View>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={handleSaveTitle}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
          />
          <Pressable onPress={() => setShowMenu(true)} style={styles.menuBtn}>
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>

        {/* People/Work Tabs — same pattern as store tabs */}
        {(isPerson || isBusiness) && (
          <>
            <View style={styles.storeTabs}>
              <Pressable
                style={[
                  styles.storeTab,
                  detailTab === "activity" && { borderBottomColor: "#5E6AD2" },
                ]}
                onPress={() => setDetailTab("activity")}
              >
                <Text
                  style={[
                    styles.storeTabText,
                    {
                      color:
                        detailTab === "activity"
                          ? "#5E6AD2"
                          : theme.textSecondary,
                    },
                  ]}
                >
                  Activity
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.storeTab,
                  detailTab === "details" && { borderBottomColor: "#5E6AD2" },
                ]}
                onPress={() => setDetailTab("details")}
              >
                <Text
                  style={[
                    styles.storeTabText,
                    {
                      color:
                        detailTab === "details"
                          ? "#5E6AD2"
                          : theme.textSecondary,
                    },
                  ]}
                >
                  Details
                </Text>
              </Pressable>
              {isBusiness && (
                <Pressable
                  style={[
                    styles.storeTab,
                    detailTab === "members" && { borderBottomColor: "#5E6AD2" },
                  ]}
                  onPress={() => setDetailTab("members")}
                >
                  <Text
                    style={[
                      styles.storeTabText,
                      {
                        color:
                          detailTab === "members"
                            ? "#5E6AD2"
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    Members
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Activity Tab */}
            {detailTab === "activity" && (
              <>
                {motions.map((m, i) => {
                  const md = parseData(m.data);
                  return (
                    <View key={i} style={styles.timelineRow}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: theme.textSecondary },
                        ]}
                      />
                      <View style={styles.timelineContent}>
                        <Text
                          style={[styles.timelineTitle, { color: theme.text }]}
                        >
                          {motionLabel(m.action)}
                        </Text>
                        <Text
                          style={[
                            styles.timelineMeta,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {formatTime(m.time)}
                          {md.skill ? ` · ${md.skill}` : ""}
                          {md.title ? ` · ${md.title}` : ""}
                          {md.text ? ` · ${md.text}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Details Tab */}
            {detailTab === "details" && (
              <>
                {data.phone ? (
                  <View style={styles.timelineRow}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: "#5E6AD2" },
                      ]}
                    />
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineTitle,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Phone
                      </Text>
                      <Text
                        style={[styles.timelineMeta, { color: theme.text }]}
                      >
                        {data.phone}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {data.email ? (
                  <View style={styles.timelineRow}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: "#5E6AD2" },
                      ]}
                    />
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineTitle,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Email
                      </Text>
                      <Text
                        style={[styles.timelineMeta, { color: theme.text }]}
                      >
                        {data.email}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {data.role ? (
                  <View style={styles.timelineRow}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: "#5E6AD2" },
                      ]}
                    />
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineTitle,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Role
                      </Text>
                      <Text
                        style={[styles.timelineMeta, { color: theme.text }]}
                      >
                        {data.role}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            )}

            {/* Members Tab — only for business/work */}
            {isBusiness && detailTab === "members" && (
              <>
                {members.map((m) => {
                  const md = parseData(m.data);
                  return (
                    <Pressable
                      key={m.id}
                      style={({ pressed }) => [
                        styles.timelineRow,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/entity",
                          params: { id: m.id },
                        })
                      }
                    >
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: md.color || "#5E6AD2" },
                        ]}
                      />
                      <View style={styles.timelineContent}>
                        <Text
                          style={[styles.timelineTitle, { color: theme.text }]}
                        >
                          {m.title}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveMember(m.id)}
                        style={{ padding: 4 }}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={theme.textSecondary}
                        />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* Store info */}
        {isStore && (
          <>
            {/* Store Tabs */}
            <View style={styles.storeTabs}>
              <Pressable
                style={[
                  styles.storeTab,
                  storeTab === "items" && { borderBottomColor: "#5E6AD2" },
                ]}
                onPress={() => setStoreTab("items")}
              >
                <Text
                  style={[
                    styles.storeTabText,
                    {
                      color:
                        storeTab === "items" ? "#5E6AD2" : theme.textSecondary,
                    },
                  ]}
                >
                  Items
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.storeTab,
                  storeTab === "transactions" && {
                    borderBottomColor: "#5E6AD2",
                  },
                ]}
                onPress={() => setStoreTab("transactions")}
              >
                <Text
                  style={[
                    styles.storeTabText,
                    {
                      color:
                        storeTab === "transactions"
                          ? "#5E6AD2"
                          : theme.textSecondary,
                    },
                  ]}
                >
                  Transactions
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.storeTab,
                  storeTab === "storefront" && { borderBottomColor: "#5E6AD2" },
                ]}
                onPress={() => setStoreTab("storefront")}
              >
                <Text
                  style={[
                    styles.storeTabText,
                    {
                      color:
                        storeTab === "storefront"
                          ? "#5E6AD2"
                          : theme.textSecondary,
                    },
                  ]}
                >
                  Storefront
                </Text>
              </Pressable>
            </View>

            {/* Items Tab */}
            {storeTab === "items" && (
              <>
                {storeItems.map((item) => {
                  const id = parseData(item.data);
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.timelineRow,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/entity",
                          params: { id: item.id },
                        })
                      }
                    >
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: "#10B981" },
                        ]}
                      />
                      <View style={styles.timelineContent}>
                        <Text
                          style={[styles.timelineTitle, { color: theme.text }]}
                        >
                          {item.product_name}
                        </Text>
                        <Text
                          style={[
                            styles.timelineMeta,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {id.variant || id.size || ""}{" "}
                          {item.qty !== null ? `· ${item.qty} nos` : ""}
                          {item.value ? ` · ₹${item.value}` : ""}
                          {id.location ? ` · ${id.location}` : ""}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  );
                })}
              </>
            )}

            {/* Storefront Tab */}
            {storeTab === "storefront" && (
              <View style={{ height: 480 }}>
                <StorefrontTab
                  storeId={row.id}
                  storeName={row.title}
                  subdomain={data.subdomain}
                  products={storeItems}
                />
              </View>
            )}

            {/* Transactions Tab */}
            {storeTab === "transactions" && (
              <>
                {storeTransactions.map((txn) => {
                  return (
                    <View
                      key={txn.stream + "_" + txn.seq}
                      style={styles.timelineRow}
                    >
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor:
                              txn.delta && txn.delta < 0
                                ? "#FF3B30"
                                : "#10B981",
                          },
                        ]}
                      />
                      <View style={styles.timelineContent}>
                        <Text
                          style={[styles.timelineTitle, { color: theme.text }]}
                        >
                          {txn.product_name}
                        </Text>
                        <Text
                          style={[
                            styles.timelineMeta,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {motionLabel(txn.action)}
                          {txn.delta
                            ? ` ${txn.delta > 0 ? "+" : ""}${txn.delta} nos`
                            : ""}
                          {txn.delta && txn.value
                            ? ` · ₹${Math.abs(txn.delta * (txn.value || 0))}`
                            : ""}
                          {formatTime(txn.time)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Bottom bar — sticks to keyboard top when open */}
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        style={{ paddingBottom: insets.bottom }}
      >
        {/* Skill results dropdown */}
        {skillResults.length > 0 && (
          <View
            style={[
              styles.skillResults,
              {
                backgroundColor: theme.background,
                borderTopColor: "rgba(0,0,0,0.1)",
              },
            ]}
          >
            {skillResults.map((r) => (
              <Pressable
                key={r.skill.name}
                style={[
                  styles.skillRow,
                  { backgroundColor: theme.backgroundElement },
                ]}
                onPress={() => handleSelectSkill(r.skill)}
              >
                <View
                  style={[styles.skillIcon, { backgroundColor: "#5E6AD2" }]}
                >
                  <Ionicons name="flash" size={18} color="#fff" />
                </View>
                <View style={styles.skillInfo}>
                  <Text
                    style={[styles.skillName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {r.skill.name}
                  </Text>
                  <Text
                    style={[styles.skillDesc, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {r.skill.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Add Item Chip */}
        {isStore && storeTab === "items" && (
          <View style={styles.chipBar}>
            <Pressable
              style={({ pressed }) => [
                styles.chipBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/add-item",
                  params: { storeId: row.id },
                })
              }
            >
              <Ionicons name="add" size={16} color="#5E6AD2" />
              <Text style={styles.chipBtnText}>item</Text>
            </Pressable>
          </View>
        )}

        {/* Add Member Chip */}
        {isBusiness && detailTab === "members" && (
          <View style={styles.chipBar}>
            <Pressable
              style={({ pressed }) => [
                styles.chipBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={loadAllPeople}
            >
              <Ionicons name="add" size={16} color="#5E6AD2" />
              <Text style={styles.chipBtnText}>member</Text>
            </Pressable>
          </View>
        )}

        {/* Search input bar */}
        <View
          style={[styles.inputBarFixed, { backgroundColor: theme.background }]}
        >
          <View
            style={[
              styles.inputBarInner,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.inputBarText, { color: theme.text }]}
              value={skillQuery}
              onChangeText={setSkillQuery}
              placeholder="Search a skill…"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="search"
            />
            {searching && (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            )}
          </View>
        </View>
      </KeyboardStickyView>

      {/* Skill Form Modal */}
      <Modal visible={showSkillForm} animationType="slide">
        {selectedSkill && (
          <SkillForm
            skill={selectedSkill}
            onDone={handleSkillDone}
            onCancel={() => {
              setShowSkillForm(false);
              setSelectedSkill(null);
            }}
          />
        )}
      </Modal>

      {/* Menu Bottom Sheet */}
      <Modal visible={showMenu} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowMenu(false)}
        >
          <Pressable
            style={[styles.bottomSheet, { backgroundColor: theme.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: theme.textSecondary },
              ]}
            />
            <View style={styles.menuOptions}>
              <Pressable
                style={styles.menuOption}
                onPress={() => {
                  setShowMenu(false);
                }}
              >
                <Ionicons name="copy-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>
                  Duplicate
                </Text>
              </Pressable>
              <View
                style={[
                  styles.menuSeparator,
                  { backgroundColor: theme.backgroundElement },
                ]}
              />
              <Pressable style={styles.menuOption} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.menuOptionText, { color: "#FF3B30" }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pick Member Full Screen */}
      <Modal
        visible={showPickMember}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.pickHeader, { paddingTop: insets.top + 8 }]}>
            <Text style={[styles.pickTitle, { color: theme.text }]}>
              Add Member
            </Text>
          </View>
          <FlatList
            data={allPeople.filter(
              (p) => !new Set(members.map((m) => m.id)).has(p.id),
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => {
              const pd = parseData(item.data);
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.pickRow,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleAddMember(item.id)}
                >
                  <View
                    style={[
                      styles.pickAvatar,
                      { backgroundColor: pd.color || "#5E6AD2" },
                    ]}
                  >
                    <Text style={styles.pickAvatarText}>
                      {item.title.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.pickName, { color: theme.text }]}>
                    {item.title}
                  </Text>
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#5E6AD2"
                  />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                All people are already members
              </Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  titleInput: { flex: 1, fontSize: 22, fontWeight: "600", paddingVertical: 0 },
  menuBtn: { padding: 8 },
  chipsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  chipText: { fontSize: 13, fontWeight: "500" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  storeTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  storeTab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  storeTabText: { fontSize: 14, fontWeight: "500" },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 20 },
  timelineRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: "500" },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  // Skill results
  skillResults: {
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 240,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  skillIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  skillInfo: { flex: 1, gap: 2 },
  skillName: { fontSize: 14, fontWeight: "500" },
  skillDesc: { fontSize: 12 },
  // Bottom input bar
  inputBarFixed: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  chipBar: { paddingLeft: 16, paddingBottom: 8, flexDirection: "row", gap: 8 },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#5E6AD215",
    gap: 4,
  },
  chipBtnText: { fontSize: 14, fontWeight: "600", color: "#5E6AD2" },
  inputBarInner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputBarText: { flex: 1, fontSize: 15, paddingVertical: 0 },
  // Bottom Sheet
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "50%",
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.3,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  // Menu
  menuOptions: { paddingHorizontal: 20, paddingVertical: 16 },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  menuOptionText: { fontSize: 16, fontWeight: "500" },
  menuSeparator: { height: 1, marginVertical: 8 },
  pickHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  pickTitle: { fontSize: 28, fontWeight: "700" },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  pickAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  pickAvatarText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  pickName: { flex: 1, fontSize: 15, fontWeight: "400" },
});
