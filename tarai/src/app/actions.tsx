import { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View,
  Text,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useTheme } from "@/hooks/use-theme";
import { useDb } from "@/db/provider";
import { update } from "@/lib/tools";
import {
  useMotion,
  type ActionGroup,
  type ActionItem,
} from "@/hooks/use-motion";
type Urgency = "Now" | "Next" | "Later" | "Done";

function parseData(data: string): Record<string, any> {
  try {
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

// Notion-style girl avatar (bundled DiceBear "Notionists" illustration) — used when user has no photo
const NOTION_AVATAR = require("../../assets/images/profile avatar.webp");

function StatusDot({
  status,
  color,
  size = 8,
}: {
  status: "todo" | "in_progress" | "done";
  color: string;
  size?: number;
}) {
  if (status === "todo") {
    return (
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            borderStyle: "dotted",
          },
        ]}
      />
    );
  }
  if (status === "in_progress") {
    return (
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            borderColor: color,
          },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#34C759",
          borderColor: "#34C759",
        },
      ]}
    />
  );
}

function GroupSection({
  group,
  theme,
  onPressGroup,
  onPressAction,
}: {
  group: ActionGroup;
  theme: any;
  onPressGroup: () => void;
  onPressAction: (action: ActionItem) => void;
}) {
  const tasks = group.actions.filter((a) => a.vertical === "task");
  const others = group.actions.filter((a) => a.vertical !== "task");
  const isTask = group.type === "task";

  return (
    <View style={styles.groupSection}>
      <Pressable style={styles.groupHeader} onPress={onPressGroup}>
        <View style={[styles.groupAvatar, { backgroundColor: group.color }]}>
          <Text style={styles.groupAvatarText}>
            {group.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={[styles.groupName, { color: theme.text }]}>
            {group.name}
          </Text>
          <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>
            {isTask
              ? `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`
              : `${group.actions.length} action${group.actions.length !== 1 ? "s" : ""}`}
          </Text>
        </View>
      </Pressable>

      {isTask
        ? tasks.map((action) => {
            const subs = group.actions.filter(
              (a) =>
                a.vertical === "subtask" &&
                a.routeParams.id === action.routeParams.id,
            );
            return (
              <View key={action.id}>
                <Pressable
                  style={({ pressed }) => [
                    styles.timelineRow,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => onPressAction(action)}
                >
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { color: theme.text }]}>
                      {action.title}
                    </Text>
                    {action.subtitle ? (
                      <Text
                        style={[
                          styles.timelineMeta,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {action.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {subs.map((sub) => (
                  <Pressable
                    key={sub.id}
                    style={({ pressed }) => [
                      styles.subtaskRow,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => onPressAction(sub)}
                  >
                    <Text
                      style={[
                        styles.subtaskTitle,
                        {
                          color:
                            sub.status === "done"
                              ? theme.textSecondary
                              : theme.text,
                          textDecorationLine:
                            sub.status === "done" ? "line-through" : "none",
                        },
                      ]}
                    >
                      {sub.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            );
          })
        : others.map((action) => (
            <Pressable
              key={action.id}
              style={({ pressed }) => [
                styles.timelineRow,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onPressAction(action)}
            >
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: theme.text }]}>
                  {action.title}
                </Text>
                {action.subtitle ? (
                  <Text
                    style={[
                      styles.timelineMeta,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {action.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
    </View>
  );
}

export default function ActionsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const [activeFilter, setActiveFilter] = useState<Urgency>("Now");
  const { groups, loading, refresh } = useMotion(activeFilter);
  const filters: Urgency[] = ["Now", "Next", "Later", "Done"];

  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [showEditModal, setShowEditModal] = useState(false);

  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) refresh();
      isMounted.current = true;
    }, [refresh]),
  );

  const handlePressGroup = (group: ActionGroup) => {
    router.push({ pathname: "/entity", params: { id: group.id } });
  };

  const handlePressAction = async (action: ActionItem) => {
    const stream = action.routeParams.id;
    if (!stream) {
      router.push({
        pathname: action.route as any,
        params: action.routeParams as any,
      });
      return;
    }

    const parts = action.id.split('_');
    const seqStr = parts[parts.length - 1];
    const seq = parseInt(seqStr, 10);

    if (isNaN(seq)) {
      router.push({
        pathname: action.route as any,
        params: action.routeParams as any,
      });
      return;
    }

    const motion = await db.getFirstAsync<any>(
      "SELECT * FROM motion WHERE stream = ? AND seq = ?",
      [stream, seq]
    );
    if (!motion) {
      router.push({
        pathname: action.route as any,
        params: action.routeParams as any,
      });
      return;
    }

    const md = parseData(motion.data);
    let targetId = md.targetId;

    if (!targetId) {
      const searchTitle = md.title || (motion.action === 900 ? null : md.action);
      if (searchTitle) {
        const match = await db.getFirstAsync<any>(
          "SELECT id FROM matter WHERE json_extract(data, '$.title') = ? AND active = 1 ORDER BY time DESC LIMIT 1",
          [searchTitle]
        );
        if (match) {
          targetId = match.id;
        }
      }

      if (!targetId && md.action) {
        const match = await db.getFirstAsync<any>(
          "SELECT id FROM matter WHERE (json_extract(data, '$.title') LIKE ? OR type = ?) AND active = 1 ORDER BY time DESC LIMIT 1",
          [`%${md.action}%`, md.action.toLowerCase()]
        );
        if (match) {
          targetId = match.id;
        }
      }
    }

    if (!targetId) {
      router.push({
        pathname: action.route as any,
        params: action.routeParams as any,
      });
      return;
    }

    const matter = await db.getFirstAsync<any>(
      "SELECT * FROM matter WHERE id = ?",
      targetId
    );
    if (!matter) {
      router.push({
        pathname: action.route as any,
        params: action.routeParams as any,
      });
      return;
    }

    const matterData = parseData(matter.data);
    const actionId = md.actionId || `tool_create_${matter.type}`;

    const actionRow = await db.getFirstAsync<any>(
      "SELECT data FROM form WHERE id = ?",
      actionId
    );
    let fields = [];
    if (actionRow && actionRow.data) {
      try {
        const actData = JSON.parse(actionRow.data);
        fields = actData.fields || [];
      } catch (_) {}
    }

    if (fields.length === 0) {
      fields = [
        { name: "title", type: "text", label: "Title" },
        { name: "due", type: "date", label: "Due Date" },
        { name: "assignee", type: "text", label: "Assignee" },
        { name: "priority", type: "select", label: "Priority", options: ["low", "medium", "high"] }
      ];
    }

    setEditingActivity({
      motion,
      matter,
      fields,
    });
    setEditFields({
      title: matterData.title || md.title || "",
      ...matterData,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingActivity) return;
    const { matter, motion } = editingActivity;
    
    const newTitle = editFields.title || "";
    const updatedData = { ...editFields };
    delete updatedData.title;

    await update({
      table: 'matter',
      id: matter.id,
      scope: matter.scope,
      patch: {
        title: newTitle,
        data: updatedData,
      }
    });

    const md = parseData(motion.data);
    const newDueDate = editFields.due ? `Due: ${editFields.due}` : '';
    await db.runAsync(
      "UPDATE motion SET data = ? WHERE stream = ? AND seq = ?",
      JSON.stringify({
        ...md,
        title: newTitle,
        text: newDueDate,
      }),
      motion.stream,
      motion.seq
    );

    setShowEditModal(false);
    setEditingActivity(null);
    refresh();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Actions</Text>
      </View>

      <View style={styles.filters}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            style={[
              styles.filterTab,
              activeFilter === filter && [
                styles.filterTabActive,
                { borderColor: theme.text },
              ],
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color:
                    activeFilter === filter ? theme.text : theme.textSecondary,
                },
                activeFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        >
          {groups.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              No actions
            </Text>
          ) : (
            groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                theme={theme}
                onPressGroup={() => handlePressGroup(group)}
                onPressAction={handlePressAction}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Actions chip */}
      <View style={[styles.chipBar, { paddingLeft: 16, paddingBottom: 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.chipBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/actions-catalog" as any)}
        >
          <Ionicons name="apps-outline" size={16} color="#5E6AD2" />
          <Text style={styles.chipBtnText}>Actions</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: insets.bottom,
            backgroundColor: theme.background,
            borderColor: theme.backgroundElement,
          },
        ]}
      >
        <View style={styles.actionBarRow}>
          <Pressable
            style={styles.profileButton}
            onPress={() => router.push("/personal")}
          >
            <Image
              source={NOTION_AVATAR}
              style={styles.profileImage}
              contentFit="cover"
            />
          </Pressable>
          <Pressable
            style={styles.taraiCircleWrap}
            onPress={() => router.push("/chat")}
          >
            <View style={styles.taraiCircle} />
          </Pressable>
          <Pressable
            style={[
              styles.iconBtn,
              { backgroundColor: theme.backgroundElement },
            ]}
            onPress={() => router.push("/browse")}
          >
            <Ionicons name="search" size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Edit Activity Item Modal */}
      <Modal visible={showEditModal} animationType="slide">
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={[styles.headerEdit, { borderBottomColor: theme.backgroundElement }]}>
            <Pressable onPress={() => { setShowEditModal(false); setEditingActivity(null); }} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              Update Action
            </Text>
            <Pressable onPress={handleSaveEdit} style={styles.backBtn}>
              <Ionicons name="checkmark" size={24} color="#10B981" />
            </Pressable>
          </View>

          <KeyboardAwareScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
            {editingActivity?.fields.map((field: any) => (
              <View key={field.name} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {field.label}
                </Text>
                {field.type === 'select' ? (
                  <View>
                    <Pressable
                      style={[styles.selectBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement }]}
                      onPress={() => {
                        const currentIndex = field.options.indexOf(editFields[field.name]);
                        const nextIndex = (currentIndex + 1) % field.options.length;
                        setEditFields(prev => ({ ...prev, [field.name]: field.options[nextIndex] }));
                      }}>
                      <Text style={{ color: editFields[field.name] ? theme.text : theme.textSecondary, fontSize: 15, textTransform: 'capitalize' }}>
                        {editFields[field.name] || 'Select...'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <TextInput
                    style={[styles.textInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    value={String(editFields[field.name] ?? '')}
                    onChangeText={(t) => setEditFields(prev => ({ ...prev, [field.name]: t }))}
                    placeholder={field.placeholder || `Enter ${field.label}...`}
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              </View>
            ))}
          </KeyboardAwareScrollView>

          <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              style={[styles.executeBtn, { backgroundColor: '#10B981', flex: 1 }]}
              onPress={handleSaveEdit}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.executeBtnText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "700" },
  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  filterTabActive: { borderBottomWidth: 2 },
  filterText: { fontSize: 14, fontWeight: "500" },
  filterTextActive: { fontWeight: "600" },
  scrollView: { flex: 1 },
  empty: { textAlign: "center", paddingTop: 60, fontSize: 15 },
  groupSection: { marginBottom: 8 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  groupAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  groupAvatarText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: "600" },
  groupMeta: { fontSize: 12, marginTop: 2 },
  timelineRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: "500" },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    paddingLeft: 32,
    gap: 8,
  },
  subtaskTitle: { fontSize: 13, fontWeight: "400", flex: 1 },
  dot: { borderWidth: 1.5 },
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
  actionBar: { borderTopWidth: StyleSheet.hairlineWidth },
  actionBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  profileButton: {},
  profileImage: { width: 44, height: 44, borderRadius: 10 },
  taraiCircleWrap: { padding: 4 },
  taraiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    experimental_backgroundImage:
      "linear-gradient(135deg, #5E6AD2, #8B5CF6, #22D3EE)",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  headerEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
  fieldGroup: { paddingHorizontal: 16, paddingTop: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  textInput: { fontSize: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  bottomBar: { flexDirection: 'row', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12 },
  executeBtn: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  executeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
