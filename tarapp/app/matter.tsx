import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Keyboard,
  PanResponder,
  Animated,
  Modal
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getUserDb } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const MODEL = "openai/gpt-oss-120b";

const genId = () => `mat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

interface MassRecord {
  id: string;
  matter: string;
  type: string | null;
  scope: string | null;
  qty: number | null;
  value: number | null;
  active: number;
  geo: string | null;
  start: string | null;
  end: string | null;
  data: string | null;
  time?: string;
  _status?: "created" | "updated" | "deleted" | "unchanged";
}

interface SwipeableRowProps {
  itemKey: string;
  val: any;
  isPrimitive: boolean;
  onUpdate: (val: any) => void;
  onRenameKey: (newKey: string) => void;
  onDelete: () => void;
}

function NestedTableRow({ subKey, subVal, onSubUpdate, onSubRename, isLast }: { 
  subKey: string; 
  subVal: any; 
  onSubUpdate: (v: any) => void; 
  onSubRename: (k: string) => void;
  isLast: boolean;
}) {
  const [localSubKey, setLocalSubKey] = React.useState(subKey);

  React.useEffect(() => {
    setLocalSubKey(subKey);
  }, [subKey]);

  const subIsPrimitive = subVal === null || typeof subVal !== "object";

  return (
    <View style={[styles.nestedTableRow, isLast && { borderBottomWidth: 0 }]}>
      <TextInput
        style={styles.nestedTableKeyInput}
        value={localSubKey}
        onChangeText={setLocalSubKey}
        onBlur={() => {
          if (localSubKey.trim() !== "" && localSubKey !== subKey) {
            onSubRename(localSubKey.trim());
          } else {
            setLocalSubKey(subKey);
          }
        }}
        onSubmitEditing={() => {
          if (localSubKey.trim() !== "" && localSubKey !== subKey) {
            onSubRename(localSubKey.trim());
          }
        }}
        placeholder="Key"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
      />
      {subIsPrimitive ? (
        <TextInput
          style={styles.nestedTableValue}
          value={String(subVal ?? "")}
          onChangeText={onSubUpdate}
          placeholderTextColor="#94a3b8"
        />
      ) : (
        <Text style={styles.nestedTableRawValue}>{JSON.stringify(subVal)}</Text>
      )}
    </View>
  );
}

function SwipeablePropertyRow({ itemKey, val, isPrimitive, onUpdate, onRenameKey, onDelete }: SwipeableRowProps) {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const [localKey, setLocalKey] = React.useState(itemKey);

  React.useEffect(() => {
    setLocalKey(itemKey);
  }, [itemKey]);

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.vy) < 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          pan.setValue({ x: gestureState.dx, y: 0 });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -120) {
          Animated.timing(pan, {
            toValue: { x: -600, y: 0 },
            duration: 150,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 5,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBackground}>
        <Ionicons name="trash-outline" size={18} color="#fff" />
      </View>

      <Animated.View
        style={[
          styles.swipeableContent,
          { transform: [{ translateX: pan.x }] }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dataRow}>
          <TextInput
            style={styles.dataKeyInput}
            value={localKey}
            onChangeText={setLocalKey}
            onBlur={() => {
              if (localKey.trim() !== "" && localKey !== itemKey) {
                onRenameKey(localKey.trim());
              } else {
                setLocalKey(itemKey);
              }
            }}
            onSubmitEditing={() => {
              if (localKey.trim() !== "" && localKey !== itemKey) {
                onRenameKey(localKey.trim());
              }
            }}
            placeholder="Property"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
          {Array.isArray(val) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {val.map((item, i) => (
                <View key={i} style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 13, color: "#475569", fontWeight: "500", textTransform: "capitalize" }}>{String(item)}</Text>
                </View>
              ))}
            </View>
          ) : typeof val === "boolean" ? (
            <View style={{ marginTop: 4, backgroundColor: val ? "#dcfce7" : "#fee2e2", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 13, color: val ? "#166534" : "#991b1b", fontWeight: "600" }}>{val ? "Yes" : "No"}</Text>
            </View>
          ) : isPrimitive ? (
            <TextInput
              style={styles.dataValue}
              value={String(val ?? "")}
              onChangeText={onUpdate}
              placeholderTextColor="#94a3b8"
              multiline={String(val).length > 30}
            />
          ) : typeof val === "object" && val !== null ? (
            <View style={styles.nestedTable}>
              {Object.entries(val).map(([subKey, subVal], subIdx, subArr) => (
                <NestedTableRow
                  key={subKey}
                  subKey={subKey}
                  subVal={subVal}
                  isLast={subIdx === subArr.length - 1}
                  onSubUpdate={(newSubVal) => {
                    const numericVal = Number(newSubVal);
                    const parsedSubVal = (newSubVal.trim() !== "" && !isNaN(numericVal)) ? numericVal : newSubVal;
                    const updatedObj = { ...val, [subKey]: parsedSubVal };
                    onUpdate(updatedObj);
                  }}
                  onSubRename={(newSubKey) => {
                    const updatedObj = { ...val };
                    const temp = updatedObj[subKey];
                    delete updatedObj[subKey];
                    updatedObj[newSubKey] = temp;
                    onUpdate(updatedObj);
                  }}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.dataRawValue}>{JSON.stringify(val)}</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export default function MatterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: editId } = useLocalSearchParams<{ id: string }>();
  const isEditing = !!editId;

  // Matter states
  const [recordId, setRecordId] = useState(genId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("");
  const [data, setData] = useState("{}");
  const [original, setOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Mass (Realization) states
  const [massRecords, setMassRecords] = useState<MassRecord[]>([]);
  const [showMassForm, setShowMassForm] = useState(false);
  const [editingMassId, setEditingMassId] = useState<string | null>(null);
  const [massType, setMassType] = useState("");
  const [massScope, setMassScope] = useState("");
  const [massQty, setMassQty] = useState("");
  const [massValue, setMassValue] = useState("");
  const [massGeo, setMassGeo] = useState("");
  const [massStart, setMassStart] = useState("");
  const [massEnd, setMassEnd] = useState("");
  const [massData, setMassData] = useState("");

  // AI states
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Dynamic form helper states
  const [noteBody, setNoteBody] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffPhone, setStaffPhone] = useState("");

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    console.log("[Matter:Load] Starting edit session loader for editId:", editId);
    (async () => {
      try {
        let db = getUserDb();
        console.log("[Matter:Load] Querying matter record from local database...");
        let rows = await db.all("SELECT * FROM matter WHERE id = ?", [editId]);
        console.log("[Matter:Load] Query finished. Matching rows found:", rows?.length);

        if (Array.isArray(rows) && rows.length > 0) {
          const rec: any = rows[0];
          console.log("[Matter:Load] Found matter record to edit:", rec);
          setOriginal(rec);
          setRecordId(String(rec.id ?? ""));
          setTitle(String(rec.title ?? ""));
          setType(String(rec.type ?? ""));
          setCode(String(rec.code ?? ""));
          setScope(String(rec.scope ?? ""));
          setData(String(rec.data ?? "{}"));
          setIsDraft(rec.public === 0 && (rec.type === "product" || rec.type === "food"));

          let parsedData: any = {};
          try { parsedData = JSON.parse(rec.data || "{}"); } catch {}
          
          if (rec.type === "note") {
            setNoteBody(parsedData.body || "");
          } else if (rec.type === "task") {
            setTaskPriority(parsedData.priority || "medium");
          } else if (rec.type === "store") {
            setStoreAddress(parsedData.address || "");
          } else if (rec.type === "person") {
            setStaffRole(parsedData.role || "");
            setStaffPhone(parsedData.phone || "");
          }

          // Load related Mass (Realization) records from the same resolved database
          console.log("[Matter:Load] Querying related mass records...");
          const massRows = await db.all(
            "SELECT * FROM mass WHERE matter = ? AND active = 1 ORDER BY time DESC",
            [editId]
          );
          console.log("[Matter:Load] Query finished. Related mass records loaded:", massRows?.length);
          if (Array.isArray(massRows)) {
            setMassRecords(massRows.map((r: any) => ({ ...r, _status: "unchanged" })));
            
            if (rec.type === "task") {
              const deadlineRow = massRows.find(r => r.type === "slot" && r.scope === "deadline");
              if (deadlineRow) setTaskDeadline(deadlineRow.start !== null && deadlineRow.start !== undefined ? String(deadlineRow.start) : "");
            } else if (rec.type === "product" || rec.type === "food") {
              const priceRow = massRows.find(r => r.type === "price");
              const stockRow = massRows.find(r => r.type === "stock");
              if (priceRow) setProdPrice(priceRow.value !== null ? String(priceRow.value) : "");
              if (stockRow) setProdStock(stockRow.qty !== null ? String(stockRow.qty) : "");
            }
          }
        } else {
          console.warn("[Matter:Load] Record not found for editId:", editId);
          Alert.alert("Error", "Record not found.");
          router.back();
        }
      } catch (e) {
        console.error("[Matter:Load] Failed to load matter:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  const handlePublish = async () => {
    if (publishing) return;
    console.log("[Matter:Publish] Attempting to mark product public locally for ID:", recordId);
    setPublishing(true);
    try {
      const userDb = getUserDb();
      console.log("[Matter:Publish] Running update query on SQLite...");
      await userDb.run("UPDATE matter SET public = 1 WHERE id = ?", [recordId]);
      console.log("[Matter:Publish] Local update complete. Item marked public.");

      setIsDraft(false);
      Alert.alert("Success", "Catalog product marked as public successfully!");
      router.back();
    } catch (e: any) {
      console.error("[Matter:Publish] Failed to publish:", e);
      Alert.alert("Publish Failed", e.message || "Failed to publish product.");
    } finally {
      setPublishing(false);
    }
  };

  const handleSave = async () => {
    if (!title) {
      Alert.alert("Error", "Title is required");
      return;
    }
    setSaving(true);
    console.log("[Matter:Save] Initiated save process for recordId:", recordId, { isEditing });

    try {
      const db = getUserDb();
      const time = new Date().toISOString();

      // Merge dynamic form helper states into data field before saving
      let finalDataObj = {};
      try { finalDataObj = JSON.parse(data || "{}"); } catch {}
      
      if (type === "note") {
        finalDataObj = { ...finalDataObj, body: noteBody };
      } else if (type === "task") {
        finalDataObj = { ...finalDataObj, priority: taskPriority };
      } else if (type === "store") {
        finalDataObj = { ...finalDataObj, address: storeAddress };
      } else if (type === "person") {
        finalDataObj = { ...finalDataObj, role: staffRole, phone: staffPhone };
      }
      
      const mergedDataString = JSON.stringify(finalDataObj);
      console.log("[Matter:Save] Merged data object payload:", mergedDataString);

      // Sync quick realizations inputs into the massRecords array
      let updatedMassRecords = [...massRecords];
      const syncHelperMass = (
        itemType: string,
        itemScope: string,
        checkFn: (m: MassRecord) => boolean,
        updateFn: (m: MassRecord) => void,
        createObj: Partial<MassRecord>,
        isCleared: boolean
      ) => {
        const idx = updatedMassRecords.findIndex(checkFn);
        if (idx !== -1) {
          const existing = updatedMassRecords[idx];
          if (isCleared) {
            if (existing._status === "created") {
              updatedMassRecords.splice(idx, 1);
            } else {
              updatedMassRecords[idx] = { ...existing, _status: "deleted" };
            }
          } else {
            const next = { ...existing };
            updateFn(next);
            if (next._status !== "created") {
              next._status = "updated";
            }
            updatedMassRecords[idx] = next;
          }
        } else if (!isCleared) {
          updatedMassRecords.push({
            id: `mas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            matter: recordId,
            type: itemType,
            scope: itemScope,
            qty: null,
            value: null,
            active: 1,
            geo: null,
            start: null,
            end: null,
            data: null,
            _status: "created",
            ...createObj
          });
        }
      };

      if (type === "task") {
        syncHelperMass(
          "slot",
          "deadline",
          m => m.type === "slot" && m.scope === "deadline",
          m => { m.start = taskDeadline; },
          { start: taskDeadline },
          !taskDeadline.trim()
        );
      } else if (type === "product" || type === "food") {
        const parsedPrice = prodPrice.trim() !== "" ? parseFloat(prodPrice) : null;
        syncHelperMass(
          "price",
          "global",
          m => m.type === "price",
          m => { m.value = parsedPrice; },
          { value: parsedPrice },
          prodPrice.trim() === ""
        );
        
        const parsedStock = prodStock.trim() !== "" ? parseFloat(prodStock) : null;
        syncHelperMass(
          "stock",
          "warehouse",
          m => m.type === "stock",
          m => { m.qty = parsedStock; },
          { qty: parsedStock },
          prodStock.trim() === ""
        );
      }

      let changedFields: Record<string, any> = {};

      if (isEditing && original) {
        const orig = (v: any) => (v !== null && v !== undefined ? String(v) : "");
        if (orig(title) !== orig(original.title)) changedFields.title = title;
        if (orig(code) !== orig(original.code)) changedFields.code = code || null;
        if (orig(scope) !== orig(original.scope)) changedFields.scope = scope || null;
        if (mergedDataString !== orig(original.data)) changedFields.data = mergedDataString;
        if (orig(type) !== orig(original.type)) changedFields.type = type || null;

        if (Object.keys(changedFields).length > 0) {
          const setClauses = Object.keys(changedFields).map((k) => `${k} = ?`).join(", ");
          const setValues = Object.values(changedFields);
          console.log("[Matter:Save] Updating existing matter row with changed fields:", changedFields);
          await db.run(`UPDATE matter SET ${setClauses} WHERE id = ?`, [...setValues, recordId]);
          console.log("[Matter:Save] Database update complete.");
        } else {
          console.log("[Matter:Save] No fields changed in matter row. Skipping update.");
        }
      } else {
        const dataVal = mergedDataString && mergedDataString !== "{}" ? mergedDataString : null;
        
        const insertCols = ["id", "title", "public", "time"];
        const insertVals: any[] = [recordId, title, 0, time];
        
        if (type) {
          insertCols.push("type");
          insertVals.push(type);
        }
        if (code) {
          insertCols.push("code");
          insertVals.push(code);
        }
        if (scope) {
          insertCols.push("scope");
          insertVals.push(scope);
        }
        if (dataVal) {
          insertCols.push("data");
          insertVals.push(dataVal);
        }
        
        const placeholders = insertCols.map(() => "?").join(", ");
        console.log("[Matter:Save] Inserting new matter row with columns:", insertCols);
        await db.run(
          `INSERT INTO matter (${insertCols.join(", ")}) VALUES (${placeholders})`,
          insertVals
        );
        console.log("[Matter:Save] Database insert complete.");
      }

      // Save related Mass (Realization) records
      console.log("[Matter:Save] Synchronizing associated mass records. Count:", updatedMassRecords.length);
      for (const mass of updatedMassRecords) {
        console.log(`[Matter:Save] Syncing mass id: ${mass.id}, status: ${mass._status}`);
        if (mass._status === "created") {
          await db.run(
            `INSERT INTO mass (id, matter, type, scope, qty, value, active, geo, start, end, data, time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              mass.id,
              recordId,
              mass.type || null,
              mass.scope || null,
              mass.qty !== null && mass.qty !== undefined ? parseFloat(String(mass.qty)) : null,
              mass.value !== null && mass.value !== undefined ? parseFloat(String(mass.value)) : null,
              1,
              mass.geo || null,
              mass.start || null,
              mass.end || null,
              mass.data || null,
              time
            ]
          );
          console.log(`[Matter:Save] Mass record successfully inserted: ${mass.id}`);
        } else if (mass._status === "updated") {
          await db.run(
            `UPDATE mass 
             SET type = ?, scope = ?, qty = ?, value = ?, geo = ?, start = ?, end = ?, data = ?
             WHERE id = ?`,
            [
              mass.type || null,
              mass.scope || null,
              mass.qty !== null && mass.qty !== undefined ? parseFloat(String(mass.qty)) : null,
              mass.value !== null && mass.value !== undefined ? parseFloat(String(mass.value)) : null,
              mass.geo || null,
              mass.start || null,
              mass.end || null,
              mass.data || null,
              mass.id
            ]
          );
          console.log(`[Matter:Save] Mass record successfully updated: ${mass.id}`);
        } else if (mass._status === "deleted") {
          await db.run(
            `UPDATE mass SET active = 0 WHERE id = ?`,
            [mass.id]
          );
          console.log(`[Matter:Save] Mass record successfully marked inactive (soft deleted): ${mass.id}`);
        }
      }

      // Sync local vector representation
      console.log("[Matter:Save] Updating vector embeddings...");
      try {
        await upsertMatterVector(recordId, {
          title,
          type: type || null,
          scope: scope || null,
          code: code || null,
          data: mergedDataString || null
        });
        console.log("[Matter:Save] Vector embedding updated successfully.");
      } catch (vectorErr) {
        console.error("[Matter:Save] Vector sync failed during save:", vectorErr);
      }

      router.back();
      
      // No-op sync in local mode
    } catch (error: any) {
      console.error("[Matter:Save] Save failed:", error);
      Alert.alert("Save Error", error?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiReply(null);
    console.log("[Matter:AI] Start parsing prompt via Groq API. Input:", aiInput);

    try {
      let currentDataObj = {};
      try { currentDataObj = JSON.parse(data || "{}"); } catch {}
      const currentValues = isEditing
        ? { id: recordId, title, type, code, scope, data: currentDataObj }
        : { title, type, data: currentDataObj };

      const activeMassList = massRecords.filter(m => m._status !== "deleted").map(m => ({
        id: m.id,
        type: m.type,
        scope: m.scope,
        qty: m.qty,
        value: m.value,
        geo: m.geo,
        start: m.start,
        end: m.end,
        data: m.data
      }));

      console.log("[Matter:AI] Prompt context package:", { currentValues, activeMassList });

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [

            {
              role: "system",
              content: `You are a TAR editor. The user is ${isEditing ? "editing a matter record" : "creating a new matter record"}.
Current values: ${JSON.stringify(currentValues, null, 2)}
Associated mass (realization) records: ${JSON.stringify(activeMassList, null, 2)}

Allowed matter fields: title, type, code, scope.
${isEditing ? "NOTE: type is NOT editable (read-only)" : ""}
- Correct typos, spelling, and grammar in the user input automatically.
- To update matter fields, use "fields": { "title": "...", "code": "...", "scope": "..." }.
- To update the matter data object, use "data_updates": { "key": "value" }. This will merge with existing data, preserving keys not mentioned.
- To create, update, or delete associated mass (realization) records, use "mass_updates": [
    {
      "action": "create" | "update" | "delete",
      "id": "required-for-update-or-delete-if-matching-existing",
      "type": "type of mass (e.g. stock, price, slot)",
      "scope": "context of mass (e.g. online_store, retail, shift_morning)",
      "qty": number,
      "value": number,
      "geo": "string location",
      "start": "date string",
      "end": "date string",
      "data": { ... } or JSON string
    }
  ]. If matching an existing mass record to update or delete but ID is not known, try to identify it by scope or type, and specify the updated fields.

MODELING RULES:
- Note (pure idea): Create only matter entry (type="note").
- Task (to-do): Create matter (type="task") and a corresponding mass_update (action="create", type="slot", scope="task").
- Reminder: Create matter (type="task") and a corresponding mass_update (action="create", type="slot", scope="reminder", start="YYYY-MM-DD HH:MM:SS" when it should trigger).
- Scheduled Task (Deadline): Create matter (type="task") and a corresponding mass_update (action="create", type="slot", scope="deadline", start="YYYY-MM-DD" due date).

- Return ONLY valid JSON: { "fields": { ... }, "data_updates": { ... }, "mass_updates": [ ... ], "reply": "confirmation" }`,
            },
            { role: "user", content: aiInput },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const json = await response.json();
      const parsed = JSON.parse(json.choices[0].message.content);
      console.log("[Matter:AI] Received Groq completion output:", parsed);

      if (parsed.fields) {
        console.log("[Matter:AI] Applying field updates:", parsed.fields);
        for (const [key, value] of Object.entries(parsed.fields)) {
          if (isEditing && key === "type") continue;
          switch (key) {
            case "title": setTitle(String(value)); break;
            case "type": setType(String(value)); break;
            case "code": setCode(String(value)); break;
            case "scope": setScope(String(value)); break;
          }
        }
      }
      if (parsed.data_updates) {
        console.log("[Matter:AI] Merging custom JSON data updates:", parsed.data_updates);
        let old = {};
        try { old = JSON.parse(data || "{}"); } catch {}
        setData(JSON.stringify({ ...old, ...parsed.data_updates }));
      }

      if (parsed.mass_updates && Array.isArray(parsed.mass_updates)) {
        console.log("[Matter:AI] Applying associated mass updates:", parsed.mass_updates);
        setMassRecords(prev => {
          let updated = [...prev];
          for (const up of parsed.mass_updates) {
            if (up.action === "create") {
              updated.push({
                id: `mas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                matter: recordId,
                type: up.type || null,
                scope: up.scope || null,
                qty: up.qty !== undefined && up.qty !== null ? Number(up.qty) : null,
                value: up.value !== undefined && up.value !== null ? Number(up.value) : null,
                active: 1,
                geo: up.geo || null,
                start: up.start || null,
                end: up.end || null,
                data: up.data ? (typeof up.data === "object" ? JSON.stringify(up.data) : String(up.data)) : null,
                _status: "created"
              });
            } else if (up.action === "update") {
              let index = -1;
              if (up.id) {
                index = updated.findIndex(m => m.id === up.id);
              } else {
                index = updated.findIndex(m => m.scope === up.scope || m.type === up.type);
              }

              if (index !== -1) {
                const existing = updated[index];
                updated[index] = {
                  ...existing,
                  type: up.type !== undefined ? up.type : existing.type,
                  scope: up.scope !== undefined ? up.scope : existing.scope,
                  qty: up.qty !== undefined && up.qty !== null ? Number(up.qty) : existing.qty,
                  value: up.value !== undefined && up.value !== null ? Number(up.value) : existing.value,
                  geo: up.geo !== undefined ? up.geo : existing.geo,
                  start: up.start !== undefined ? up.start : existing.start,
                  end: up.end !== undefined ? up.end : existing.end,
                  data: up.data !== undefined ? (typeof up.data === "object" ? JSON.stringify(up.data) : String(up.data)) : existing.data,
                  _status: existing._status === "created" ? "created" : "updated"
                };
              }
            } else if (up.action === "delete") {
              let index = -1;
              if (up.id) {
                index = updated.findIndex(m => m.id === up.id);
              } else {
                index = updated.findIndex(m => m.scope === up.scope || m.type === up.type);
              }

              if (index !== -1) {
                const existing = updated[index];
                if (existing._status === "created") {
                  updated.splice(index, 1);
                } else {
                  updated[index] = { ...existing, _status: "deleted" };
                }
              }
            }
          }
          return updated;
        });
      }

      setAiReply(parsed.reply || "Done.");
      setAiInput("");
      console.log("[Matter:AI] AI parsing complete and state successfully updated.");
    } catch (error) {
      console.error("[Matter:AI] Groq API Error:", error);
      setAiReply("Sorry, I couldn't process that.");
    }   finally {
      setAiLoading(false);
    }
  };

  const updateDataField = (key: string, newVal: any) => {
    try {
      const current = JSON.parse(data || "{}");
      current[key] = newVal;
      setData(JSON.stringify(current));
    } catch {}
  };

  // Mass inline editing methods
  const startEditMass = (m: MassRecord) => {
    setEditingMassId(m.id);
    setMassType(m.type || "");
    setMassScope(m.scope || "");
    setMassQty(m.qty !== null ? String(m.qty) : "");
    setMassValue(m.value !== null ? String(m.value) : "");
    setMassGeo(m.geo || "");
    setMassStart(m.start || "");
    setMassEnd(m.end || "");
    setMassData(m.data || "");
    setShowMassForm(true);
  };

  const cancelMassEdit = () => {
    setEditingMassId(null);
    setMassType("");
    setMassScope("");
    setMassQty("");
    setMassValue("");
    setMassGeo("");
    setMassStart("");
    setMassEnd("");
    setMassData("");
    setShowMassForm(false);
  };

  const saveMassForm = () => {
    if (!massScope && !massType) {
      Alert.alert("Validation", "Either Scope or Type is required for a realization.");
      return;
    }

    const qtyNum = massQty.trim() !== "" ? parseFloat(massQty) : null;
    const valNum = massValue.trim() !== "" ? parseFloat(massValue) : null;

    if (editingMassId) {
      setMassRecords(prev => prev.map(m => {
        if (m.id === editingMassId) {
          return {
            ...m,
            type: massType || null,
            scope: massScope || null,
            qty: qtyNum,
            value: valNum,
            geo: massGeo || null,
            start: massStart || null,
            end: massEnd || null,
            data: massData || null,
            _status: m._status === "created" ? "created" : "updated"
          };
        }
        return m;
      }));
    } else {
      const newMass: MassRecord = {
        id: `mas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        matter: recordId,
        type: massType || null,
        scope: massScope || null,
        qty: qtyNum,
        value: valNum,
        active: 1,
        geo: massGeo || null,
        start: massStart || null,
        end: massEnd || null,
        data: massData || null,
        _status: "created"
      };
      setMassRecords(prev => [...prev, newMass]);
    }
    cancelMassEdit();
  };

  const handleDeleteMass = (massId: string) => {
    setMassRecords(prev => {
      const item = prev.find(m => m.id === massId);
      if (item && item._status === "created") {
        return prev.filter(m => m.id !== massId);
      }
      return prev.map(m => m.id === massId ? { ...m, _status: "deleted" } : m);
    });
  };

  const renderDataList = () => {
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(data || "{}"); } catch {}
    const keys = Object.keys(parsed);

    if (keys.length === 0) return null;

    return (
      <View style={styles.dataContainer}>
        {Object.entries(parsed).map(([key, val], idx, arr) => {
          const isPrimitive = val === null || typeof val !== "object";
          return (
            <React.Fragment key={key}>
              <SwipeablePropertyRow
                itemKey={key}
                val={val}
                isPrimitive={isPrimitive}
                onUpdate={(v) => updateDataField(key, v)}
                onRenameKey={(newKey) => {
                  const updated = { ...parsed };
                  const temp = updated[key];
                  delete updated[key];
                  updated[newKey] = temp;
                  setData(JSON.stringify(updated));
                }}
                onDelete={() => {
                  const updated = { ...parsed };
                  delete updated[key];
                  setData(JSON.stringify(updated));
                }}
              />
              {idx < arr.length - 1 && <View style={styles.dataDivider} />}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  const renderMassSection = () => {
    const activeMass = massRecords.filter(m => m._status !== "deleted");

    return (
      <View style={styles.massSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Realizations (Mass)</Text>
          <TouchableOpacity 
            style={styles.addMassBtn} 
            onPress={() => {
              setEditingMassId(null);
              setMassType("");
              setMassScope("");
              setMassQty("");
              setMassValue("");
              setMassGeo("");
              setMassStart("");
              setMassEnd("");
              setMassData("");
              setShowMassForm(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#6366f1" />
            <Text style={styles.addMassBtnText}>Add Realization</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showMassForm}
          animationType="slide"
          transparent={false}
          onRequestClose={cancelMassEdit}
        >
          <View style={[styles.posSheetContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* POS Top Header Bar */}
            <View style={styles.posHeader}>
              <TouchableOpacity onPress={cancelMassEdit} style={styles.posHeaderCancel}>
                <Ionicons name="close-outline" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.posHeaderTitle}>
                {editingMassId ? "Edit Realization" : "Add Realization"}
              </Text>
              <TouchableOpacity onPress={saveMassForm} style={styles.posHeaderSave}>
                <Text style={styles.posHeaderSaveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.posFormScroll}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.smallLabel}>Scope</Text>
                  <TextInput
                    style={styles.formInput}
                    value={massScope}
                    onChangeText={setMassScope}
                    placeholder="Scope"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smallLabel}>Type</Text>
                  <TextInput
                    style={styles.formInput}
                    value={massType}
                    onChangeText={setMassType}
                    placeholder="Type"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* Quantity Stepper */}
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.smallLabel}>Quantity</Text>
                <View style={styles.qtyCounterContainer}>
                  <TouchableOpacity 
                    style={styles.qtyCounterBtn}
                    onPress={() => {
                      const current = parseFloat(massQty) || 0;
                      if (current > 0) {
                        setMassQty(String(Math.max(0, current - 1)));
                      }
                    }}
                  >
                    <Ionicons name="remove-outline" size={20} color="#1e293b" />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={styles.qtyCounterInput}
                    value={massQty}
                    onChangeText={setMassQty}
                    keyboardType="numeric"
                    textAlign="center"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                  />

                  <TouchableOpacity 
                    style={styles.qtyCounterBtn}
                    onPress={() => {
                      const current = parseFloat(massQty) || 0;
                      setMassQty(String(current + 1));
                    }}
                  >
                    <Ionicons name="add-outline" size={20} color="#1e293b" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={styles.smallLabel}>Value</Text>
                <TextInput
                  style={styles.formInput}
                  value={massValue}
                  onChangeText={setMassValue}
                  placeholder="Value"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={styles.smallLabel}>Location</Text>
                <TextInput
                  style={styles.formInput}
                  value={massGeo}
                  onChangeText={setMassGeo}
                  placeholder="Location"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.smallLabel}>Start Date</Text>
                  <TextInput
                    style={styles.formInput}
                    value={massStart}
                    onChangeText={setMassStart}
                    placeholder="Start Date"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smallLabel}>End Date</Text>
                  <TextInput
                    style={styles.formInput}
                    value={massEnd}
                    onChangeText={setMassEnd}
                    placeholder="End Date"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={styles.smallLabel}>JSON Data</Text>
                <TextInput
                  style={[styles.formInput, { height: 70, textAlignVertical: "top" }]}
                  value={massData}
                  onChangeText={setMassData}
                  placeholder="JSON Data"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
              </View>
            </ScrollView>
          </View>
        </Modal>

        {activeMass.length === 0 ? null : (
          <View style={styles.massList}>
            {activeMass.map((m) => (
              <View key={m.id} style={styles.massCard}>
                <View style={styles.massCardHeader}>
                  <View style={styles.massBadges}>
                    {m.scope ? (
                      <View style={styles.massScopeBadge}>
                        <Text style={styles.massScopeBadgeText}>{m.scope}</Text>
                      </View>
                    ) : null}
                    {m.type ? (
                      <View style={styles.massTypeBadge}>
                        <Text style={styles.massTypeBadgeText}>{m.type}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.massCardActions}>
                    <TouchableOpacity onPress={() => startEditMass(m)} style={styles.massIconBtn}>
                      <Ionicons name="pencil-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteMass(m.id)} style={styles.massIconBtn}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.massDetailsGrid}>
                  {m.qty !== null && m.qty !== undefined ? (
                    <View style={styles.massDetailItem}>
                      <Ionicons name="cube-outline" size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                      <Text style={styles.massDetailVal}>{m.qty} qty</Text>
                    </View>
                  ) : null}
                  {m.value !== null && m.value !== undefined ? (
                    <View style={styles.massDetailItem}>
                      <Ionicons name="cash-outline" size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                      <Text style={styles.massDetailVal}>₹{m.value}</Text>
                    </View>
                  ) : null}
                  {m.geo ? (
                    <View style={styles.massDetailItem}>
                      <Ionicons name="location-outline" size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                      <Text style={styles.massDetailVal} numberOfLines={1}>{m.geo}</Text>
                    </View>
                  ) : null}
                  {m.start || m.end ? (
                    <View style={styles.massDetailItem}>
                      <Ionicons name="calendar-outline" size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                      <Text style={styles.massDetailVal} numberOfLines={1}>
                        {m.start || ""} {m.end ? `to ${m.end}` : ""}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {m.data && m.data !== "{}" ? (
                  <View style={styles.massDataSnippet}>
                    <Text style={styles.massDataSnippetText} numberOfLines={1}>
                      {m.data}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderDynamicFormFields = () => {
    switch (type) {
      case "note":
        return (
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Note Content</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.smallLabel}>Body</Text>
              <TextInput
                style={[styles.formInput, { height: 100, textAlignVertical: "top" }]}
                value={noteBody}
                onChangeText={setNoteBody}
                placeholder="Type note details..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
          </View>
        );
      case "task":
        return (
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Task Specifications</Text>
            
            <View style={styles.fieldGroup}>
              <Text style={styles.smallLabel}>Priority</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                {["low", "medium", "high"].map((p) => {
                  const active = taskPriority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setTaskPriority(p)}
                      style={[
                        styles.typeTag,
                        active && { backgroundColor: "#10b981", borderColor: "#10b981" }
                      ]}
                    >
                      <Text style={[styles.typeTagText, active && { color: "#fff" }]}>
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.smallLabel}>Deadline (Due Date)</Text>
              <TextInput
                style={styles.formInput}
                value={taskDeadline}
                onChangeText={setTaskDeadline}
                placeholder="YYYY-MM-DD (e.g. 2026-05-30)"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        );
      case "product":
      case "food":
        return (
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Product Specifications</Text>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.smallLabel}>SKU / Code</Text>
                <TextInput
                  style={styles.formInput}
                  value={code}
                  onChangeText={setCode}
                  placeholder="e.g. BIRYANI"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Scope</Text>
                <TextInput
                  style={styles.formInput}
                  value={scope}
                  onChangeText={setScope}
                  placeholder="e.g. global"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.smallLabel}>Selling Price (₹)</Text>
                <TextInput
                  style={styles.formInput}
                  value={prodPrice}
                  onChangeText={setProdPrice}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Stock Qty</Text>
                <TextInput
                  style={styles.formInput}
                  value={prodStock}
                  onChangeText={setProdStock}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        );
      case "store":
        return (
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Location Specifications</Text>
            
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.smallLabel}>Branch Code</Text>
                <TextInput
                  style={styles.formInput}
                  value={code}
                  onChangeText={setCode}
                  placeholder="e.g. ADYAR"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Scope</Text>
                <TextInput
                  style={styles.formInput}
                  value={scope}
                  onChangeText={setScope}
                  placeholder="e.g. retail"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.smallLabel}>Address</Text>
              <TextInput
                style={[styles.formInput, { height: 60, textAlignVertical: "top" }]}
                value={storeAddress}
                onChangeText={setStoreAddress}
                placeholder="Full address details..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
          </View>
        );
      case "person":
        return (
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Personal Info / Role</Text>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.smallLabel}>ID Code</Text>
                <TextInput
                  style={styles.formInput}
                  value={code}
                  onChangeText={setCode}
                  placeholder="e.g. STAFF_1"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Scope</Text>
                <TextInput
                  style={styles.formInput}
                  value={scope}
                  onChangeText={setScope}
                  placeholder="e.g. retail"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.smallLabel}>Role</Text>
                <TextInput
                  style={styles.formInput}
                  value={staffRole}
                  onChangeText={setStaffRole}
                  placeholder="e.g. chef, cashier, customer"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Phone</Text>
                <TextInput
                  style={styles.formInput}
                  value={staffPhone}
                  onChangeText={setStaffPhone}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 100 }} />
      </View>
    );
  }

  // Type selection screen for new Matter records
  if (!isEditing && !type) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={styles.selectorHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
              <Ionicons name="close-outline" size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.selectorHeaderTitle}>New Record</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView contentContainerStyle={styles.selectorContent}>
            <Text style={styles.selectorTitle}>What are you creating?</Text>
            <Text style={styles.selectorSubtitle}>Choose a type to load the custom form layout</Text>
            
            <View style={styles.selectorGrid}>
              <TouchableOpacity style={styles.selectorCard} onPress={() => { setType("note"); setScope("personal"); }}>
                <View style={[styles.selectorIconBg, { backgroundColor: "#e0e7ff" }]}>
                  <Ionicons name="document-text" size={28} color="#4f46e5" />
                </View>
                <View style={styles.selectorCardText}>
                  <Text style={styles.selectorCardTitle}>Note</Text>
                  <Text style={styles.selectorCardDesc}>Personal notes, recipes, and text captures</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.selectorCard} onPress={() => { setType("task"); setScope("personal"); }}>
                <View style={[styles.selectorIconBg, { backgroundColor: "#d1fae5" }]}>
                  <Ionicons name="checkbox" size={28} color="#059669" />
                </View>
                <View style={styles.selectorCardText}>
                  <Text style={styles.selectorCardTitle}>Task</Text>
                  <Text style={styles.selectorCardDesc}>Actionable checklist items and deadlines</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.selectorCard} onPress={() => { setType("product"); setScope("global"); }}>
                <View style={[styles.selectorIconBg, { backgroundColor: "#dbeafe" }]}>
                  <Ionicons name="cube" size={28} color="#2563eb" />
                </View>
                <View style={styles.selectorCardText}>
                  <Text style={styles.selectorCardTitle}>Product</Text>
                  <Text style={styles.selectorCardDesc}>Menu items, physical products, and goods</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.selectorCard} onPress={() => { setType("store"); setScope("global"); }}>
                <View style={[styles.selectorIconBg, { backgroundColor: "#fef3c7" }]}>
                  <Ionicons name="business" size={28} color="#d97706" />
                </View>
                <View style={styles.selectorCardText}>
                  <Text style={styles.selectorCardTitle}>Location</Text>
                  <Text style={styles.selectorCardDesc}>Stores, warehouses, and outlet branches</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.selectorCard} onPress={() => { setType("person"); setScope("retail"); }}>
                <View style={[styles.selectorIconBg, { backgroundColor: "#fce7f3" }]}>
                  <Ionicons name="people" size={28} color="#db2777" />
                </View>
                <View style={styles.selectorCardText}>
                  <Text style={styles.selectorCardTitle}>Person</Text>
                  <Text style={styles.selectorCardDesc}>Staff employees, customers, and suppliers</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />

      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderTags}>
              {type ? (
                <View style={styles.typeTag}>
                  <Text style={styles.typeTagText}>{type}</Text>
                </View>
              ) : null}
              {code ? (
                <View style={[styles.typeTag, { backgroundColor: "#fff" }]}>
                  <Text style={[styles.typeTagText, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>{code}</Text>
                </View>
              ) : null}
              {scope ? (
                <View style={styles.scopeTag}>
                  <Text style={styles.scopeTagText}>{scope}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {isDraft && (
                <TouchableOpacity onPress={handlePublish} disabled={publishing} style={[styles.detailSaveBtn, { marginRight: 8 }]}>
                  {publishing ? <ActivityIndicator size="small" color="#16a34a" /> : <Text style={[styles.detailSaveText, { color: "#16a34a" }]}>Publish</Text>}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.detailSaveBtn}>
                {saving ? <ActivityIndicator size="small" color="#6366f1" /> : <Text style={styles.detailSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Untitled"
              placeholderTextColor="#cbd5e1"
              multiline
            />

            {/* Custom Dynamic Form Fields based on chosen Type */}
            {renderDynamicFormFields()}

            {/* Attributes entered through AI (represented as tags at top bar) */}
            {renderDataList()}

            {renderMassSection()}

            <View style={{ height: 120 }} />
          </ScrollView>
        </SafeAreaView>

        {aiReply && (
          <View style={styles.minimalReplyContainer}>
            <Text style={styles.minimalReplyText}>{aiReply}</Text>
          </View>
        )}

        <View style={[styles.aiBar, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
          <View style={styles.aiInputRow}>
            <TextInput
              style={styles.aiInput}
              placeholder="Ask AI..."
              placeholderTextColor="#94a3b8"
              value={aiInput}
              onChangeText={setAiInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.aiSendBtn, (!aiInput.trim() || aiLoading) && styles.aiSendBtnDisabled]}
              onPress={handleAiSend}
              disabled={!aiInput.trim() || aiLoading}
            >
              {aiLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  safeArea: { flex: 1 },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  detailHeaderTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 4,
    flexShrink: 1,
  },
  detailSaveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  detailSaveText: { fontSize: 15, fontWeight: "600", color: "#6366f1" },

  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  badgeMatter: { backgroundColor: "#e0e7ff" },
  badgeMass: { backgroundColor: "#fce7f3" },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: "#1e293b" },
  typeTag: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  typeTagText: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  scopeTag: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
  },
  scopeTagText: { fontSize: 11, fontWeight: "600", color: "#b45309" },

  detailScroll: { flex: 1 },
  detailContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  titleInput: {
    fontSize: 22, fontWeight: "700", color: "#0f172a",
    lineHeight: 30, paddingVertical: 4, paddingHorizontal: 0, marginBottom: 12,
  },
  codeSubtitle: {
    fontSize: 13, fontWeight: "500", color: "#94a3b8", marginBottom: 24,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 10, fontWeight: "600", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4,
  },
  fieldInput: {
    borderBottomWidth: 1, borderBottomColor: "#cbd5e1",
    paddingHorizontal: 0, paddingVertical: 4, fontSize: 14, color: "#1e293b",
  },

  dataContainer: { marginBottom: 20 },
  dataRow: { paddingVertical: 10 },
  dataKey: {
    fontSize: 11, fontWeight: "600", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
  },
  dataValue: { fontSize: 15, color: "#1e293b", paddingVertical: 2, paddingHorizontal: 0 },
  dataRawValue: {
    fontSize: 13, color: "#64748b", paddingVertical: 2, paddingHorizontal: 0,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  dataDivider: { height: 1, backgroundColor: "#f1f5f9" },

  minimalReplyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  minimalReplyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },

  aiBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f1f5f9",
  },
  aiInputRow: { flexDirection: "row", alignItems: "center" },
  aiInput: {
    flex: 1, backgroundColor: "#f1f5f9", borderRadius: 24,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: "#1e293b", maxHeight: 80,
  },
  aiSendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#1e293b",
    justifyContent: "center", alignItems: "center", marginLeft: 10,
  },
  aiSendBtnDisabled: { backgroundColor: "#cbd5e1" },

  // Realizations (Mass) styles
  massSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  addMassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addMassBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366f1",
  },
  emptyMassText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    lineHeight: 18,
    paddingVertical: 12,
  },
  massList: {
    gap: 12,
  },
  massCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  massCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  massBadges: {
    flexDirection: "row",
    gap: 6,
  },
  massScopeBadge: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  massScopeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#b45309",
  },
  massTypeBadge: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  massTypeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  massCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  massIconBtn: {
    padding: 4,
  },
  massDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 6,
  },
  massDetailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  massDetailVal: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475569",
  },
  massDataSnippet: {
    backgroundColor: "#f1f5f9",
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  massDataSnippetText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#64748b",
  },
  
  // Inline Form styles
  massFormCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  formRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
    marginTop: 4,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  formCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  formCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  formSaveBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  formSaveBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  
  emptyPropertiesText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 18,
  },
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 20,
  },
  swipeableContent: {
    backgroundColor: "#fff",
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  bottomSheetDismissZone: {
    flex: 1,
  },
  bottomSheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "80%",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#cbd5e1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
    textAlign: "center",
  },
  posSheetContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  posHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
  },
  posHeaderCancel: {
    padding: 8,
    marginLeft: -8,
  },
  posHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  posHeaderSave: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  posHeaderSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  posFormScroll: {
    flex: 1,
  },
  qtyCounterContainer: {
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
  qtyCounterBtn: {
    width: 50,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
  },
  qtyCounterInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    padding: 0,
  },
  dataKeyInput: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    padding: 0,
  },
  nestedTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  nestedTableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nestedTableKeyInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    padding: 0,
  },
  nestedTableValue: {
    flex: 1.2,
    fontSize: 14,
    color: "#1e293b",
    padding: 0,
    fontWeight: "500",
  },
  nestedTableRawValue: {
    flex: 1.2,
    fontSize: 13,
    color: "#94a3b8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  
  // Selector Screen Styles
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    height: 52,
  },
  selectorHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  selectorContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  selectorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  selectorSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 28,
    lineHeight: 20,
  },
  selectorGrid: {
    gap: 16,
  },
  selectorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
  },
  selectorIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  selectorCardText: {
    flex: 1,
  },
  selectorCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  selectorCardDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },
  formSection: {
    marginTop: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  headerBack: {
    padding: 8,
    marginLeft: -8,
  },
});
