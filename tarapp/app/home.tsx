import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  getSelfId,
  cachedSelfId,
  getPrimarySyncDb,
  getLocalPrivateDb,
  isCollabSyncEnabled,
} from "../lib/db";
import * as Haptics from "expo-haptics";
import { getCurrentUser, UserProfile } from "../lib/auth";
import { setActiveMassId } from "../lib/state";

// ---------------------------------------------------------------------------
// Home = the now-slice of open worldlines.
//
// Every actionable thing the user creates in /workspace is a `mass` row with a
// `start`, an `end`, and an `active` flag — a worldline that begins, persists,
// and ends. This screen renders the present moment cutting across all of those
// worldlines: the ones still `active = 1`. Each tap emits the next `motion`
// event, pushing that worldline forward in time until it reaches a terminal
// state and falls out of the slice. See docs/technical/spacetime.md.
// ---------------------------------------------------------------------------

type Kind = "task" | "schedule" | "lead" | "ticket" | "trip" | "invoice" | "order";

// A line item on an order — a single motion row (action 105) whose `phase`
// advances 105→106→107→108→109 along the fulfillment chain.
interface OrderItem {
  seq: number;
  title: string;
  qty: number;
  price: number;
  phase: number;
  isPayment?: boolean;
}

interface Worldline {
  id: string;
  matter: string;
  kind: Kind;
  value: number | null;
  start: string | null;
  end: string | null;
  time: string;
  data: string | null;
  rootData: string | null;
  lastAction: number | null;
  entityTitle: string | null;
  entityType: string | null;
  originSync: boolean;
  items?: OrderItem[]; // populated for kind === "order"
}

// Order fulfillment chain. The order's overall phase is the MIN across its
// items — it is only DELIVERED once every item has been handed over.
const ORDER_PHASES = [105, 106, 107, 108, 109];
const ORDER_PHASE_LABEL: Record<number, string> = {
  105: "Placed",
  106: "Confirmed",
  107: "Preparing",
  108: "Ready",
  109: "Delivered",
};
const nextOrderPhase = (p: number) => {
  const i = ORDER_PHASES.indexOf(p);
  return i < 0 || i >= ORDER_PHASES.length - 1 ? 109 : ORDER_PHASES[i + 1];
};
const ORDER_PHASE_COLOR: Record<number, string> = {
  105: "#94a3b8",
  106: "#2563eb",
  107: "#ca5010",
  108: "#16a34a",
  109: "#475569",
};

// Status string → phase opcode, mirroring workspace.tsx PHASE_MAP (subset used here).
const PHASE_MAP: Record<string, number> = {
  CONTACTED: 304,
  CONVERTED: 305,
  RESOLVED: 308,
  IN_TRANSIT: 402,
  DELIVERED: 109,
  PAYMENT_SUCCESS: 802,
  COMPLETED: 308,
};

const KIND_META: Record<Kind, { color: string; icon: any; label: string }> = {
  task: { color: "#6366f1", icon: "checkbox-outline", label: "Task" },
  schedule: { color: "#8764b8", icon: "calendar-outline", label: "Shift" },
  lead: { color: "#ca5010", icon: "trending-up-outline", label: "Lead" },
  ticket: { color: "#d13438", icon: "help-buoy-outline", label: "Ticket" },
  trip: { color: "#2563eb", icon: "navigate-outline", label: "Trip" },
  invoice: { color: "#107c41", icon: "card-outline", label: "Invoice" },
  order: { color: "#0066cc", icon: "receipt-outline", label: "Order" },
};

function parseData(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
}

const formatRelativeTime = (timeStr: string | null) => {
  if (!timeStr) return "";
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const past = diffMs < 0;
    const mins = Math.floor(Math.abs(diffMs) / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    let label: string;
    if (mins < 1) label = "now";
    else if (mins < 60) label = `${mins}m`;
    else if (hours < 24) label = `${hours}h`;
    else if (days < 7) label = `${days}d`;
    else return date.toLocaleDateString([], { month: "short", day: "numeric" });

    return past ? `${label} ago` : `in ${label}`;
  } catch (e) {
    return "";
  }
};

