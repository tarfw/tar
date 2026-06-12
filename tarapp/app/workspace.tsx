import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { getSelfId, routeDbForEntity, isCollabSyncEnabled, cachedSelfId, CLOUDFLARE_WORKER_URL } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";
import { OPCODE_LABELS } from "../lib/domainsData";
import { getCurrentUser, UserProfile } from "../lib/auth";

// Row shapes matching the real SQLite columns (schema.ts) — not the
// sample-display interfaces in domainsData.ts.
interface CustomerRow {
  id: string;
  code: string | null;
  type?: string;
  title: string;
  owner: string | null;
  data: string | null;
  time: string;
}

interface CrmMassRow {
  id: string;
  matter: string;
  type: string;
  qty: number | null;
  value: number | null;
  active: number;
  geo?: string | null;
  start: string | null;
  end: string | null;
  data: string | null;
  time: string;
}

interface CrmMotionRow {
  id: string;
  stream: string;
  seq: number;
  action: number;
  status: string | null;
  delta: number | null;
  data: string | null;
  time: string;
}

// Task = matter (type 'task') + relation (customer → task) + mass slot (due window)
interface TaskRow {
  id: string;
  title: string;
  data: string | null;
  time: string;
  mass_id: string | null;
  active: number | null;
  start: string | null;
  end: string | null;
}

// Note = matter (type 'note') + relation (customer → note)
interface NoteRow {
  id: string;
  title: string;
  data: string | null;
  time: string;
}

type SheetKind = "customer" | "lead" | "ticket" | "task" | "note" | "review" | "slot" | "stock" | "trip" | "driver" | "transfer" | "budget" | "expense" | "invoice" | "product" | "variant" | "modifier" | "publish" | null;

// Microsoft To Do (Fluent) palette
const ACCENT = "#2564cf";
const TEXT_PRIMARY = "#292827";
const TEXT_SECONDARY = "#605e5c";
const TEXT_TERTIARY = "#a19f9d";
const DIVIDER = "#edebe9";
const DANGER = "#a80000";

const PRIORITIES = ["low", "medium", "high"];
const LEAD_SOURCES = ["referral", "web", "walk_in", "campaign"];

// Maps legacy status strings to their phase integer opcode. Shared by
// appendMotion / phaseUpdateMotion — status itself is not persisted.
const PHASE_MAP: Record<string, number> = {
  "DISPATCHED": 401,
  "IN_TRANSIT": 402,
  "DRIVER_ASSIGNED": 403,
  "ETA_UPDATED": 404,
  "TRANSFER_OUT": 405,
  "TRANSFER_IN": 406,
  "RETURN_REQUESTED": 407,
  "DELIVERED": 109,
  "ATTEMPT_FAILED": 410,
  "NEW_LEAD": 303,
  "CONTACTED": 304,
  "CONVERTED": 305,
  "CLOSED": 303,
  "OPEN": 306,
  "REPLIED": 307,
  "RESOLVED": 308,
  "COMPLETED": 308,
  "VISITED": 301,
  "OFFER_SENT": 309,
  "REVIEWED": 302,
  "PAY_INIT": 801,
  "PAY_SUCCESS": 802,
  "PAY_FAILED": 805,
};