// Worldline query: every open `mass`, joined to its `matter` for a name, with
// the latest motion action (current stage) and the root motion data (subject /
// ref / source). Independent of relations, so it works in any user DB.
const WORLDLINE_QUERY = `
  SELECT m.id, m.matter, m.type AS mass_type, m.value, m.start, m.end, m.data, m.time,
         mt.title AS entity_title, mt.type AS entity_type,
         (SELECT action FROM motion WHERE stream = m.id ORDER BY seq DESC LIMIT 1) AS last_action,
         (SELECT data   FROM motion WHERE stream = m.id ORDER BY seq ASC  LIMIT 1) AS root_data
  FROM mass m
  LEFT JOIN matter mt ON mt.id = m.matter
  WHERE m.active = 1 AND m.type IN ('lead', 'ticket', 'trip', 'invoice', 'slot', 'order')
`;

// Line items of an order: the action=105 fulfillment and action=801 payment motions on its stream.
const ORDER_ITEMS_QUERY = `
  SELECT seq, action, phase, delta, data FROM motion
  WHERE stream = ? AND action IN (105, 801)
  ORDER BY seq ASC
`;

function rowToWorldline(r: any, originSync: boolean): Worldline | null {
  let kind: Kind;
  if (r.mass_type === "slot") {
    kind = r.entity_type === "person" || r.entity_type === "family" ? "schedule" : "task";
  } else {
    kind = r.mass_type as Kind;
  }

  // Converted leads are terminal even though the mass stays active=1 — they
  // have left the now-slice, so drop them.
  if (kind === "lead" && r.last_action === 305) return null;

  return {
    id: r.id,
    matter: r.matter,
    kind,
    value: r.value,
    start: r.start,
    end: r.end,
    time: r.time,
    data: r.data,
    rootData: r.root_data,
    lastAction: r.last_action,
    entityTitle: r.entity_title,
    entityType: r.entity_type,
    originSync,
  };
}

// An order's overall phase is the MIN across its line items — only DELIVERED
// once every item has been handed over.
const orderPhase = (items: OrderItem[]) => {
  const physicalItems = items.filter(i => !i.isPayment);
  return physicalItems.length ? Math.min(...physicalItems.map((i) => i.phase)) : 105;
};

// Title, current stage label, and the label for the next motion this row emits.
function describe(item: Worldline): { title: string; stage?: string; next: string } {
  const root = parseData(item.rootData);
  const d = parseData(item.data);
  switch (item.kind) {
    case "task":
      return { title: item.entityTitle || "Task", next: "Mark complete" };
    case "schedule":
      return { title: d.title || "Shift", next: "End shift" };
    case "lead": {
      const stage = item.lastAction === 304 ? "contacted" : "new";
      const who = item.entityTitle ? ` · ${item.entityTitle}` : "";
      return {
        title: `$${Number(item.value || 0).toFixed(0)} lead${who}`,
        stage,
        next: stage === "new" ? "Mark contacted" : "Mark converted",
      };
    }
    case "ticket":
      return { title: root.subject || "Ticket", next: "Resolve" };
    case "trip": {
      const stage = item.lastAction === 402 ? "in_transit" : "dispatched";
      return {
        title: root.ref || "Delivery trip",
        stage,
        next: stage === "in_transit" ? "Mark delivered" : "Start transit",
      };
    }
    case "invoice":
      return { title: `Invoice $${Number(item.value || 0).toFixed(0)}`, next: "Mark paid" };
    case "order": {
      const phase = orderPhase(item.items || []);
      return {
        title: `Order #${item.id.slice(-6).toUpperCase()}`,
        stage: (ORDER_PHASE_LABEL[phase] || "Placed").toLowerCase(),
        next: `Advance to ${ORDER_PHASE_LABEL[nextOrderPhase(phase)]}`,
      };
    }
  }
}

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selfId, setSelfId] = useState<string | null>(cachedSelfId);
  const [worldlines, setWorldlines] = useState<Worldline[]>([]);
  const [selected, setSelected] = useState<Worldline | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentTask, setPaymentTask] = useState<{ order: Worldline; item: OrderItem } | null>(null);

  const loadWorldlines = async () => {
    try {
      const id = cachedSelfId || (await getSelfId());
      setSelfId(id);

      const dbs = [
        { db: getPrimarySyncDb(id), sync: true },
        { db: getLocalPrivateDb(id), sync: false },
      ];

      const merged = new Map<string, Worldline>();
      for (const { db, sync } of dbs) {
        const rows = await db.all(WORLDLINE_QUERY).catch(() => [] as any[]);
        for (const r of rows as any[]) {
          const w = rowToWorldline(r, sync);
          if (!w || merged.has(w.id)) continue;

          if (w.kind === "order") {
            const itemRows = await db.all(ORDER_ITEMS_QUERY, [w.id]).catch(() => [] as any[]);
            w.items = (itemRows as any[]).map((ir) => {
              if (ir.action === 801) {
                return {
                  seq: ir.seq,
                  action: ir.action,
                  title: ir.phase === 802 ? "Payment Successful" : "Collect Payment",
                  qty: 1,
                  price: ir.delta || 0,
                  phase: ir.phase || 801,
                  isPayment: true,
                };
              }
              const d = parseData(ir.data);
              return {
                seq: ir.seq,
                action: ir.action || 105,
                title: d.title || "Item",
                qty: d.qty || 1,
                price: d.price || 0,
                phase: ir.phase || 105,
                isPayment: false,
              };
            });
            if (w.items.length > 0 && w.items.every((it) => it.phase >= 109)) continue;
          }

          merged.set(w.id, w);
        }
      }

      const list = Array.from(merged.values()).sort((a, b) => {
        const ta = a.end || a.start || a.time || "";
        const tb = b.end || b.start || b.time || "";
        return String(ta).localeCompare(String(tb));
      });

      setWorldlines(list);
    } catch (e) {
      console.error("[Home] Failed to load worldlines:", e);
    }
  };

  const handleCompletePayment = async (method: "cash" | "card" | "upi") => {
    if (!paymentTask || busy || !selfId) return;
    const { order, item } = paymentTask;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const db = order.originSync ? getPrimarySyncDb(selfId) : getLocalPrivateDb(selfId);
      
      await db.run(
        "UPDATE motion SET phase = 802, data = ? WHERE stream = ? AND seq = ?",
        [
          JSON.stringify({
            m: method.toUpperCase(),
            ref: order.id,
            ph: { "802": Date.now() }
          }),
          order.id,
          item.seq
        ]
      );
      
      setPaymentTask(null);
      await closeOrderIfDelivered(db, order.id);
      await loadWorldlines();
      
      if (await isCollabSyncEnabled()) {
        await db.push().catch((err: any) => console.warn("[Home] Sync push failed:", err));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not complete payment.");
    } finally {
      setBusy(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        if (cancelled) return;
        await loadWorldlines();
      }

      async function loadProfile() {
        try {
          const user = await getCurrentUser();
          if (!cancelled) setUserProfile(user);
        } catch (e) {
          console.error("[Home] Failed to load user profile:", e);
        }
      }

      loadProfile();
      load();
      const intervalId = setInterval(load, 2000);
      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [])
  );

  // ---- Motion writers (mirror workspace.tsx) ----

  const appendMotion = async (
    db: any,
    stream: string,
    action: number,
    status: string,
    delta: number | null,
    data: Record<string, any>
  ) => {
    const phase = PHASE_MAP[status] || action;
    const seqRow = await db.all(
      "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?",
      [stream]
    );
    const nextSeq = seqRow[0]?.next_seq || Date.now() * 1000;
    await db.run(
      "INSERT INTO motion (stream, seq, action, phase, delta, data) VALUES (?, ?, ?, ?, ?, ?)",
      [stream, nextSeq, action, phase, delta, JSON.stringify(data)]
    );
  };

  const phaseUpdateMotion = async (
    db: any,
    stream: string,
    action: number,
    status: string,
    delta: number | null,
    data: Record<string, any>
  ) => {
    const rows = await db.all(
      "SELECT seq, data FROM motion WHERE stream = ? ORDER BY seq ASC LIMIT 1",
      [stream]
    );
    const phase = PHASE_MAP[status] || action;
    if (rows && rows.length > 0) {
      const targetSeq = rows[0].seq;
      let dataObj: Record<string, any> = {};
      try {
        dataObj = JSON.parse(rows[0].data) || {};
      } catch (_) {}
      const ph = dataObj.ph || {};
      ph[String(phase)] = Date.now();
      const updatedData = { ...dataObj, ...data, ph };
      await db.run(
        "UPDATE motion SET phase = ?, action = ?, delta = COALESCE(?, delta), data = ? WHERE stream = ? AND seq = ?",
        [phase, action, delta, JSON.stringify(updatedData), stream, targetSeq]
      );
    } else {
      await appendMotion(db, stream, action, status, delta, data);
    }
  };

  // Push the worldline one step forward in time by emitting its next motion.
  const advance = async (item: Worldline) => {
    if (busy || !selfId) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const db = item.originSync ? getPrimarySyncDb(selfId) : getLocalPrivateDb(selfId);
      const now = new Date().toISOString();

      switch (item.kind) {
        case "task":
          await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [now, item.id]);
          await appendMotion(db, item.matter, 504, "COMPLETED", null, {
            task: describe(item).title,
            completed_at: now,
          });
          break;
        case "schedule":
          await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [now, item.id]);
          break;
        case "lead":
          if (item.lastAction === 304) {
            await phaseUpdateMotion(db, item.id, 305, "CONVERTED", item.value, {});
          } else {
            await phaseUpdateMotion(db, item.id, 304, "CONTACTED", null, { channel: "email" });
          }
          break;
        case "ticket":
          await phaseUpdateMotion(db, item.id, 308, "RESOLVED", null, { resolution: "completed" });
          await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [now, item.id]);
          break;
        case "trip":
          if (item.lastAction === 402) {
            await phaseUpdateMotion(db, item.id, 109, "DELIVERED", null, {});
            await db.run("UPDATE mass SET active = 0 WHERE id = ?", [item.id]);
          } else {
            await phaseUpdateMotion(db, item.id, 402, "IN_TRANSIT", null, {});
          }
          break;
        case "invoice":
          await db.run("UPDATE mass SET active = 0 WHERE id = ?", [item.id]);
          await phaseUpdateMotion(db, item.id, 802, "PAYMENT_SUCCESS", item.value, {});
          break;
        case "order": {
          // Order-level advance: bump every item sitting at the order's current
          // (minimum) phase up to the next phase, then close if all delivered.
          const items = item.items || [];
          const cur = orderPhase(items);
          const next = nextOrderPhase(cur);
          for (const it of items) {
            if (it.phase <= cur && it.phase < 109) {
              await db.run("UPDATE motion SET phase = ? WHERE stream = ? AND seq = ?", [
                next,
                item.id,
                it.seq,
              ]);
            }
          }
          await closeOrderIfDelivered(db, item.id);
          break;
        }
      }

      if (await isCollabSyncEnabled()) {
        await db.push().catch((err: any) => console.warn("[Home] Sync push failed:", err));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not advance this item.");
    } finally {
      setBusy(false);
    }
  };

  // Close the order's mass once all of its line items reach 109 DELIVERED and payment is paid.
  const closeOrderIfDelivered = async (db: any, orderId: string) => {
    const itemsRows = await db.all(
      "SELECT phase FROM motion WHERE stream = ? AND action = 105",
      [orderId]
    );
    const paymentRows = await db.all(
      "SELECT phase FROM motion WHERE stream = ? AND action = 801",
      [orderId]
    );
    const itemsDelivered = itemsRows.length > 0 && itemsRows.every((r: any) => (r.phase || 105) >= 109);
    const paymentPaid = paymentRows.length > 0 && paymentRows.every((r: any) => (r.phase || 801) >= 802);
    if (itemsDelivered && paymentPaid) {
      await db.run("UPDATE mass SET active = 0 WHERE id = ?", [orderId]);
    }
  };

  // Per-item advance: push a single line item one step along the chain.
  const advanceOrderItem = async (order: Worldline, it: OrderItem) => {
    const done = it.isPayment ? it.phase >= 802 : it.phase >= 109;
    if (busy || !selfId || done) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const db = order.originSync ? getPrimarySyncDb(selfId) : getLocalPrivateDb(selfId);
      const next = it.isPayment ? 802 : nextOrderPhase(it.phase);
      await db.run("UPDATE motion SET phase = ? WHERE stream = ? AND seq = ?", [
        next,
        order.id,
        it.seq,
      ]);
      await closeOrderIfDelivered(db, order.id);
      await loadWorldlines();
      if (await isCollabSyncEnabled()) {
        await db.push().catch((err: any) => console.warn("[Home] Sync push failed:", err));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not advance this item.");
    } finally {
      setBusy(false);
    }
  };

  // Grouped order card: header (order #, total, phase, advance) + line items,
  // each item tappable to advance its own phase along the fulfillment chain.
  const renderOrderGroup = (item: Worldline, index: number) => {
    const items = item.items || [];
    const phase = orderPhase(items);
    const phaseColor = ORDER_PHASE_COLOR[phase] || "#94a3b8";
    return (
      <View key={item.id} style={styles.orderGroup}>
        <TouchableOpacity
          style={styles.orderHeader}
          activeOpacity={0.6}
          onPress={() => {
            setActiveMassId(item.id);
            router.push("/pos");
          }}
        >
          <View style={[styles.kindDot, { backgroundColor: KIND_META.order.color }]}>
            <Ionicons name={KIND_META.order.icon} size={14} color="white" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              Order #{item.id.slice(-6).toUpperCase()}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {items.length} item{items.length === 1 ? "" : "s"} · {ORDER_PHASE_LABEL[phase]}
            </Text>
          </View>
          <Text style={styles.orderTotal}>${Number(item.value || 0).toFixed(2)}</Text>
        </TouchableOpacity>

        <View style={styles.orderItems}>
          {items.map((it, i) => {
            const done = it.isPayment ? it.phase >= 802 : it.phase >= 109;
            const c = it.isPayment
              ? (it.phase === 802 ? "#16a34a" : "#ca5010")
              : (ORDER_PHASE_COLOR[it.phase] || "#94a3b8");
            const iconName = it.isPayment
              ? (done ? "card" : "card-outline")
              : (done ? "checkmark-circle" : "ellipse-outline");
            const label = it.isPayment
              ? (it.phase === 802 ? "Paid" : "Unpaid")
              : (ORDER_PHASE_LABEL[it.phase] || "Placed");
            return (
              <TouchableOpacity
                key={it.seq}
                style={[styles.orderItemRow, i > 0 && styles.orderItemBorder]}
                activeOpacity={0.6}
                disabled={busy || done}
                onPress={() => {
                  if (it.isPayment) {
                    setPaymentTask({ order: item, item: it });
                  } else {
                    advanceOrderItem(item, it);
                  }
                }}
              >
                <Ionicons
                  name={iconName}
                  size={20}
                  color={c}
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.orderItemText} numberOfLines={1}>
                  {it.title}{" "}
                  {it.isPayment ? (
                    <Text style={styles.orderItemQty}>(${Number(it.price).toFixed(2)})</Text>
                  ) : (
                    <Text style={styles.orderItemQty}>×{it.qty}</Text>
                  )}
                </Text>
                <Text style={[styles.orderItemPhase, { color: c }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {index < worldlines.length - 1 && <View style={styles.separator} />}
      </View>
    );
  };

  const renderRow = (item: Worldline, index: number) => {
    if (item.kind === "order") return renderOrderGroup(item, index);
    const meta = KIND_META[item.kind];
    const { title, stage } = describe(item);
    const due = item.end || item.start;
    return (
      <View key={item.id}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => setSelected(item)}
        >
          <View style={[styles.kindDot, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={14} color="white" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {meta.label}
              {stage ? ` · ${stage.replace("_", " ")}` : ""}
              {item.entityTitle && item.kind !== "task" ? ` · ${item.entityTitle}` : ""}
            </Text>
          </View>
          {due ? <Text style={styles.rowTime}>{formatRelativeTime(due)}</Text> : null}
        </TouchableOpacity>
        {index < worldlines.length - 1 && <View style={styles.separator} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
              onPress={() => router.push("/profile")}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri:
                    userProfile?.photo ||
                    "https://api.dicebear.com/7.x/notionists/png?seed=Alice&glassesProbability=100&backgroundColor=c0aede",
                }}
                style={styles.profileImage}
              />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Hello, {userProfile?.name || "Guest"}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
        >
          {worldlines.length > 0 ? (
            <View style={styles.list}>{worldlines.map((item, i) => renderRow(item, i))}</View>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(400).duration(800)}
              style={styles.emptyState}
            >
              <Ionicons name="layers-outline" size={48} color="#e2e8f0" />
              <Text style={styles.emptyText}>Nothing open right now.</Text>
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomBarRow}>
            {/* Left: Workspace */}
            <View style={styles.leftGroup}>
              <TouchableOpacity
                style={styles.bigWorkspaceChip}
                onPress={() => router.push("/workspace")}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={24} color="#4f46e5" />
              </TouchableOpacity>
            </View>

            {/* Centre: Super Agent planet button */}
            <TouchableOpacity
              style={styles.planetBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/superagent")}
            >
              <Text style={styles.planetBtnEmoji}>🪐</Text>
            </TouchableOpacity>

            {/* Right: AI + POS */}
            <View style={styles.rightGroup}>
              <TouchableOpacity
                style={styles.circleBtn}
                activeOpacity={0.8}
                onPress={() => router.push("/aichat")}
              >
                <Text style={styles.aiText}>AI</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.circleBtn, { marginLeft: 6 }]}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveMassId(null);
                  router.push("/pos");
                }}
              >
                <Ionicons name="arrow-up" size={18} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Advance Drawer */}
        {selected && (
          <>
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={() => setSelected(null)}
            />
            <View style={[styles.drawerOverlay, { paddingBottom: insets.bottom + 16 }]}>
              <View style={{ alignItems: "center", paddingTop: 8 }}>
                <View style={styles.drawerHandle} />
              </View>
              <View style={styles.drawerCard}>
                <View style={styles.drawerHeader}>
                  <View style={styles.drawerTitleRow}>
                    <View
                      style={[styles.kindDot, { backgroundColor: KIND_META[selected.kind].color }]}
                    >
                      <Ionicons name={KIND_META[selected.kind].icon} size={14} color="white" />
                    </View>
                    <Text style={styles.drawerTitle} numberOfLines={1}>
                      {describe(selected).title}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={24} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.drawerMeta}>
                  {KIND_META[selected.kind].label}
                  {describe(selected).stage ? ` · ${describe(selected).stage}` : ""}
                  {selected.end ? ` · ${formatRelativeTime(selected.end)}` : ""}
                </Text>

                <TouchableOpacity
                  style={[styles.drawerActionBtn, { backgroundColor: KIND_META[selected.kind].color }]}
                  activeOpacity={0.85}
                  disabled={busy}
                  onPress={async () => {
                    const item = selected;
                    setSelected(null);
                    await advance(item);
                  }}
                >
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.drawerActionBtnText}>{describe(selected).next}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Payment Selection Modal */}
        <Modal
          visible={paymentTask !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPaymentTask(null)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setPaymentTask(null)}
            />
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              <View style={styles.modalKnob} />
              
              <View style={{ alignItems: "center", marginVertical: 24 }}>
                <Text style={styles.modalTitle}>Collect Payment</Text>
                <Text style={styles.modalOrderSubtitle}>
                  Order #{paymentTask?.order.id.slice(-6).toUpperCase()}
                </Text>
                <Text style={styles.modalAmount}>
                  ${Number(paymentTask?.item.price || 0).toFixed(2)}
                </Text>
              </View>

              <View style={{ gap: 12, paddingHorizontal: 4 }}>
                {(["card", "cash", "upi"] as const).map((method) => {
                  const labelMap = { card: "Card", cash: "Cash", upi: "UPI" };
                  const iconMap = { card: "card-outline", cash: "cash", upi: "qr-code" } as const;
                  const colorMap = { card: "#4f46e5", cash: "#16a34a", upi: "#ca8a04" } as const;
                  return (
                    <TouchableOpacity
                      key={method}
                      style={styles.payMethodButton}
                      activeOpacity={0.7}
                      onPress={() => handleCompletePayment(method)}
                    >
                      <View style={[styles.payMethodIconContainer, { backgroundColor: colorMap[method] + "15" }]}>
                        <Ionicons name={iconMap[method]} size={22} color={colorMap[method]} />
                      </View>
                      <Text style={styles.payMethodText}>{labelMap[method]}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.cancelPayButton}
                  activeOpacity={0.7}
                  onPress={() => setPaymentTask(null)}
                >
                  <Text style={styles.cancelPayText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  scrollView: {
    flex: 1,
  },
  list: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "white",
  },
  kindDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  rowSub: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 2,
    textTransform: "capitalize",
  },
  rowTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366f1",
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 62,
  },
  orderGroup: {
    backgroundColor: "white",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#f8fafc",
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginLeft: 12,
  },
  orderItems: {
    paddingHorizontal: 20,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },
  orderItemBorder: {
    borderTopWidth: 0.5,
    borderTopColor: "#f1f5f9",
  },
  orderItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
  },
  orderItemQty: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "400",
  },
  orderItemPhase: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
    color: "#94a3b8",
    textAlign: "center",
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
  planetBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f0f4ff",
    justifyContent: "center",
    alignItems: "center",
  },
  planetBtnEmoji: {
    fontSize: 26,
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
  },
  aiText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366f1",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.32)",
    zIndex: 199,
  },
  drawerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    backgroundColor: "white",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 20,
  },
  drawerHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
  },
  drawerCard: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  drawerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    flex: 1,
  },
  drawerMeta: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 16,
    textTransform: "capitalize",
  },
  drawerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 4,
  },
  drawerActionBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalKnob: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 12,
  },
  modalOrderSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 4,
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 12,
  },
  payMethodButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  payMethodIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  payMethodText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 12,
  },
  cancelPayButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginTop: 4,
  },
  cancelPayText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ef4444",
  },
});