function parseData(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  } catch (_) {
    return iso;
  }
}

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 8)}`;
}

// Flat MS-To-Do style section header with a monospace hint of which Tar tables back it.
function SectionHeader({ title, tables }: { title: string; tables: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionTables}>{tables}</Text>
    </View>
  );
}

// MS To Do "+ Add a ..." row
function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.addRow} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name="add" size={20} color={ACCENT} />
      <Text style={styles.addRowText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Expandable raw-row view: shows exactly which table a record lives in and
// its column → value pairs, row-wise.
function RowData({ rows }: { rows: { table: string; cols: [string, any][] }[] }) {
  return (
    <View style={styles.rowDataPanel}>
      {rows.map((r, i) => (
        <View key={i} style={[styles.rowDataTable, i > 0 && { marginTop: 8 }]}>
          <Text style={styles.rowDataTableName}>▸ {r.table}</Text>
          {r.cols.map(([col, val]) => (
            <View key={col} style={styles.rowDataLine}>
              <Text style={styles.rowDataCol}>{col}</Text>
              <Text style={styles.rowDataVal} numberOfLines={2}>{val === null || val === undefined || val === "" ? "NULL" : String(val)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// MS To Do round check circle
function CheckCircle({ done, color = ACCENT }: { done: boolean; color?: string }) {
  return done ? (
    <View style={[styles.checkCircle, { backgroundColor: color, borderColor: color }]}>
      <Ionicons name="checkmark" size={13} color="white" />
    </View>
  ) : (
    <View style={[styles.checkCircle, { borderColor: TEXT_TERTIARY }]} />
  );
}

export default function WorkspaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entityId } = useLocalSearchParams<{ entityId?: string }>();

  const [selfId, setSelfId] = useState<string | null>(cachedSelfId);
  const scope = selfId ? `c:${selfId}` : null;

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const selectedCustomerRef = useRef<CustomerRow | null>(selectedCustomer);
  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leads, setLeads] = useState<CrmMassRow[]>([]);
  const [tickets, setTickets] = useState<CrmMassRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<CrmMassRow[]>([]);
  const [stocks, setStocks] = useState<CrmMassRow[]>([]);
  const [trips, setTrips] = useState<CrmMassRow[]>([]);
  const [budgets, setBudgets] = useState<CrmMassRow[]>([]);
  const [invoices, setInvoices] = useState<CrmMassRow[]>([]);
  const [timeline, setTimeline] = useState<CrmMotionRow[]>([]);
  // Product entity state
  const [variants, setVariants] = useState<CrmMassRow[]>([]);
  const [modifiers, setModifiers] = useState<CrmMassRow[]>([]);
  const [publishedProfiles, setPublishedProfiles] = useState<CustomerRow[]>([]);
  const [publishedProducts, setPublishedProducts] = useState<CustomerRow[]>([]);
  // Derived per-stream state (plan2.md): stage/source/subject come from the
  // motion ledger — single source of truth, no mass.data mirror.
  const [streamInfo, setStreamInfo] = useState<Record<string, { stage: string; source?: string; note?: string; subject?: string; desc?: string }>>({});

  // Bottom sheet drawer state — one drawer, multiple kinds
  const [sheet, setSheet] = useState<SheetKind>(null);

  // Finance form states
  const [budgetName, setBudgetName] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Supplies");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [selectedBudgetPool, setSelectedBudgetPool] = useState<CrmMassRow | null>(null);

  // Entity / Customer form
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("customer");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Lead form
  const [leadValue, setLeadValue] = useState("");
  const [leadSource, setLeadSource] = useState("referral");
  const [leadCloseDays, setLeadCloseDays] = useState("");
  const [leadNote, setLeadNote] = useState("");

  // Ticket form
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");
  const [ticketSlaHours, setTicketSlaHours] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");

  // Task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDays, setTaskDueDays] = useState("");

  // Note form
  const [noteText, setNoteText] = useState("");

  // Schedule slot form
  const [slotTitle, setSlotTitle] = useState("");
  const [slotDuration, setSlotDuration] = useState("");

  // Review (302) form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Stock form (SCM)
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockVal, setStockVal] = useState("");

  // Product form
  const [productTitle, setProductTitle] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productBasePrice, setProductBasePrice] = useState("");
  const [productCat, setProductCat] = useState("retail");

  // Variant form
  const [variantLabel, setVariantLabel] = useState("");
  const [variantQty, setVariantQty] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [editingVariant, setEditingVariant] = useState<CrmMassRow | null>(null);

  // Modifier form
  const [modifierTitle, setModifierTitle] = useState("");
  const [modifierPrice, setModifierPrice] = useState("");

  // Publish form
  const [publishTargetId, setPublishTargetId] = useState("");

  // Trip form (SCM)
  const [tripRef, setTripRef] = useState("");
  const [tripQty, setTripQty] = useState("");
  const [tripGeo, setTripGeo] = useState("833075fffffffff");
  const [tripDriver, setTripDriver] = useState("");
  const [driverTripId, setDriverTripId] = useState<string | null>(null);

  // Transfer states
  const [transferStock, setTransferStock] = useState<CrmMassRow | null>(null);
  const [transferDirection, setTransferDirection] = useState<"in" | "out">("in");
  const [transferQty, setTransferQty] = useState("10");
  const [transferStorefront, setTransferStorefront] = useState("");

  // Ticket reply inline input
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Which row's raw DB data is expanded
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);

  const toggleRowData = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const getDb = useCallback((customerId?: string) => {
    const activeId = customerId || selectedCustomerRef.current?.id;
    if (activeId === "general_personal") {
      return routeDbForEntity("task", "p");
    }
    return routeDbForEntity("customer", scope || "c:guest");
  }, [scope]);

  const loadCustomers = useCallback(async (activeScope: string) => {
    try {
      const db = routeDbForEntity("customer", activeScope);
      const rows = await db.all(
        "SELECT id, code, type, title, owner, data, time FROM matter WHERE type IN ('customer', 'business', 'person', 'family', 'warehouse', 'carrier', 'vehicle', 'finance', 'product', 'profile') AND scope = ? ORDER BY time DESC",
        [activeScope]
      );
      setCustomers((rows as any[]) || []);
    } catch (e) {
      console.warn("[CRM] Failed to load workspace directory:", e);
    }
  }, []);

  const loadCustomerDetail = useCallback(async (customerId: string, typeVal: string) => {
    try {
      const db = getDb(customerId);
      
      // All reads below are independent of one another, so fire them
      // concurrently and await the batch once. Type-gated queries resolve to
      // an empty array when not applicable, preserving the original behavior.
      const isLeadTicket = typeVal === "customer" || typeVal === "business" || typeVal === "vehicle" || typeVal === "product" || typeVal === "profile";
      const isPersonFamily = typeVal === "person" || typeVal === "family";
      const isPersonal = customerId === "general_personal";
      const personalScope = scope || "c:guest";
      const NONE = Promise.resolve([] as any[]);

      const [
        leadRows,
        ticketRows,
        slotRows,
        stockRows,
        tripRows,
        budgetRows,
        invoiceRows,
        variantRows,
        modifierRows,
        profileRows,
        publishedProductRows,
        taskRows,
        noteRows,
        motionRowsRaw,
        infoRows,
      ] = await Promise.all([
        // Leads & Tickets (Customer/Business/Vehicle/Product/Profile)
        isLeadTicket ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'lead' AND active = 1 ORDER BY time DESC",
          [customerId]
        ) : NONE,
        isLeadTicket ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'ticket' AND active = 1 ORDER BY time DESC",
          [customerId]
        ) : NONE,
        // Schedule Slots (Team/Family)
        isPersonFamily ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'slot' ORDER BY start DESC",
          [customerId]
        ) : NONE,
        // Warehouse Inventory Stocks
        typeVal === "warehouse" ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'stock' ORDER BY time DESC",
          [customerId]
        ) : NONE,
        // Carrier/Vehicle Trips
        (typeVal === "carrier" || typeVal === "vehicle") ? db.all(
          "SELECT id, matter, type, qty, value, active, geo, start, end, data, time FROM mass WHERE matter = ? AND type = 'trip' ORDER BY start DESC",
          [customerId]
        ) : NONE,
        // Finance Budgets & Invoices
        typeVal === "finance" ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'budget' ORDER BY time DESC",
          [customerId]
        ) : NONE,
        typeVal === "finance" ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'invoice' ORDER BY time DESC",
          [customerId]
        ) : NONE,
        // Product Variants & Modifiers / Published Profiles
        typeVal === "product" ? db.all(
          "SELECT id, matter, type, qty, value, active, start, end, data, time FROM mass WHERE matter = ? AND type = 'variant' ORDER BY time ASC",
          [customerId]
        ) : NONE,
        typeVal === "product" ? db.all(
          `SELECT ms.id, ms.matter, ms.type, ms.qty, ms.value, ms.active, ms.start, ms.end, ms.data, ms.time
           FROM mass ms
           JOIN relation r ON r.tgt = ms.matter AND r.src = ? AND r.type = 'modifier_of'
           WHERE ms.type = 'modifier'`,
          [customerId]
        ) : NONE,
        typeVal === "product" ? db.all(
          `SELECT m.id, m.code, m.type, m.title, m.owner, m.data, m.time
           FROM matter m
           JOIN relation r ON r.tgt = m.id AND r.src = ? AND r.type = 'published_to'`,
          [customerId]
        ) : NONE,
        // Profile Storefront — published products
        typeVal === "profile" ? db.all(
          `SELECT m.id, m.code, m.type, m.title, m.owner, m.data, m.time
           FROM matter m
           JOIN relation r ON r.src = m.id AND r.tgt = ? AND r.type = 'published_to'`,
          [customerId]
        ) : NONE,
        // Tasks
        isPersonal ? db.all(
          `SELECT m.id, m.title, m.data, m.time, ms.id AS mass_id, ms.active, ms.start, ms.end
           FROM matter m
           LEFT JOIN mass ms ON ms.matter = m.id AND ms.type = 'slot'
           WHERE m.type = 'task' AND m.scope = ?
             AND m.id NOT IN (SELECT tgt FROM relation WHERE type = 'task')
           ORDER BY ms.active DESC, m.time DESC`,
          [personalScope]
        ) : db.all(
          `SELECT m.id, m.title, m.data, m.time, ms.id AS mass_id, ms.active, ms.start, ms.end
           FROM matter m
           JOIN relation r ON r.tgt = m.id AND r.src = ? AND r.type = 'task'
           LEFT JOIN mass ms ON ms.matter = m.id AND ms.type = 'slot'
           WHERE m.type = 'task'
           ORDER BY ms.active DESC, m.time DESC`,
          [customerId]
        ),
        // Notes
        isPersonal ? db.all(
          `SELECT m.id, m.title, m.data, m.time
           FROM matter m
           WHERE m.type = 'note' AND m.scope = ?
             AND m.id NOT IN (SELECT tgt FROM relation WHERE type = 'note')
           ORDER BY m.time DESC`,
          [personalScope]
        ) : db.all(
          `SELECT m.id, m.title, m.data, m.time
           FROM matter m
           JOIN relation r ON r.tgt = m.id AND r.src = ? AND r.type = 'note'
           WHERE m.type = 'note'
           ORDER BY m.time DESC`,
          [customerId]
        ),
        // Timeline (Activity ledger)
        isPersonal ? db.all(
          `SELECT stream, seq, action, phase, delta, data FROM motion
           ORDER BY seq DESC LIMIT 100`
        ) : db.all(
          `SELECT stream, seq, action, phase, delta, data FROM motion
           WHERE stream = ?
              OR stream IN (SELECT id FROM mass WHERE matter = ?)
              OR stream IN (SELECT tgt FROM relation WHERE src = ?)
              OR stream IN (SELECT id FROM mass WHERE matter IN (SELECT tgt FROM relation WHERE src = ?))
           ORDER BY seq DESC LIMIT 100`,
          [customerId, customerId, customerId, customerId]
        ),
        // Derived per-stream state source rows
        db.all(
          `SELECT stream, seq, action, data FROM motion
           WHERE stream IN (SELECT id FROM mass WHERE matter = ?)
           ORDER BY seq ASC`,
          [customerId]
        ),
      ]);

      // Map back to CrmMotionRow structure to keep UI code intact
      const deriveTimeFromSeq = (seq: number) => {
        let ms = seq;
        if (seq > 1000000000000000) ms = Math.floor(seq / 1000);
        else if (seq < 1000000000000) ms = seq * 1000;
        return new Date(ms).toISOString();
      };

      const motionRows = motionRowsRaw.map((r: any) => {
        // Status is the opcode — derive the label from phase/action, never from data.
        const statusStr = OPCODE_LABELS[r.phase] || OPCODE_LABELS[r.action] || String(r.phase || r.action);

        return {
          id: `${r.stream}_${r.seq}`,
          stream: r.stream,
          seq: r.seq,
          action: r.action,
          status: statusStr,
          delta: r.delta,
          data: r.data,
          time: deriveTimeFromSeq(r.seq)
        };
      });

      // Derive current state (infoRows fetched in the batch above)
      const info: Record<string, { stage: string; source?: string; note?: string; subject?: string; desc?: string }> = {};
      ((infoRows as any[]) || []).forEach((m) => {
        const e = info[m.stream] || (info[m.stream] = { stage: "new" });
        const d = parseData(m.data);
        if (m.action === 303 && d.source !== undefined) { e.source = d.source; e.note = d.note; }
        else if (m.action === 304) e.stage = "contacted";
        else if (m.action === 305) e.stage = "converted";
        else if (m.action === 306) { e.subject = d.subject; e.desc = d.desc; }
        else if (m.action === 401) { e.stage = "dispatched"; e.desc = d.ref ? `Dispatched: ${d.ref}` : "Dispatched"; }
        else if (m.action === 402) { e.stage = "in_transit"; e.desc = d.driver ? `In Transit via ${d.driver}` : "In Transit"; }
        else if (m.action === 403) { e.desc = d.driverName ? `Driver Assigned: ${d.driverName}` : "Driver Assigned"; }
        else if (m.action === 404) { e.desc = d.eta_minutes ? `ETA: +${d.eta_minutes} mins` : "ETA updated"; }
        else if (m.action === 405) { e.stage = "transfer_out"; e.desc = d.dest ? `To: ${d.dest}` : "Stock Transfer Out"; }
        else if (m.action === 406) { e.stage = "transfer_in"; e.desc = d.src ? `From: ${d.src}` : "Stock Transfer In"; }
        else if (m.action === 407) { e.stage = "returned"; e.desc = d.reason ? `Returned: ${d.reason}` : "Returned"; }
        else if (m.action === 410) { e.stage = "attempt_failed"; e.desc = d.reason ? `Attempt Failed: ${d.reason}` : "Delivery Attempt Failed"; }
        else if (m.action === 109) { e.stage = "delivered"; e.desc = "Delivered successfully"; }
      });
      setStreamInfo(info);
      setLeads((leadRows as any[]) || []);
      setTickets((ticketRows as any[]) || []);
      setTasks((taskRows as any[]) || []);
      setNotes((noteRows as any[]) || []);
      setScheduleSlots((slotRows as any[]) || []);
      setStocks((stockRows as any[]) || []);
      setTrips((tripRows as any[]) || []);
      setBudgets((budgetRows as any[]) || []);
      setInvoices((invoiceRows as any[]) || []);
      setTimeline((motionRows as any[]) || []);
      setVariants((variantRows as any[]) || []);
      setModifiers((modifierRows as any[]) || []);
      setPublishedProfiles((profileRows as any[]) || []);
      setPublishedProducts((publishedProductRows as any[]) || []);
    } catch (e) {
      console.warn("[CRM] Failed to load customer detail:", e);
    }
  }, [getDb, scope]);
  useEffect(() => {
    async function boot() {
      const id = await getSelfId();
      setSelfId(id);
      setSyncEnabled(await isCollabSyncEnabled());
      await loadCustomers(`c:${id}`);
      try {
        const user = await getCurrentUser();
        setUserProfile(user);
      } catch (e) {
        console.warn("Failed to load user profile in Workspace:", e);
      }
    }
    if (cachedSelfId) {
      loadCustomers(`c:${cachedSelfId}`);
    }
    boot();
  }, [loadCustomers]);

  useEffect(() => {
    const activeEntityId = entityId || "general_personal";
    if (activeEntityId === "general_personal") {
      const expectedTitle = userProfile?.name || "General / Personal";
      if (selectedCustomer?.id !== "general_personal" || selectedCustomer?.title !== expectedTitle) {
        const personalCust = {
          id: "general_personal",
          code: "personal",
          type: "personal",
          title: expectedTitle,
          owner: selfId || "guest",
          data: null,
          time: new Date().toISOString()
        };
        setSelectedCustomer(personalCust);
      }
      loadCustomerDetail("general_personal", "personal");
    } else {
      const found = customers.find(c => c.id === activeEntityId);
      if (found) {
        if (selectedCustomer?.id !== found.id) {
          setSelectedCustomer(found);
        }
        loadCustomerDetail(found.id, found.type || "customer");
      } else {
        // Fallback: Query the database directly for this specific entity!
        // This is robust and prevents the "No Entity Selected" bug when transitioning screens!
        async function fetchSingleEntity() {
          try {
            const db = routeDbForEntity("customer", scope || `c:${cachedSelfId || "guest"}`);
            const rows = await db.all("SELECT id, code, type, title, owner, data, time FROM matter WHERE id = ?", [activeEntityId]);
            if (rows && rows.length > 0) {
              const entity = rows[0] as any as CustomerRow;
              if (selectedCustomer?.id !== entity.id) {
                setSelectedCustomer(entity);
              }
              loadCustomerDetail(entity.id, entity.type || "customer");
            }
          } catch (e) {
            console.warn("Failed to fetch single entity on fallback:", e);
          }
        }
        fetchSingleEntity();
      }
    }
  }, [entityId, customers, selfId, scope, loadCustomerDetail, selectedCustomer, userProfile]);

  const pushIfEnabled = async (db: any) => {
    if (await isCollabSyncEnabled()) {
      await db.push().catch((err: any) => console.warn("[CRM] Sync push failed:", err));
    }
  };

  // Append a motion row to a stream with monotonic seq.
  const appendMotion = async (db: any, stream: string, action: number, status: string, delta: number | null, data: Record<string, any>) => {
    const phase = PHASE_MAP[status] || action;
    const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [stream]);
    const nextSeq = seqRow[0]?.next_seq || (Date.now() * 1000);

    // Status is conveyed by the action/phase opcodes — data carries only payload.
    await db.run(
      "INSERT INTO motion (stream, seq, action, phase, delta, data) VALUES (?, ?, ?, ?, ?, ?)",
      [stream, nextSeq, action, phase, delta, JSON.stringify(data)]
    );
  };

  // Update the phase column and phase history of an existing motion stream in-place (plan.md).
  const phaseUpdateMotion = async (db: any, stream: string, action: number, status: string, delta: number | null, data: Record<string, any>) => {
    // Find the initial sequence record for this stream to update in-place
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

      // Keep phase transition history timestamps (ph) inside the JSON data field
      const ph = dataObj.ph || {};
      ph[String(phase)] = Date.now();

      // Status is conveyed by the action/phase opcodes — data carries only payload.
      const updatedData = {
        ...dataObj,
        ...data,
        ph
      };

      await db.run(
        "UPDATE motion SET phase = ?, action = ?, delta = COALESCE(?, delta), data = ? WHERE stream = ? AND seq = ?",
        [phase, action, delta, JSON.stringify(updatedData), stream, targetSeq]
      );
    } else {
      // Fallback to append if no root row exists for the stream
      await appendMotion(db, stream, action, status, delta, data);
    }
  };

  // Link two entities in the relation graph (customer → child).
  const addRelation = async (db: any, src: string, tgt: string, type: string) => {
    await db.run(
      "INSERT OR REPLACE INTO relation (src, tgt, type, weight, time) VALUES (?, ?, ?, 1.0, ?)",
      [src, tgt, type, new Date().toISOString()]
    );
  };

  const runMutation = async (fn: () => Promise<void>) => {
    if (busy || !scope) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Operation failed.");
    } finally {
      setBusy(false);
    }
  };

  const openSheet = (kind: SheetKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheet(kind);
  };

  // ---- Customers (matter CRUD) ----

  const openCustomerSheet = (customer?: CustomerRow) => {
    if (customer) {
      const d = parseData(customer.data);
      setEditingCustomerId(customer.id);
      setCustName(customer.title || "");
      setCustEmail(customer.code || d.email || "");
      setCustPhone(d.phone || "");
      setEntityType(customer.type || "customer");
    } else {
      setEditingCustomerId(null);
      setCustName("");
      setCustEmail("");
      setCustPhone("");
      setEntityType("customer");
    }
    openSheet("customer");
  };

  const saveCustomer = () => runMutation(async () => {
    const name = custName.trim();
    if (!name) {
      Alert.alert("Validation Error", "Please enter a name.");
      return;
    }
    const db = getDb();
    const id = editingCustomerId || rid(
      entityType === "person" ? "usr" : 
      entityType === "family" ? "fam" : 
      entityType === "business" ? "biz" : 
      entityType === "warehouse" ? "wh" :
      entityType === "carrier" ? "carrier" :
      entityType === "vehicle" ? "veh" :
      entityType === "finance" ? "fin" :
      entityType === "product" ? "prod" :
      entityType === "profile" ? "prof" :
      "cust"
    );
    const isWarehouse = entityType === "warehouse";
    const isCarrier = entityType === "carrier";
    const isVehicle = entityType === "vehicle";
    const isFinance = entityType === "finance";
    const dataJson = JSON.stringify({ 
      email: custEmail.trim(), 
      phone: custPhone.trim(),
      ...(isWarehouse ? { capacity: 10000, dock_count: 4 } : {}),
      ...(isCarrier ? { tier: "ground", vehicle_types: ["Van"] } : {}),
      ...(isVehicle ? { fuel_type: "hybrid", status: "active" } : {}),
      ...(isFinance ? { currency: "USD", status: "active" } : {}),
      ...(entityType === "product" ? { cat: "retail", base_price: 0 } : {}),
      ...(entityType === "profile" ? { cat: "store", cur: "USD" } : {})
    });
    const timeStr = new Date().toISOString();
    const existing = await db.all("SELECT title, code, type, scope, owner, data FROM matter WHERE id = ?", [id]);
    const isNew = existing.length === 0;
    const hasChanged = isNew || 
      existing[0].title !== name || 
      existing[0].code !== (custEmail.trim() || null) || 
      existing[0].type !== entityType || 
      existing[0].scope !== scope || 
      existing[0].owner !== selfId || 
      existing[0].data !== dataJson;

    if (hasChanged) {
      await db.run(
        `INSERT INTO matter (id, code, type, scope, owner, title, public, data, time) 
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET 
           code = excluded.code,
           type = excluded.type,
           scope = excluded.scope,
           owner = excluded.owner,
           title = excluded.title,
           data = excluded.data,
           time = excluded.time`,
        [id, custEmail.trim() || null, entityType, scope, selfId, name, dataJson, timeStr]
      );
      try {
        await upsertMatterVector(id, { title: name, type: entityType, scope, code: custEmail.trim() || null, data: dataJson });
      } catch (vErr) {
        console.warn("[CRM] Vector sync failed:", vErr);
      }
    }
    await pushIfEnabled(db);
    setSheet(null);
    await loadCustomers(scope!);
    if (selectedCustomer?.id === id) {
      setSelectedCustomer({ ...selectedCustomer, type: entityType, title: name, code: custEmail.trim() || null, data: dataJson });
    }
  });

  const selectCustomer = async (customer: CustomerRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
      return;
    }
    setSelectedCustomer(customer);
    setReplyTicketId(null);
    const t = customer.id === "general_personal" ? "personal" : (customer.type || "customer");
    await loadCustomerDetail(customer.id, t);
  };

  const startStockTransfer = (stock: CrmMassRow, direction: "in" | "out") => {
    setTransferStock(stock);
    setTransferDirection(direction);
    setTransferQty("10");
    setTransferStorefront("");
    openSheet("transfer");
  };

  const confirmStockTransfer = () => {
    if (!selectedCustomer || !transferStock) return;
    const qtyChange = Number(transferQty);
    if (isNaN(qtyChange) || qtyChange <= 0) {
      Alert.alert("Validation Error", "Please enter a valid quantity.");
      return;
    }
    const finalChange = transferDirection === "in" ? qtyChange : -qtyChange;
    const newQty = Math.max(0, (transferStock.qty || 0) + finalChange);

    runMutation(async () => {
      const db = getDb();
      
      // -- Part 4: Warehouse Capacity Constraints check --
      if (transferDirection === "in") {
        // Calculate sum of all stock quantities in this warehouse
        const stocksResult = await db.all("SELECT SUM(qty) AS total_qty FROM mass WHERE matter = ? AND type = 'stock'", [selectedCustomer.id]);
        const currentTotal = Number(stocksResult[0]?.total_qty || 0);
        // Find capacity from warehouse matter data
        const whRows = await db.all("SELECT data FROM matter WHERE id = ?", [selectedCustomer.id]);
        let capacity = 10000;
        if (whRows && whRows[0]) {
          const parsedWh = parseData(whRows[0].data as string | null);
          if (parsedWh && typeof parsedWh.capacity === "number") {
            capacity = parsedWh.capacity;
          }
        }
        // Exclude the old quantity of this specific stock when calculating new total
        const newTotal = currentTotal - (transferStock.qty || 0) + newQty;
        if (newTotal > capacity) {
          Alert.alert(
            "Capacity Exceeded",
            `Cannot complete transfer. Total inventory quantity (${newTotal}) would exceed the warehouse capacity limit of ${capacity}.`
          );
          return;
        }
      }

      await db.run("UPDATE mass SET qty = ? WHERE id = ?", [newQty, transferStock.id]);
      
      const action = transferDirection === "in" ? 406 : 405;
      const actionLabel = transferDirection === "in" ? "TRANSFER_IN" : "TRANSFER_OUT";
      
      // Store the storefront information in motion data
      const storefrontName = customers.find(c => c.id === transferStorefront)?.title || "";
      const motionData = {
        dest: transferDirection === "out" ? storefrontName : undefined,
        src: transferDirection === "in" ? storefrontName : undefined,
        storefrontId: transferStorefront || undefined,
        qty: qtyChange
      };
      
      await appendMotion(db, transferStock.id, action, actionLabel, finalChange, motionData);

      // Write relation if storefront is selected
      if (transferStorefront) {
        await addRelation(db, transferStock.id, transferStorefront, "storefront_transfer");
      }
      
      await pushIfEnabled(db);
      setSheet(null);
      setTransferStock(null);
      setTransferStorefront("");
      await loadCustomerDetail(selectedCustomer!.id, "warehouse");
    });
  };

  const advanceTrip = (trip: CrmMassRow) => {
    if (!selectedCustomer) return;
    const info = streamInfo[trip.id] || { stage: "dispatched" };
    const stage = info.stage;
    if (stage === "delivered" || stage === "returned") return;
    
    runMutation(async () => {
      const db = getDb();
      if (stage === "dispatched" || stage === "new" || stage === "attempt_failed") {
        const d = parseData(trip.data);
        const driverName = d.driver || "Unassigned";
        await phaseUpdateMotion(db, trip.id, 402, "IN_TRANSIT", null, { driver: driverName });
      } else if (stage === "in_transit") {
        await phaseUpdateMotion(db, trip.id, 109, "DELIVERED", null, {});
        await db.run("UPDATE mass SET active = 0 WHERE id = ?", [trip.id]);
      }
      await pushIfEnabled(db);
      await loadCustomerDetail(selectedCustomer!.id, selectedCustomer!.type || "");
    });
  };

  const logDeliveryAttempt = (trip: CrmMassRow) => {
    if (!selectedCustomer) return;
    Alert.alert(
      "Failed Delivery Attempt",
      "Log failed attempt reason? (Customer not home)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Fail",
          onPress: () => runMutation(async () => {
            const db = getDb();
            await phaseUpdateMotion(db, trip.id, 410, "ATTEMPT_FAILED", null, { reason: "Customer not home / no answer" });
            await pushIfEnabled(db);
            await loadCustomerDetail(selectedCustomer!.id, selectedCustomer!.type || "");
          })
        }
      ]
    );
  };

  const logReturnRequest = (trip: CrmMassRow) => {
    if (!selectedCustomer) return;
    Alert.alert(
      "Return Request",
      "Log return/refusal request and close delivery trip?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Return",
          onPress: () => runMutation(async () => {
            const db = getDb();
            const timeStr = new Date().toISOString();
            await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [timeStr, trip.id]);
            await phaseUpdateMotion(db, trip.id, 407, "RETURN_REQUESTED", null, { reason: "Customer refused shipment" });
            await pushIfEnabled(db);
            await loadCustomerDetail(selectedCustomer!.id, selectedCustomer!.type || "");
          })
        }
      ]
    );
  };

  const updateTripEta = (trip: CrmMassRow) => {
    if (!selectedCustomer) return;
    Alert.alert(
      "Update ETA",
      "Add 15 minutes delay to this trip's ETA?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "+15 Mins",
          onPress: () => runMutation(async () => {
            const db = getDb();
            await phaseUpdateMotion(db, trip.id, 404, "ETA_UPDATED", 15, { eta_minutes: 15 });
            await pushIfEnabled(db);
            await loadCustomerDetail(selectedCustomer!.id, selectedCustomer!.type || "");
          })
        }
      ]
    );
  };

  const createStock = () => {
    if (!selectedCustomer) return;
    const name = stockName.trim();
    if (!name) {
      Alert.alert("Validation Error", "Please enter stock SKU/name.");
      return;
    }
    const qtyVal = Number(stockQty) || 0;
    const valVal = Number(stockVal) || 0;
    if (qtyVal < 0) {
      Alert.alert("Validation Error", "Initial quantity cannot be negative.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      
      // Calculate capacity check
      const stocksResult = await db.all("SELECT SUM(qty) AS total_qty FROM mass WHERE matter = ? AND type = 'stock'", [selectedCustomer.id]);
      const currentTotal = Number(stocksResult[0]?.total_qty || 0);
      // Get capacity from selectedCustomer.data
      const whRows = await db.all("SELECT data FROM matter WHERE id = ?", [selectedCustomer.id]);
      let capacity = 10000;
      if (whRows && whRows[0]) {
        const parsedWh = parseData(whRows[0].data as string | null);
        if (parsedWh && typeof parsedWh.capacity === "number") {
          capacity = parsedWh.capacity;
        }
      }
      const newTotal = currentTotal + qtyVal;
      if (newTotal > capacity) {
        Alert.alert(
          "Capacity Exceeded",
          `Cannot add stock item. Total inventory quantity (${newTotal}) would exceed the warehouse capacity limit of ${capacity}.`
        );
        return;
      }

      const stockId = rid("stock");
      const now = new Date();
      const timeStr = now.toISOString();
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'stock', ?, ?, ?, 1, ?, NULL, ?, ?)",
        [stockId, selectedCustomer.id, scope, qtyVal, valVal, timeStr, JSON.stringify({ name }), timeStr]
      );
      await appendMotion(db, stockId, 406, "TRANSFER_IN", qtyVal, { src: "vendor" });
      await pushIfEnabled(db);
      setStockName(""); setStockQty(""); setStockVal("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, "warehouse");
    });
  };

  const createTrip = () => {
    if (!selectedCustomer) return;
    const ref = tripRef.trim();
    if (!ref) {
      Alert.alert("Validation Error", "Please enter trip details/ref.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      const tripId = rid("trip");
      const qtyVal = Number(tripQty) || 1;
      const now = new Date();
      const timeStr = now.toISOString();
      const driverName = customers.find(c => c.id === tripDriver)?.title || "Unassigned";
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, geo, start, end, data, time) VALUES (?, ?, 'trip', ?, ?, 0, 1, ?, ?, NULL, ?, ?)",
        [tripId, selectedCustomer.id, scope, qtyVal, tripGeo, timeStr, JSON.stringify({ ref, driver: driverName, driverId: tripDriver || null }), timeStr]
      );
      await appendMotion(db, tripId, 401, "DISPATCHED", null, { ref });
      if (tripDriver) {
        await phaseUpdateMotion(db, tripId, 403, "DRIVER_ASSIGNED", null, { driverId: tripDriver, driverName });
      }
      await pushIfEnabled(db);
      setTripRef(""); setTripQty(""); setTripGeo("833075fffffffff"); setTripDriver("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };


  // ---- Product Catalog (matter type=product) ----

  const createProduct = () => {
    const title = productTitle.trim();
    if (!title) { Alert.alert("Validation Error", "Please enter a product title."); return; }
    runMutation(async () => {
      const db = getDb();
      const productId = rid("prod");
      const timeStr = new Date().toISOString();
      const dataJson = JSON.stringify({ cat: productCat, base_price: Number(productBasePrice) || 0 });
      await db.run(
        "INSERT INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, 'product', ?, ?, ?, 1, ?, ?)",
        [productId, productCode.trim() || null, scope, selfId, title, dataJson, timeStr]
      );
      await pushIfEnabled(db);
      setProductTitle(""); setProductCode(""); setProductBasePrice(""); setProductCat("retail");
      setSheet(null);
      await loadCustomers(scope!);
    });
  };

  // ---- Variant Inventory (mass type=variant) ----

  const createVariant = () => {
    if (!selectedCustomer) return;
    const label = variantLabel.trim();
    if (!label) { Alert.alert("Validation Error", "Please enter a variant label."); return; }
    const qtyVal = Number(variantQty) || 0;
    const priceVal = Number(variantPrice) || 0;
    runMutation(async () => {
      const db = getDb();
      const variantId = rid("var");
      const timeStr = new Date().toISOString();
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, data, time) VALUES (?, ?, 'variant', ?, ?, ?, 1, ?, ?)",
        [variantId, selectedCustomer.id, scope, qtyVal, priceVal, JSON.stringify({ label }), timeStr]
      );
      await appendMotion(db, variantId, 406, "TRANSFER_IN", qtyVal, { src: "vendor" });
      await pushIfEnabled(db);
      setVariantLabel(""); setVariantQty(""); setVariantPrice("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, "product");
    });
  };

  const adjustVariantStock = (variant: CrmMassRow, direction: "in" | "out") => {
    if (!selectedCustomer) return;
    const qtyChange = direction === "in" ? 10 : -10;
    const newQty = Math.max(0, (variant.qty || 0) + qtyChange);
    runMutation(async () => {
      const db = getDb();
      await db.run("UPDATE mass SET qty = ? WHERE id = ?", [newQty, variant.id]);
      const action = direction === "in" ? 406 : 405;
      const status = direction === "in" ? "TRANSFER_IN" : "TRANSFER_OUT";
      await appendMotion(db, variant.id, action, status, qtyChange, {});
      await pushIfEnabled(db);
      await loadCustomerDetail(selectedCustomer.id, "product");
    });
  };

  // ---- Modifiers ----

  const createModifier = () => {
    if (!selectedCustomer) return;
    const title = modifierTitle.trim();
    if (!title) { Alert.alert("Validation Error", "Please enter a modifier name."); return; }
    const priceVal = Number(modifierPrice) || 0;
    runMutation(async () => {
      const db = getDb();
      const modId = rid("mod");
      const massId = rid("modprice");
      const timeStr = new Date().toISOString();
      await db.run(
        "INSERT INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, 'product', ?, ?, ?, 1, ?, ?)",
        [modId, null, scope, selfId, title, JSON.stringify({ mod: 1 }), timeStr]
      );
      await addRelation(db, selectedCustomer.id, modId, "modifier_of");
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, data, time) VALUES (?, ?, 'modifier', ?, NULL, ?, 1, ?, ?)",
        [massId, modId, scope, priceVal, JSON.stringify({ title }), timeStr]
      );
      await pushIfEnabled(db);
      setModifierTitle(""); setModifierPrice("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, "product");
    });
  };

  const deactivateModifier = (modifier: CrmMassRow) => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      await db.run("UPDATE mass SET active = 0 WHERE id = ?", [modifier.id]);
      await pushIfEnabled(db);
      await loadCustomerDetail(selectedCustomer.id, "product");
    });
  };

  // ---- Publish to Storefront ----

  const publishToProfile = () => {
    if (!selectedCustomer || !publishTargetId.trim()) {
      Alert.alert("Validation Error", "Please enter a storefront entity ID.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      await addRelation(db, selectedCustomer.id, publishTargetId.trim(), "published_to");
      await pushIfEnabled(db);
      setPublishTargetId("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, "product");
    });
  };

  const publishToMarketplace = async (matterId: string) => {
    runMutation(async () => {
      const db = getDb();
      
      // 1. Fetch Matter definition
      const matterRows = await db.all("SELECT * FROM matter WHERE id = ?", [matterId]);
      if (!matterRows || matterRows.length === 0) {
        throw new Error("Product matter definition not found locally.");
      }
      const matter = matterRows[0] as any;
      
      // 2. Fetch all active variant Mass rows
      const massRecords = await db.all(
        "SELECT * FROM mass WHERE matter = ? AND active = 1",
        [matterId]
      );

      // 3. POST payload to Worker
      const res = await fetch(`${CLOUDFLARE_WORKER_URL}/api/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selfId || "guest"}`,
        },
        body: JSON.stringify({
          matter: {
            ...matter,
            scope: "g",
            public: 1,
          },
          massRecords,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to publish product.");
      }

      Alert.alert("Published 🎉", "Product and variants are now live on the global marketplace.");
    });
  };

  const unpublishFromProfile = (targetId: string) => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      if (selectedCustomer.type === "profile") {
        await db.run("DELETE FROM relation WHERE src = ? AND tgt = ? AND type = 'published_to'", [targetId, selectedCustomer.id]);
        await pushIfEnabled(db);
        await loadCustomerDetail(selectedCustomer.id, "profile");
      } else {
        await db.run("DELETE FROM relation WHERE src = ? AND tgt = ? AND type = 'published_to'", [selectedCustomer.id, targetId]);
        await pushIfEnabled(db);
        await loadCustomerDetail(selectedCustomer.id, "product");
      }
    });
  };
  const openDriverSelector = (trip: CrmMassRow) => {
    setDriverTripId(trip.id);
    openSheet("driver");
  };

  const assignDriver = (driverId: string, driverName: string) => {
    if (!driverTripId || !selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      const rows = await db.all("SELECT data FROM mass WHERE id = ?", [driverTripId]);
      let existingData = {};
      if (rows && rows[0]) {
        existingData = parseData(rows[0].data as string | null);
      }
      const newData = JSON.stringify({ ...existingData, driver: driverName, driverId });
      await db.run("UPDATE mass SET data = ? WHERE id = ?", [newData, driverTripId]);
      await phaseUpdateMotion(db, driverTripId, 403, "DRIVER_ASSIGNED", null, { driverId, driverName });
      await pushIfEnabled(db);
      setSheet(null);
      setDriverTripId(null);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };

  // ---- Quick events (301 / 302 / 309 — stream = customer matter id) ----

  // ---- Quick events (301 / 302 / 309 — stream = customer matter id) ----

  const logQuickEvent = (action: number) => {
    if (!selectedCustomer) return;
    if (action === 302) {
      setReviewRating(5);
      setReviewComment("");
      openSheet("review");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      if (action === 301) {
        await appendMotion(db, selectedCustomer.id, 301, "VISITED", null, { store_id: "main_branch" });
      } else if (action === 309) {
        await appendMotion(db, selectedCustomer.id, 309, "OFFER_SENT", null, { offer: "10% birthday discount" });
      }
      await pushIfEnabled(db);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  const submitReview = () => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      await appendMotion(db, selectedCustomer.id, 302, "REVIEWED", reviewRating, {
        rating: reviewRating,
        comment: reviewComment.trim()
      });
      await pushIfEnabled(db);
      setSheet(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  // ---- Leads pipeline (mass + 303 → 304 → 305) ----

  const createLead = () => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      const leadId = rid("lead");
      const value = Number(leadValue) || 0;
      const now = new Date();
      const timeStr = now.toISOString();
      const closeDays = Number(leadCloseDays) || 0;
      const endStr = closeDays > 0 ? new Date(now.getTime() + closeDays * 86400000).toISOString() : null;
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'lead', ?, 1, ?, 1, ?, ?, NULL, ?)",
        [leadId, selectedCustomer.id, scope, value, timeStr, endStr, timeStr]
      );
      await appendMotion(db, leadId, 303, "NEW_LEAD", null, { source: leadSource, note: leadNote.trim() });
      await pushIfEnabled(db);
      setLeadValue(""); setLeadCloseDays(""); setLeadNote("");
      setSheet(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  const advanceLead = (lead: CrmMassRow) => {
    if (!selectedCustomer) return;
    const stage = streamInfo[lead.id]?.stage || "new";
    if (stage === "converted") return;
    runMutation(async () => {
      const db = getDb();
      if (stage === "new") {
        await phaseUpdateMotion(db, lead.id, 304, "CONTACTED", null, { channel: "email" });
      } else if (stage === "contacted") {
        await phaseUpdateMotion(db, lead.id, 305, "CONVERTED", lead.value, {});
      }
      await pushIfEnabled(db);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  const closeLead = (lead: CrmMassRow) => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      const timeStr = new Date().toISOString();
      await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [timeStr, lead.id]);
      await appendMotion(db, lead.id, 303, "CLOSED", null, { reason: "deleted" });
      await pushIfEnabled(db);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  // ---- Support tickets (mass + 306 → 307 → 308) ----

  const createTicket = () => {
    if (!selectedCustomer) return;
    const subject = ticketSubject.trim();
    if (!subject) {
      Alert.alert("Validation Error", "Please enter a ticket subject.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      const ticketId = rid("tkt");
      const now = new Date();
      const timeStr = now.toISOString();
      const slaHours = Number(ticketSlaHours) || 0;
      const endStr = slaHours > 0 ? new Date(now.getTime() + slaHours * 3600000).toISOString() : null;
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'ticket', ?, 1, 0, 1, ?, ?, ?, ?)",
        [ticketId, selectedCustomer.id, scope, timeStr, endStr, JSON.stringify({ priority: ticketPriority }), timeStr]
      );
      await appendMotion(db, ticketId, 306, "OPEN", 1, { subject, desc: ticketDesc.trim() });
      await pushIfEnabled(db);
      setTicketSubject(""); setTicketSlaHours(""); setTicketDesc("");
      setSheet(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  const submitReply = (ticket: CrmMassRow) => {
    if (!selectedCustomer) return;
    const message = replyText.trim();
    if (!message) {
      Alert.alert("Validation Error", "Please enter a reply message.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      await appendMotion(db, ticket.id, 307, "REPLIED", null, { message });
      await pushIfEnabled(db);
      setReplyText("");
      setReplyTicketId(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  const resolveTicket = (ticket: CrmMassRow) => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      const timeStr = new Date().toISOString();
      await phaseUpdateMotion(db, ticket.id, 308, "RESOLVED", null, { resolution: "completed" });
      await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [timeStr, ticket.id]);
      await pushIfEnabled(db);
      if (replyTicketId === ticket.id) setReplyTicketId(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  // ---- Tasks (matter + relation + mass slot) ----

  const createTask = () => {
    if (!selectedCustomer) return;
    const title = taskTitle.trim();
    if (!title) {
      Alert.alert("Validation Error", "Please enter a task title.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      const taskId = rid("task");
      const slotId = rid("slot");
      const now = new Date();
      const timeStr = now.toISOString();
      const dueDays = Number(taskDueDays) || 0;
      const endStr = dueDays > 0 ? new Date(now.getTime() + dueDays * 86400000).toISOString() : null;
      await db.run(
        "INSERT INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, 'task', ?, ?, ?, 0, NULL, ?)",
        [taskId, null, scope, selfId, title, timeStr]
      );
      if (selectedCustomer.id !== "general_personal") {
        await addRelation(db, selectedCustomer.id, taskId, "task");
      }
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'slot', ?, 1, 0, 1, ?, ?, NULL, ?)",
        [slotId, taskId, scope, timeStr, endStr, timeStr]
      );
      try {
        await upsertMatterVector(taskId, { title, type: "task", scope, code: null, data: null });
      } catch (vErr) {
        console.warn("[CRM] Vector sync failed:", vErr);
      }
      await pushIfEnabled(db);
      setTaskTitle(""); setTaskDueDays("");
      setSheet(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  const toggleTask = (task: TaskRow) => {
    if (!selectedCustomer || !task.mass_id) return;
    const isDone = task.active === 0;
    runMutation(async () => {
      const db = getDb();
      const timeStr = new Date().toISOString();
      if (isDone) {
        await db.run("UPDATE mass SET active = 1 WHERE id = ?", [task.mass_id]);
      } else {
        await db.run("UPDATE mass SET active = 0, end = ? WHERE id = ?", [timeStr, task.mass_id]);
      }
      await pushIfEnabled(db);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  // ---- Notes (matter + relation, vector-indexed) ----

  const createNote = () => {
    if (!selectedCustomer) return;
    const text = noteText.trim();
    if (!text) {
      Alert.alert("Validation Error", "Please enter note text.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      const noteId = rid("note");
      const timeStr = new Date().toISOString();
      const title = text.length > 48 ? `${text.slice(0, 48)}…` : text;
      const dataJson = JSON.stringify({ text });
      await db.run(
        "INSERT INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, 'note', ?, ?, ?, 0, ?, ?)",
        [noteId, null, scope, selfId, title, dataJson, timeStr]
      );
      if (selectedCustomer.id !== "general_personal") {
        await addRelation(db, selectedCustomer.id, noteId, "note");
      }
      try {
        await upsertMatterVector(noteId, { title, type: "note", scope, code: null, data: dataJson });
      } catch (vErr) {
        console.warn("[CRM] Vector sync failed:", vErr);
      }
      await pushIfEnabled(db);
      setNoteText("");
      setSheet(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  // ---- Schedule Slots (mass slot, for team/family) ----

  const createSlot = () => {
    if (!selectedCustomer) return;
    const title = slotTitle.trim();
    if (!title) {
      Alert.alert("Validation Error", "Please enter a schedule title.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      const slotId = rid("slot");
      const now = new Date();
      const timeStr = now.toISOString();
      const duration = Number(slotDuration) || 8;
      const endStr = new Date(now.getTime() + duration * 3600000).toISOString();
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'slot', ?, 1, 0, 1, ?, ?, ?, ?)",
        [slotId, selectedCustomer.id, "slot", scope, timeStr, endStr, JSON.stringify({ title }), timeStr]
      );
      await pushIfEnabled(db);
      setSlotTitle(""); setSlotDuration("");
      setSheet(null);
      const t = selectedCustomer.id === "general_personal" ? "personal" : (selectedCustomer.type || "customer");
      await loadCustomerDetail(selectedCustomer.id, t);
    });
  };

  // ---- Finance Operations ----

  const createBudgetAllocation = () => {
    if (!selectedCustomer) return;
    const name = budgetName.trim();
    if (!name) {
      Alert.alert("Validation Error", "Please enter a budget pool name.");
      return;
    }
    const limit = Number(budgetLimit) || 0;
    if (limit <= 0) {
      Alert.alert("Validation Error", "Please enter a valid budget limit.");
      return;
    }
    runMutation(async () => {
      const db = getDb();
      const budgetId = rid("budget");
      const now = new Date();
      const timeStr = now.toISOString();
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'budget', ?, ?, ?, 1, ?, NULL, ?, ?)",
        [budgetId, selectedCustomer.id, scope, limit, limit, timeStr, JSON.stringify({ name }), timeStr]
      );
      await appendMotion(db, budgetId, 806, "BUDGET_ALLOCATED", limit, { name, limit });
      await pushIfEnabled(db);
      setBudgetName("");
      setBudgetLimit("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };

  const recordExpense = () => {
    if (!selectedCustomer || !selectedBudgetPool) return;
    const amount = Number(expenseAmount) || 0;
    if (amount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid expense amount.");
      return;
    }
    const currentQty = selectedBudgetPool.qty || 0;
    runMutation(async () => {
      const db = getDb();
      const newQty = Math.max(0, currentQty - amount);
      await db.run("UPDATE mass SET qty = ? WHERE id = ?", [newQty, selectedBudgetPool.id]);
      
      await appendMotion(db, selectedBudgetPool.id, 806, "EXPENSE_REC", -amount, {
        category: expenseCategory,
        desc: expenseDesc.trim(),
        originalLimit: selectedBudgetPool.value
      });
      await pushIfEnabled(db);
      setExpenseAmount("");
      setExpenseDesc("");
      setSelectedBudgetPool(null);
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };

  const createInvoice = () => {
    if (!selectedCustomer) return;
    const amount = Number(invoiceAmount) || 0;
    if (amount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid invoice amount.");
      return;
    }
    const ref = invoiceRef.trim() || rid("inv");
    runMutation(async () => {
      const db = getDb();
      const invoiceId = rid("invoice");
      const timeStr = new Date().toISOString();
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, start, end, data, time) VALUES (?, ?, 'invoice', ?, 1, ?, 1, ?, NULL, ?, ?)",
        [invoiceId, selectedCustomer.id, scope, amount, timeStr, JSON.stringify({ ref }), timeStr]
      );
      await appendMotion(db, invoiceId, 801, "PAYMENT_INIT", amount, { ref });
      await pushIfEnabled(db);
      setInvoiceAmount("");
      setInvoiceRef("");
      setSheet(null);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };

  const resolveInvoiceSuccess = (invoice: CrmMassRow) => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      await db.run("UPDATE mass SET active = 0 WHERE id = ?", [invoice.id]);
      await phaseUpdateMotion(db, invoice.id, 802, "PAYMENT_SUCCESS", invoice.value, {});
      await pushIfEnabled(db);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };

  const resolveInvoiceFailure = (invoice: CrmMassRow) => {
    if (!selectedCustomer) return;
    runMutation(async () => {
      const db = getDb();
      await db.run("UPDATE mass SET active = 0 WHERE id = ?", [invoice.id]);
      await phaseUpdateMotion(db, invoice.id, 805, "PAYMENT_FAIL", 0, {});
      await pushIfEnabled(db);
      await loadCustomerDetail(selectedCustomer.id, selectedCustomer.type || "");
    });
  };

  // ---- Render ----

  if (!selfId) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  const selectedData = selectedCustomer ? parseData(selectedCustomer.data) : {};

  const photoUrl = selectedCustomer?.id === "general_personal" 
    ? userProfile?.photo 
    : (selectedData?.photo || selectedData?.image || selectedData?.avatar || selectedData?.thumbnail);
  
  const displayName = selectedCustomer?.title || "General / Personal";
  const initials = displayName
    .replace(/\(.*\)/, "")
    .replace(/@\w+/, "")
    .trim()
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>


        <View style={styles.titleBlock}>
          <TouchableOpacity 
            style={styles.workspaceSelectorChip} 
            onPress={() => router.push("/entity")}
            activeOpacity={0.7}
          >
            {photoUrl && photoUrl.trim().startsWith("http") ? (
              <Image
                source={{ uri: photoUrl }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  marginRight: 8,
                  backgroundColor: "#e2e8f0"
                }}
              />
            ) : (
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#cbd5e1",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 8
              }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#0f172a" }}>
                  {initials || "?"}
                </Text>
              </View>
            )}
            <Text style={styles.workspaceSelectorChipText}>
              {displayName}
            </Text>
          </TouchableOpacity>
          <Text style={styles.bigSubtitle}>
            {selectedCustomer 
              ? `${(selectedCustomer.type || "").toUpperCase()} · ${scope}` 
              : `${scope} · matter / mass / motion / relation`}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {!selectedCustomer ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: 100 }}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          ) : (
            <View>
              {/* Quick events — only for Customer/Business */}
              {(selectedCustomer.type === "customer" || selectedCustomer.type === "business") && (
                <>
                  <SectionHeader title="Quick events" tables="motion" />
                  <View style={styles.quickRow}>
                    {[
                      { code: 301, label: "Visit", icon: "storefront-outline" },
                      { code: 302, label: "Review", icon: "star-outline" },
                      { code: 309, label: "Offer", icon: "gift-outline" }
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.code}
                        style={styles.quickChip}
                        onPress={() => logQuickEvent(opt.code)}
                        disabled={busy}
                        activeOpacity={0.6}
                      >
                        <Ionicons name={opt.icon as any} size={15} color={ACCENT} />
                        <Text style={styles.quickChipText}>{opt.label}</Text>
                        <Text style={styles.quickChipOp}>{opt.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Leads — only for Customer/Business */}
              {(selectedCustomer.type === "customer" || selectedCustomer.type === "business") && (
                <>
                  <SectionHeader title="Leads" tables="mass + motion" />
                  {leads.map((lead) => {
                    const info = streamInfo[lead.id] || { stage: "new" };
                    const stage = info.stage;
                    const isWon = stage === "converted";
                    const stageColor = isWon ? "#107c41" : stage === "contacted" ? "#8764b8" : "#ca5010";
                    return (
                      <View key={lead.id}>
                        <View style={styles.listRow}>
                          <TouchableOpacity onPress={() => advanceLead(lead)} disabled={busy || isWon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <CheckCircle done={isWon} color="#107c41" />
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, isWon && styles.rowTitleDone]}>
                              ${Number(lead.value || 0).toFixed(2)} · {info.source || "unknown"}
                            </Text>
                            <Text style={styles.rowSub}>
                              {isWon ? "Won" : stage === "contacted" ? "Tap circle to convert" : "Tap circle to contact"}
                              {lead.end && !isWon ? ` · close by ${fmtTime(lead.end)}` : ""}
                            </Text>
                          </View>
                          <Text style={[styles.stageText, { color: stageColor }]}>{stage.toUpperCase()}</Text>
                          <TouchableOpacity onPress={() => toggleRowData(lead.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === lead.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => closeLead(lead)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={15} color={TEXT_TERTIARY} />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === lead.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", lead.id], ["matter", lead.matter], ["type", "lead"], ["scope", scope], ["qty", lead.qty], ["value", lead.value], ["active", lead.active], ["start", lead.start], ["end", lead.end], ["data", lead.data]]
                            },
                            {
                              table: `motion (stream = ${lead.id})`,
                              cols: timeline.filter((m) => m.stream === lead.id).map((m) => [
                                `seq ${m.seq}`,
                                `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                              ] as [string, any])
                            }
                          ]} />
                        )}
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  <AddRow label="Add a lead" onPress={() => openSheet("lead")} />
                </>
              )}

              {/* Tickets — only for Customer/Business/Vehicle */}
              {(selectedCustomer.type === "customer" || selectedCustomer.type === "business" || selectedCustomer.type === "vehicle" || selectedCustomer.type === "product" || selectedCustomer.type === "profile") && (
                <>
                  <SectionHeader title={selectedCustomer.type === "vehicle" ? "Maintenance & Sourcing" : "Tickets"} tables="mass + motion" />
                  {tickets.map((ticket) => {
                    const priority = parseData(ticket.data).priority || "medium";
                    const subject = streamInfo[ticket.id]?.subject;
                    const priorityColor = priority === "high" ? "#d13438" : priority === "medium" ? "#ca5010" : "#107c41";
                    const isReplying = replyTicketId === ticket.id;
                    return (
                      <View key={ticket.id}>
                        <View style={styles.listRow}>
                          <TouchableOpacity onPress={() => resolveTicket(ticket)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <CheckCircle done={false} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setReplyTicketId(isReplying ? null : ticket.id);
                              setReplyText("");
                            }}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.rowTitle}>{subject || ticket.id}</Text>
                            <Text style={styles.rowSub}>
                              Tap circle to resolve · tap row to reply
                              {ticket.end ? ` · SLA ${fmtTime(ticket.end)}` : ""}
                            </Text>
                          </TouchableOpacity>
                          <Text style={[styles.stageText, { color: priorityColor }]}>{priority.toUpperCase()}</Text>
                          <TouchableOpacity onPress={() => toggleRowData(ticket.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === ticket.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === ticket.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", ticket.id], ["matter", ticket.matter], ["type", "ticket"], ["scope", scope], ["qty", ticket.qty], ["value", ticket.value], ["active", ticket.active], ["start", ticket.start], ["end", ticket.end], ["data", ticket.data]]
                            },
                            {
                              table: `motion (stream = ${ticket.id})`,
                              cols: timeline.filter((m) => m.stream === ticket.id).map((m) => [
                                `seq ${m.seq}`,
                                `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                              ] as [string, any])
                            }
                          ]} />
                        )}
                        {isReplying && (
                          <View style={styles.replyRow}>
                            <TextInput
                              style={styles.replyInput}
                              value={replyText}
                              onChangeText={setReplyText}
                              placeholder="Reply message…"
                              placeholderTextColor={TEXT_TERTIARY}
                              autoFocus
                            />
                            <TouchableOpacity onPress={() => submitReply(ticket)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="send" size={18} color={ACCENT} />
                            </TouchableOpacity>
                          </View>
                        )}
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  <AddRow label="Add a ticket" onPress={() => openSheet("ticket")} />
                </>
              )}

              {/* Schedule Slots — only for Team/Family */}
              {(selectedCustomer.type === "person" || selectedCustomer.type === "family") && (
                <>
                  <SectionHeader title="Schedule & Shifts" tables="mass (slot)" />
                  {scheduleSlots.map((slot) => {
                    const dataObj = parseData(slot.data);
                    const titleStr = dataObj.title || "Scheduled Slot";
                    const isPassed = new Date(slot.end || "") < new Date();
                    return (
                      <View key={slot.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="calendar-outline" size={18} color={isPassed ? TEXT_TERTIARY : ACCENT} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{titleStr}</Text>
                            <Text style={styles.rowSub}>
                              {fmtTime(slot.start)} to {fmtTime(slot.end)}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => toggleRowData(slot.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === slot.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === slot.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", slot.id], ["matter", slot.matter], ["type", "slot"], ["scope", scope], ["qty", slot.qty], ["active", slot.active], ["start", slot.start], ["end", slot.end], ["data", slot.data]]
                            }
                          ]} />
                        )}
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  <AddRow label="Add schedule / shift" onPress={() => openSheet("slot")} />
                </>
              )}

              {/* Warehouse Inventory Stock — only for Warehouse */}
              {selectedCustomer.type === "warehouse" && (
                <>
                  <SectionHeader title="Inventory Stock" tables="mass (stock)" />
                  {stocks.map((stock) => {
                    const d = parseData(stock.data);
                    return (
                      <View key={stock.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="cube-outline" size={18} color={ACCENT} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{d.name || stock.id} · Qty: {stock.qty}</Text>
                            <Text style={styles.rowSub}>Unit Value: ${Number(stock.value || 0).toFixed(2)} · {fmtTime(stock.time)}</Text>
                          </View>
                          <TouchableOpacity onPress={() => toggleRowData(stock.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === stock.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => startStockTransfer(stock, "out")} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="log-out-outline" size={16} color={ACCENT} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => startStockTransfer(stock, "in")} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="log-in-outline" size={16} color="#107c41" />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === stock.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", stock.id], ["matter", stock.matter], ["type", "stock"], ["scope", scope], ["qty", stock.qty], ["value", stock.value], ["active", stock.active], ["start", stock.start], ["end", stock.end], ["data", stock.data]]
                            },
                            {
                              table: `motion (stream = ${stock.id})`,
                              cols: timeline.filter((m) => m.stream === stock.id).map((m) => [
                                `seq ${m.seq}`,
                                `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                              ] as [string, any])
                            }
                          ]} />
                        )}
                      <View style={styles.divider} />
                      </View>
                    );
                  })}
                  {stocks.length === 0 && <Text style={styles.emptyText}>No stock items found in this warehouse.</Text>}
                  <AddRow label="Add stock item" onPress={() => openSheet("stock")} />
                </>
              )}

              {/* Product variants, modifiers & profiles — only for Product */}
              {selectedCustomer.type === "product" && (
                <>
                  {/* Variants */}
                  <SectionHeader title="Variants (mass type=variant)" tables="mass (variant)" />
                  {variants.map((v) => {
                    const dataObj = parseData(v.data);
                    const qtyVal = v.qty ?? 0;
                    return (
                      <View key={v.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="pricetag-outline" size={18} color={ACCENT} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{dataObj.label || v.id}</Text>
                            <Text style={styles.rowSub}>
                              {qtyVal} units · ${Number(v.value || 0).toFixed(2)}
                            </Text>
                          </View>
                          {/* Quick restock / write-off buttons */}
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              style={[styles.quickChip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                              onPress={() => adjustVariantStock(v, "in")}
                              disabled={busy}
                            >
                              <Text style={{ fontSize: 11, color: ACCENT, fontWeight: "600" }}>Restock (+10)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.quickChip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                              onPress={() => adjustVariantStock(v, "out")}
                              disabled={busy}
                            >
                              <Text style={{ fontSize: 11, color: DANGER, fontWeight: "600" }}>Write-off (-10)</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  <AddRow label="Add Variant" onPress={() => openSheet("variant")} />

                  {/* Modifiers */}
                  <SectionHeader title="Modifiers & Add-ons (mass type=modifier)" tables="mass (modifier)" />
                  {modifiers.map((m) => {
                    return (
                      <View key={m.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{m.id}</Text>
                            <Text style={styles.rowSub}>
                              +${Number(m.value || 0).toFixed(2)} · {m.active ? "Active" : "Inactive"}
                            </Text>
                          </View>
                          {m.active && (
                            <TouchableOpacity
                              style={[styles.quickChip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                              onPress={() => deactivateModifier(m)}
                              disabled={busy}
                            >
                              <Text style={{ fontSize: 11, color: DANGER, fontWeight: "600" }}>Deactivate</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  <AddRow label="Add Modifier / Add-on" onPress={() => openSheet("modifier")} />

                  {/* Published to Storefront Profiles */}
                  <SectionHeader title="Published to Storefront Profiles" tables="relation (published_to)" />
                  {publishedProfiles.map((p) => {
                    return (
                      <View key={p.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="storefront-outline" size={18} color={ACCENT} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{p.title || p.id}</Text>
                            <Text style={styles.rowSub}>@{p.id}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.quickChip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                            onPress={() => unpublishFromProfile(p.id)}
                            disabled={busy}
                          >
                            <Text style={{ fontSize: 11, color: DANGER, fontWeight: "600" }}>Unpublish</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  <AddRow label="Publish to Storefront" onPress={() => openSheet("publish")} />
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={[styles.addRow, { backgroundColor: "#f0fdf4", marginHorizontal: 20, marginTop: 10, borderRadius: 8 }]}
                    onPress={() => publishToMarketplace(selectedCustomer.id)}
                  >
                    <Ionicons name="globe-outline" size={18} color="#16a34a" />
                    <Text style={[styles.addRowText, { color: "#16a34a", fontWeight: "700" }]}>
                      Publish to Marketplace
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Published products — only for Storefront Profiles */}
              {selectedCustomer.type === "profile" && (
                <>
                  <SectionHeader title="Published Products" tables="relation (published_to) + matter (product)" />
                  {publishedProducts.map((p) => {
                    return (
                      <View key={p.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="pricetag-outline" size={18} color={ACCENT} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{p.title || p.id}</Text>
                            <Text style={styles.rowSub}>@{p.code || p.id}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.quickChip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                            onPress={() => unpublishFromProfile(p.id)}
                            disabled={busy}
                          >
                            <Text style={{ fontSize: 11, color: DANGER, fontWeight: "600" }}>Unpublish</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                </>
              )}

              {/* Carrier/Vehicle Trips / Shipments — only for Carrier/Vehicle */}
              {(selectedCustomer.type === "carrier" || selectedCustomer.type === "vehicle") && (
                <>
                  <SectionHeader title={selectedCustomer.type === "vehicle" ? "Active Rides & Dispatches" : "Active Trips & Shipments"} tables="mass (trip)" />
                  {trips.map((trip) => {
                    const info = streamInfo[trip.id] || { stage: "dispatched" };
                    const isDelivered = info.stage === "delivered";
                    const isReturned = info.stage === "returned";
                    const isClosed = isDelivered || isReturned;
                    const d = parseData(trip.data);
                    return (
                      <View key={trip.id}>
                        <View style={styles.listRow}>
                          <TouchableOpacity onPress={() => advanceTrip(trip)} disabled={busy || isClosed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <CheckCircle done={isClosed} color={isReturned ? "#d93b3b" : "#107c41"} />
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, isClosed && styles.rowTitleDone]}>
                              {d.ref || trip.id} {trip.geo ? `(Hex: ${trip.geo})` : ""}
                            </Text>
                            <Text style={styles.rowSub}>
                              Qty: {trip.qty} · Driver: {d.driver || "Unassigned"} · {info.desc || "No transit updates yet"}
                            </Text>
                          </View>
                          <Text style={[styles.stageText, { color: isReturned ? "#d93b3b" : isDelivered ? "#107c41" : ACCENT }]}>
                            {(info.stage || "dispatched").replace("_", " ").toUpperCase()}
                          </Text>
                          <TouchableOpacity onPress={() => openDriverSelector(trip)} disabled={busy || isClosed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="person-add-outline" size={16} color={isClosed ? TEXT_TERTIARY : ACCENT} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => logDeliveryAttempt(trip)} disabled={busy || isClosed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="warning-outline" size={16} color={isClosed ? TEXT_TERTIARY : "#ffaa44"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => logReturnRequest(trip)} disabled={busy || isClosed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="arrow-undo-outline" size={16} color={isClosed ? TEXT_TERTIARY : "#d93b3b"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => updateTripEta(trip)} disabled={busy || isClosed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="time-outline" size={16} color={isClosed ? TEXT_TERTIARY : ACCENT} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => toggleRowData(trip.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === trip.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === trip.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", trip.id], ["matter", trip.matter], ["type", "trip"], ["scope", scope], ["qty", trip.qty], ["value", trip.value], ["active", trip.active], ["geo", trip.geo], ["start", trip.start], ["end", trip.end], ["data", trip.data]]
                            },
                            {
                              table: `motion (stream = ${trip.id})`,
                              cols: timeline.filter((m) => m.stream === trip.id).map((m) => [
                                `seq ${m.seq}`,
                                `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                              ] as [string, any])
                            }
                          ]} />
                        )}
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  {trips.length === 0 && <Text style={styles.emptyText}>{selectedCustomer.type === "vehicle" ? "No active rides for this vehicle." : "No active trips for this carrier."}</Text>}
                  <AddRow label={selectedCustomer.type === "vehicle" ? "Dispatch ride" : "Dispatch trip"} onPress={() => openSheet("trip")} />
                </>
              )}

              {/* Finance Budgets & Invoices — only for Finance Account */}
              {selectedCustomer.type === "finance" && (
                <>
                  <SectionHeader title="Budget Pools & Allocations" tables="mass (budget)" />
                  {budgets.map((budget) => {
                    const d = parseData(budget.data);
                    const name = d.name || budget.id;
                    const limitVal = budget.value || 0;
                    const spentVal = limitVal - (budget.qty || 0);
                    const remainingVal = budget.qty || 0;
                    const isLow = remainingVal < (limitVal * 0.1); // below 10%
                    
                    return (
                      <View key={budget.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="pie-chart-outline" size={18} color={isLow ? "#d93b3b" : "#107c41"} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>
                              {name} {isLow ? <Text style={{ color: "#d93b3b", fontSize: 11 }}>⚠️ LOW BUDGET</Text> : null}
                            </Text>
                            <Text style={styles.rowSub}>
                              Limit: ${limitVal.toFixed(2)} · Spent: ${spentVal.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={[styles.stageText, { color: isLow ? "#d93b3b" : "#107c41" }]}>
                            ${remainingVal.toFixed(2)} left
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedBudgetPool(budget);
                              setExpenseCategory("Supplies");
                              setExpenseAmount("");
                              setExpenseDesc("");
                              openSheet("expense");
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="cash-outline" size={16} color={ACCENT} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => toggleRowData(budget.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === budget.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === budget.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", budget.id], ["matter", budget.matter], ["type", "budget"], ["scope", scope], ["qty (remaining)", budget.qty], ["value (limit)", budget.value], ["active", budget.active], ["start", budget.start], ["end", budget.end], ["data", budget.data]]
                            },
                            {
                              table: `motion (stream = ${budget.id})`,
                              cols: timeline.filter((m) => m.stream === budget.id).map((m) => [
                                `seq ${m.seq}`,
                                `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                              ] as [string, any])
                            }
                          ]} />
                        )}
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  {budgets.length === 0 && <Text style={styles.emptyText}>No budget allocations found.</Text>}
                  <AddRow label="Allocate budget pool" onPress={() => openSheet("budget")} />

                  <SectionHeader title="Payment Gateway Invoices" tables="mass (invoice)" />
                  {invoices.map((invoice) => {
                    const d = parseData(invoice.data);
                    const ref = d.ref || invoice.id;
                    const amountVal = invoice.value || 0;
                    const isClosed = invoice.active === 0;
                    
                    const isPaid = timeline.some(m => m.stream === invoice.id && m.action === 802);
                    const isFailed = timeline.some(m => m.stream === invoice.id && m.action === 805);
                    const statusText = isPaid ? "SUCCESS" : isFailed ? "FAILED" : "PENDING";
                    const statusColor = isPaid ? "#107c41" : isFailed ? "#d93b3b" : "#ffaa44";

                    return (
                      <View key={invoice.id}>
                        <View style={styles.listRow}>
                          <Ionicons name="card-outline" size={18} color={statusColor} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, isClosed && styles.rowTitleDone]}>
                              {ref} (${amountVal.toFixed(2)})
                            </Text>
                            <Text style={styles.rowSub}>
                              Status: {statusText}
                            </Text>
                          </View>
                          {!isClosed && (
                            <View style={{ flexDirection: "row", gap: 10 }}>
                              <TouchableOpacity onPress={() => resolveInvoiceSuccess(invoice)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="checkmark-circle-outline" size={20} color="#107c41" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => resolveInvoiceFailure(invoice)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close-circle-outline" size={20} color="#d93b3b" />
                              </TouchableOpacity>
                            </View>
                          )}
                          <TouchableOpacity onPress={() => toggleRowData(invoice.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="server-outline" size={15} color={expandedRowId === invoice.id ? ACCENT : TEXT_TERTIARY} />
                          </TouchableOpacity>
                        </View>
                        {expandedRowId === invoice.id && (
                          <RowData rows={[
                            {
                              table: "mass",
                              cols: [["id", invoice.id], ["matter", invoice.matter], ["type", "invoice"], ["scope", scope], ["qty", invoice.qty], ["value", invoice.value], ["active", invoice.active], ["start", invoice.start], ["end", invoice.end], ["data", invoice.data]]
                            },
                            {
                              table: `motion (stream = ${invoice.id})`,
                              cols: timeline.filter((m) => m.stream === invoice.id).map((m) => [
                                `seq ${m.seq}`,
                                `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                              ] as [string, any])
                            }
                          ]} />
                        )}
                        <View style={styles.divider} />
                      </View>
                    );
                  })}
                  {invoices.length === 0 && <Text style={styles.emptyText}>No invoices found.</Text>}
                  <AddRow label="Create checkout invoice (801)" onPress={() => openSheet("invoice")} />
                </>
              )}

              {/* Tasks — for all contexts */}
              <SectionHeader title="Tasks" tables="matter + relation + mass + motion" />
              {tasks.map((task) => {
                const isDone = task.active === 0;
                return (
                  <View key={task.id}>
                    <View style={styles.listRow}>
                      <TouchableOpacity onPress={() => toggleTask(task)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <CheckCircle done={isDone} />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, isDone && styles.rowTitleDone]}>{task.title}</Text>
                        <Text style={styles.rowSub}>
                          {isDone ? `Completed ${fmtTime(task.end)}` : task.end ? `Due ${fmtTime(task.end)}` : "No due date"}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleRowData(task.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="server-outline" size={15} color={expandedRowId === task.id ? ACCENT : TEXT_TERTIARY} />
                      </TouchableOpacity>
                    </View>
                    {expandedRowId === task.id && (
                      <RowData rows={[
                        {
                          table: "matter",
                          cols: [["id", task.id], ["type", "task"], ["scope", scope], ["title", task.title], ["data", task.data], ["time", task.time]] as [string, any][]
                        },
                        ...(selectedCustomer.id !== "general_personal" ? [{
                          table: "relation",
                          cols: [["src", selectedCustomer.id], ["tgt", task.id], ["type", "task"], ["weight", 1.0]] as [string, any][]
                        }] : []),
                        {
                          table: "mass (slot)",
                          cols: [["id", task.mass_id], ["matter", task.id], ["type", "slot"], ["scope", scope], ["active", task.active], ["start", task.start], ["end", task.end]] as [string, any][]
                        },
                        {
                          table: `motion (stream = ${task.mass_id})`,
                          cols: timeline.filter((m) => m.stream === task.mass_id).map((m) => [
                            `seq ${m.seq}`,
                            `${OPCODE_LABELS[m.action] || m.action} · ${m.status || ""} · Δ${m.delta ?? "—"}`
                          ] as [string, any])
                        }
                      ]} />
                    )}
                    <View style={styles.divider} />
                  </View>
                );
              })}
              <AddRow label="Add a task" onPress={() => openSheet("task")} />

              {/* Notes — for all contexts */}
              <SectionHeader title="Notes" tables="matter + relation" />
              {notes.map((note) => {
                const d = parseData(note.data);
                return (
                  <View key={note.id}>
                    <View style={styles.listRow}>
                      <Ionicons name="document-text-outline" size={18} color={TEXT_SECONDARY} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={3}>{d.text || note.title}</Text>
                        <Text style={styles.rowSub}>{fmtTime(note.time)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleRowData(note.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="server-outline" size={15} color={expandedRowId === note.id ? ACCENT : TEXT_TERTIARY} />
                      </TouchableOpacity>
                    </View>
                    {expandedRowId === note.id && (
                      <RowData rows={[
                        {
                          table: "matter",
                          cols: [["id", note.id], ["type", "note"], ["scope", scope], ["title", note.title], ["data", note.data], ["time", note.time]] as [string, any][]
                        },
                        ...(selectedCustomer.id !== "general_personal" ? [{
                          table: "relation",
                          cols: [["src", selectedCustomer.id], ["tgt", note.id], ["type", "note"], ["weight", 1.0]] as [string, any][]
                        }] : []),
                        {
                          table: "memory (vector)",
                          cols: [["matter", note.id], ["vector", "BLOB (embedding)"]] as [string, any][]
                        }
                      ]} />
                    )}
                    <View style={styles.divider} />
                  </View>
                );
              })}
              <AddRow label="Add a note" onPress={() => openSheet("note")} />

              {/* Activity / Kinetic Ledger — for all contexts */}
              <SectionHeader title="Activity" tables="motion (read)" />
              {timeline.map((m) => (
                <View key={m.id}>
                  <TouchableOpacity style={styles.listRow} onPress={() => toggleRowData(m.id)} activeOpacity={0.6}>
                    <View style={styles.ledgerDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {OPCODE_LABELS[m.action] || `OP ${m.action}`}
                        {m.status ? <Text style={styles.ledgerStatus}>  {m.status}</Text> : null}
                      </Text>
                      <Text style={styles.ledgerMeta}>{m.stream} · seq {m.seq} · {fmtTime(m.time)}</Text>
                    </View>
                    {m.delta !== null && m.delta !== undefined && (
                      <Text style={styles.ledgerDelta}>{Number(m.delta) > 0 ? "+" : ""}{m.delta}</Text>
                    )}
                    <Ionicons name="server-outline" size={13} color={expandedRowId === m.id ? ACCENT : "#d2d0ce"} />
                  </TouchableOpacity>
                  {expandedRowId === m.id && (
                    <RowData rows={[{
                      table: "motion",
                      cols: [["id", m.id], ["stream", m.stream], ["seq", m.seq], ["action", `${m.action} (${OPCODE_LABELS[m.action] || "?"})`], ["status", m.status], ["delta", m.delta], ["scope", scope], ["data", m.data], ["time", m.time]]
                    }]} />
                  )}
                  <View style={styles.divider} />
                </View>
              ))}
              {timeline.length === 0 && <Text style={styles.emptyText}>No activity yet.</Text>}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---- Bottom sheet drawer (single Modal, content per kind) ---- */}
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSheet(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={{ alignItems: "center" }}>
              <View style={styles.modalKnob} />
            </View>

            {sheet === "customer" && (
              <>
                <Text style={styles.modalTitle}>{editingCustomerId ? "Edit contact / entity" : "Add contact / entity"}</Text>
                <Text style={styles.modalSchemaHint}>matter (type: {entityType}, scope: {scope}) → vector index</Text>
                
                {/* Segment Selector for Entity Type */}
                <View style={styles.segmentRow}>
                  {[
                    { label: "Customer", value: "customer" },
                    { label: "Business", value: "business" },
                    { label: "Team", value: "person" },
                    { label: "Family", value: "family" },
                    { label: "Warehouse", value: "warehouse" },
                    { label: "Carrier", value: "carrier" },
                    { label: "Vehicle", value: "vehicle" },
                    { label: "Finance", value: "finance" },
                    { label: "Product", value: "product" },
                    { label: "Profile", value: "profile" }
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.segment, entityType === t.value && styles.segmentActive]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEntityType(t.value); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.segmentText, entityType === t.value && styles.segmentTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput style={styles.modalInput} value={custName} onChangeText={setCustName} placeholder="Name" placeholderTextColor={TEXT_TERTIARY} autoFocus />
                <TextInput style={styles.modalInput} value={custEmail} onChangeText={setCustEmail} placeholder="Email" placeholderTextColor={TEXT_TERTIARY} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={styles.modalInput} value={custPhone} onChangeText={setCustPhone} placeholder="Phone / Details" placeholderTextColor={TEXT_TERTIARY} keyboardType="phone-pad" />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={saveCustomer} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>{editingCustomerId ? "Save" : "Add entity"}</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "lead" && (
              <>
                <Text style={styles.modalTitle}>Add a lead</Text>
                <Text style={styles.modalSchemaHint}>mass (value, end = expected close) + motion 303 NEW_LEAD</Text>
                <TextInput style={styles.modalInput} value={leadValue} onChangeText={setLeadValue} placeholder="Deal value" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" autoFocus />
                <View style={styles.segmentRow}>
                  {LEAD_SOURCES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.segment, leadSource === s && styles.segmentActive]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLeadSource(s); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.segmentText, leadSource === s && styles.segmentTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.modalInput} value={leadCloseDays} onChangeText={setLeadCloseDays} placeholder="Expected close (days, optional)" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TextInput style={styles.modalInput} value={leadNote} onChangeText={setLeadNote} placeholder="Note (optional)" placeholderTextColor={TEXT_TERTIARY} />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createLead} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Add lead</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "ticket" && (
              <>
                <Text style={styles.modalTitle}>Add a ticket</Text>
                <Text style={styles.modalSchemaHint}>mass (end = SLA deadline) + motion 306 TICKET OPEN</Text>
                <TextInput style={styles.modalInput} value={ticketSubject} onChangeText={setTicketSubject} placeholder="Subject" placeholderTextColor={TEXT_TERTIARY} autoFocus />
                <View style={styles.segmentRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.segment, ticketPriority === p && styles.segmentActive]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTicketPriority(p); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.segmentText, ticketPriority === p && styles.segmentTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.modalInput} value={ticketSlaHours} onChangeText={setTicketSlaHours} placeholder="SLA (hours, optional)" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TextInput style={[styles.modalInput, { height: 60 }]} value={ticketDesc} onChangeText={setTicketDesc} placeholder="Description (optional)" placeholderTextColor={TEXT_TERTIARY} multiline />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createTicket} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Open ticket</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "task" && (
              <>
                <Text style={styles.modalTitle}>Add a task</Text>
                <Text style={styles.modalSchemaHint}>matter + relation (customer → task) + mass slot</Text>
                <TextInput style={styles.modalInput} value={taskTitle} onChangeText={setTaskTitle} placeholder="Task title" placeholderTextColor={TEXT_TERTIARY} autoFocus />
                <TextInput style={styles.modalInput} value={taskDueDays} onChangeText={setTaskDueDays} placeholder="Due in (days, optional)" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createTask} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Add task</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "note" && (
              <>
                <Text style={styles.modalTitle}>Add a note</Text>
                <Text style={styles.modalSchemaHint}>matter + relation (customer → note) → vector index</Text>
                <TextInput style={[styles.modalInput, { height: 90 }]} value={noteText} onChangeText={setNoteText} placeholder="Write a note…" placeholderTextColor={TEXT_TERTIARY} multiline autoFocus />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createNote} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Add note</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "slot" && (
              <>
                <Text style={styles.modalTitle}>Schedule shift / chore</Text>
                <Text style={styles.modalSchemaHint}>mass (type: slot, scope: {scope})</Text>
                <TextInput style={styles.modalInput} value={slotTitle} onChangeText={setSlotTitle} placeholder="Shift/Chore title (e.g. Cleaning)" placeholderTextColor={TEXT_TERTIARY} autoFocus />
                <TextInput style={styles.modalInput} value={slotDuration} onChangeText={setSlotDuration} placeholder="Duration (hours, default 8)" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createSlot} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Schedule</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "review" && (
              <>
                <Text style={styles.modalTitle}>Log a review</Text>
                <Text style={styles.modalSchemaHint}>motion 302 REVIEW (delta = rating)</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReviewRating(r); }}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Ionicons name={r <= reviewRating ? "star" : "star-outline"} size={28} color="#ffaa44" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[styles.modalInput, { height: 60 }]} value={reviewComment} onChangeText={setReviewComment} placeholder="Customer feedback…" placeholderTextColor={TEXT_TERTIARY} multiline />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={submitReview} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Log review</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "stock" && (
              <>
                <Text style={styles.modalTitle}>Add stock item</Text>
                <Text style={styles.modalSchemaHint}>mass (type: stock, scope: {scope}) + motion 406 TRANSFER_IN</Text>
                <TextInput style={styles.modalInput} value={stockName} onChangeText={setStockName} placeholder="Item SKU / Name" placeholderTextColor={TEXT_TERTIARY} autoFocus />
                <TextInput style={styles.modalInput} value={stockQty} onChangeText={setStockQty} placeholder="Initial Qty" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TextInput style={styles.modalInput} value={stockVal} onChangeText={setStockVal} placeholder="Unit Value" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createStock} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Add Stock</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "trip" && (
              <>
                <Text style={styles.modalTitle}>{selectedCustomer?.type === "vehicle" ? "Dispatch new ride" : "Dispatch new trip"}</Text>
                <Text style={styles.modalSchemaHint}>mass (type: trip, scope: {scope}) + motion 401 DISPATCHED</Text>
                <TextInput style={styles.modalInput} value={tripRef} onChangeText={setTripRef} placeholder="Trip Reference / Details" placeholderTextColor={TEXT_TERTIARY} autoFocus />
                <TextInput style={styles.modalInput} value={tripQty} onChangeText={setTripQty} placeholder="Onboard Qty" placeholderTextColor={TEXT_TERTIARY} keyboardType="numeric" />
                <TextInput style={styles.modalInput} value={tripGeo} onChangeText={setTripGeo} placeholder="H3 Geo Coordinate" placeholderTextColor={TEXT_TERTIARY} />
                
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 6 }}>Assign Driver:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.segment, !tripDriver && styles.segmentActive, { minWidth: 80, marginRight: 6 }]}
                    onPress={() => setTripDriver("")}
                  >
                    <Text style={[styles.segmentText, !tripDriver && styles.segmentTextActive]}>Unassigned</Text>
                  </TouchableOpacity>
                  {customers.filter(c => c.type === "person").map((driver) => (
                    <TouchableOpacity
                      key={driver.id}
                      style={[styles.segment, tripDriver === driver.id && styles.segmentActive, { minWidth: 80, marginRight: 6 }]}
                      onPress={() => setTripDriver(driver.id)}
                    >
                      <Text style={[styles.segmentText, tripDriver === driver.id && styles.segmentTextActive]}>{driver.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createTrip} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Dispatch Trip</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "driver" && (
              <>
                <Text style={styles.modalTitle}>Assign Driver to Trip</Text>
                <Text style={styles.modalSchemaHint}>motion 403 DRIVER_ASSIGNED</Text>
                <ScrollView style={{ maxHeight: 200, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.listRow, { paddingHorizontal: 10, paddingVertical: 10 }]}
                    onPress={() => assignDriver("", "Unassigned")}
                  >
                    <Ionicons name="person-remove-outline" size={16} color="#d93b3b" />
                    <Text style={{ flex: 1, fontSize: 14, color: "#d93b3b" }}>Unassigned / Remove Driver</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  {customers.filter(c => c.type === "person").map(driver => (
                    <View key={driver.id}>
                      <TouchableOpacity
                        style={[styles.listRow, { paddingHorizontal: 10, paddingVertical: 10 }]}
                        onPress={() => assignDriver(driver.id, driver.title)}
                      >
                        <Ionicons name="person-outline" size={16} color={ACCENT} />
                        <Text style={{ flex: 1, fontSize: 14 }}>{driver.title}</Text>
                      </TouchableOpacity>
                      <View style={styles.divider} />
                    </View>
                  ))}
                  {customers.filter(c => c.type === "person").length === 0 && (
                    <Text style={styles.emptyText}>No team members found. Add a Team member first.</Text>
                  )}
                </ScrollView>
              </>
            )}

            {sheet === "transfer" && (
              <>
                <Text style={styles.modalTitle}>
                  {transferDirection === "in" ? "Log Inventory Transfer In" : "Log Inventory Transfer Out"}
                </Text>
                <Text style={styles.modalSchemaHint}>
                  mass + motion ({transferDirection === "in" ? "406 TRANSFER_IN" : "405 TRANSFER_OUT"}) + relation
                </Text>
                
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 8 }}>
                  Item: {transferStock ? parseData(transferStock.data).name || transferStock.id : ""}
                </Text>

                <TextInput
                  style={styles.modalInput}
                  value={transferQty}
                  onChangeText={setTransferQty}
                  placeholder="Transfer Quantity"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                  autoFocus
                />

                <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 6 }}>
                  Storefront Association (Optional):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.segment, !transferStorefront && styles.segmentActive, { minWidth: 80, marginRight: 6 }]}
                    onPress={() => setTransferStorefront("")}
                  >
                    <Text style={[styles.segmentText, !transferStorefront && styles.segmentTextActive]}>None / Internal</Text>
                  </TouchableOpacity>
                  {customers.filter(c => c.type === "business").map((store) => (
                    <TouchableOpacity
                      key={store.id}
                      style={[styles.segment, transferStorefront === store.id && styles.segmentActive, { minWidth: 80, marginRight: 6 }]}
                      onPress={() => setTransferStorefront(store.id)}
                    >
                      <Text style={[styles.segmentText, transferStorefront === store.id && styles.segmentTextActive]}>{store.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.modalSubmitBtn} onPress={confirmStockTransfer} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Confirm Transfer</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "budget" && (
              <>
                <Text style={styles.modalTitle}>Allocate Budget Pool</Text>
                <Text style={styles.modalSchemaHint}>mass (type: budget, value = limit) + motion 806</Text>
                <TextInput
                  style={styles.modalInput}
                  value={budgetName}
                  onChangeText={setBudgetName}
                  placeholder="Budget Pool Name (e.g. Supplies, Travel)"
                  placeholderTextColor={TEXT_TERTIARY}
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={budgetLimit}
                  onChangeText={setBudgetLimit}
                  placeholder="Allocated Limit (e.g. 1000)"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createBudgetAllocation} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Allocate Budget</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "expense" && (
              <>
                <Text style={styles.modalTitle}>Log Expense</Text>
                <Text style={styles.modalSchemaHint}>motion 806 EXPENSE_REC (subtracts from budget qty)</Text>
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 8 }}>
                  Budget Pool: {selectedBudgetPool ? parseData(selectedBudgetPool.data).name || selectedBudgetPool.id : ""}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="Expense Amount"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={expenseDesc}
                  onChangeText={setExpenseDesc}
                  placeholder="Expense Description"
                  placeholderTextColor={TEXT_TERTIARY}
                />
                
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 6 }}>
                  Category:
                </Text>
                <View style={styles.segmentRow}>
                  {["Supplies", "Travel", "Software", "Rent", "Utility"].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.segment, expenseCategory === cat && styles.segmentActive, { minWidth: "20%" }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpenseCategory(cat); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.segmentText, expenseCategory === cat && styles.segmentTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.modalSubmitBtn} onPress={recordExpense} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Record Expense</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "invoice" && (
              <>
                <Text style={styles.modalTitle}>Create Checkout Invoice</Text>
                <Text style={styles.modalSchemaHint}>mass (type: invoice, value = price) + motion 801 PAYMENT_INIT</Text>
                <TextInput
                  style={styles.modalInput}
                  value={invoiceAmount}
                  onChangeText={setInvoiceAmount}
                  placeholder="Invoice Amount"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={invoiceRef}
                  onChangeText={setInvoiceRef}
                  placeholder="Invoice Reference (e.g. INV-992)"
                  placeholderTextColor={TEXT_TERTIARY}
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createInvoice} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Create Invoice</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "product" && (
              <>
                <Text style={styles.modalTitle}>Create Product Blueprint</Text>
                <Text style={styles.modalSchemaHint}>matter (type: product) ? vector store</Text>
                <TextInput
                  style={styles.modalInput}
                  value={productTitle}
                  onChangeText={setProductTitle}
                  placeholder="Product Title"
                  placeholderTextColor={TEXT_TERTIARY}
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={productCode}
                  onChangeText={setProductCode}
                  placeholder="Product Code (e.g. SNEAKERS01)"
                  placeholderTextColor={TEXT_TERTIARY}
                />
                <TextInput
                  style={styles.modalInput}
                  value={productBasePrice}
                  onChangeText={setProductBasePrice}
                  placeholder="Base Price (Optional)"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.modalInput}
                  value={productCat}
                  onChangeText={setProductCat}
                  placeholder="Category (e.g. retail, food)"
                  placeholderTextColor={TEXT_TERTIARY}
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createProduct} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Create Product</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "variant" && (
              <>
                <Text style={styles.modalTitle}>Add Variant Stock</Text>
                <Text style={styles.modalSchemaHint}>mass (type: variant) + motion 406 TRANSFER_IN</Text>
                <TextInput
                  style={styles.modalInput}
                  value={variantLabel}
                  onChangeText={setVariantLabel}
                  placeholder="Label (e.g. Black / S)"
                  placeholderTextColor={TEXT_TERTIARY}
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={variantQty}
                  onChangeText={setVariantQty}
                  placeholder="Initial Stock Qty"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.modalInput}
                  value={variantPrice}
                  onChangeText={setVariantPrice}
                  placeholder="Price"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createVariant} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Add Variant</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "modifier" && (
              <>
                <Text style={styles.modalTitle}>Add Modifier / Add-on</Text>
                <Text style={styles.modalSchemaHint}>matter (modifier product) + relation + mass (price)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={modifierTitle}
                  onChangeText={setModifierTitle}
                  placeholder="Modifier Name (e.g. Extra Cheese)"
                  placeholderTextColor={TEXT_TERTIARY}
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={modifierPrice}
                  onChangeText={setModifierPrice}
                  placeholder="Add-on Price"
                  placeholderTextColor={TEXT_TERTIARY}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={createModifier} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Add Modifier</Text>}
                </TouchableOpacity>
              </>
            )}

            {sheet === "publish" && (
              <>
                <Text style={styles.modalTitle}>Publish to Storefront</Text>
                <Text style={styles.modalSchemaHint}>relation (published_to)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={publishTargetId}
                  onChangeText={setPublishTargetId}
                  placeholder="Storefront Profile ID (e.g. TAMILSHOES)"
                  placeholderTextColor={TEXT_TERTIARY}
                  autoFocus
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={publishToProfile} disabled={busy} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalSubmitBtnText}>Publish Product</Text>}
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  workspaceSelectorChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    alignSelf: "flex-start",
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginBottom: 6,
  },
  workspaceSelectorChipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  bigTitle: { fontSize: 26, fontWeight: "700", color: ACCENT },
  bigSubtitle: { fontSize: 11, color: TEXT_TERTIARY, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  scrollContent: { paddingBottom: 40 },

  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 22, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY },
  sectionTables: { fontSize: 10, color: TEXT_TERTIARY, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "white" },
  listRowSelected: { backgroundColor: "#f3f6fd" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 20 },
  rowTitle: { fontSize: 14, color: TEXT_PRIMARY },
  rowTitleDone: { color: TEXT_TERTIARY, textDecorationLine: "line-through" },
  rowSub: { fontSize: 11, color: TEXT_TERTIARY, marginTop: 2 },
  stageText: { fontSize: 10, fontWeight: "700" },

  addRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  addRowText: { fontSize: 14, color: ACCENT },

  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: "center", alignItems: "center", backgroundColor: "white" },

  avatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f2f1", justifyContent: "center", alignItems: "center" },
  avatarInitial: { fontSize: 13, fontWeight: "700", color: TEXT_SECONDARY },

  quickRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  quickChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f3f6fd", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16 },
  quickChipText: { fontSize: 12, fontWeight: "600", color: ACCENT },
  quickChipOp: { fontSize: 9, color: TEXT_TERTIARY, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  replyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingLeft: 52, paddingBottom: 10 },
  replyInput: { flex: 1, backgroundColor: "#faf9f8", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: TEXT_PRIMARY, borderWidth: 1, borderColor: DIVIDER },

  ledgerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  ledgerStatus: { fontSize: 10, fontWeight: "600", color: TEXT_TERTIARY },
  ledgerMeta: { fontSize: 10, color: TEXT_TERTIARY, marginTop: 1, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  ledgerDelta: { fontSize: 12, fontWeight: "700", color: TEXT_PRIMARY, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  emptyText: { fontSize: 12, color: TEXT_TERTIARY, paddingHorizontal: 20, paddingVertical: 12 },

  rowDataPanel: { backgroundColor: "#faf9f8", marginHorizontal: 20, marginBottom: 10, borderRadius: 6, borderWidth: 1, borderColor: DIVIDER, padding: 10 },
  rowDataTable: {},
  rowDataTableName: { fontSize: 11, fontWeight: "700", color: ACCENT, marginBottom: 4, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  rowDataLine: { flexDirection: "row", paddingVertical: 1.5 },
  rowDataCol: { width: 88, fontSize: 10, color: TEXT_SECONDARY, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  rowDataVal: { flex: 1, fontSize: 10, color: TEXT_PRIMARY, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.32)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, borderWidth: 0 },
  modalKnob: { width: 32, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", marginTop: 8, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "600", color: "#1f1f1f", marginBottom: 4 },
  modalSchemaHint: { fontSize: 10, color: "#747775", marginBottom: 16, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  modalInput: { backgroundColor: "#f1f5f9", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: TEXT_PRIMARY, marginBottom: 12, borderWidth: 0 },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  segment: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: DIVIDER, alignItems: "center", backgroundColor: "white", minWidth: "30%", flexGrow: 1 },
  segmentActive: { backgroundColor: "#f3f6fd", borderColor: ACCENT },
  segmentText: { fontSize: 12, color: TEXT_SECONDARY },
  segmentTextActive: { color: ACCENT, fontWeight: "700" },
  modalSubmitBtn: { backgroundColor: ACCENT, borderRadius: 24, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  modalSubmitBtnText: { fontSize: 15, fontWeight: "600", color: "white" }
});
