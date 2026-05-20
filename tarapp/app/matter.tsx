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
  Keyboard
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient } from "../lib/db";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const MODEL = "openai/gpt-oss-120b";

const genId = () => `mat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export default function MatterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: editId } = useLocalSearchParams<{ id: string }>();
  const isEditing = !!editId;

  const [recordId, setRecordId] = useState(genId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("");
  const [data, setData] = useState("{}");
  const [original, setOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
    (async () => {
      try {
        const db = getDbClient();
        const rows = await db.all("SELECT * FROM matter WHERE id = ?", [editId]);
        if (Array.isArray(rows) && rows.length > 0) {
          const rec: any = rows[0];
          setOriginal(rec);
          setRecordId(String(rec.id ?? ""));
          setTitle(String(rec.title ?? ""));
          setType(String(rec.type ?? ""));
          setCode(String(rec.code ?? ""));
          setScope(String(rec.scope ?? ""));
          setData(String(rec.data ?? "{}"));
        } else {
          Alert.alert("Error", "Record not found.");
          router.back();
        }
      } catch (e) {
        console.error("Failed to load matter:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  const handleSave = async () => {
    if (!title) {
      Alert.alert("Error", "Title is required");
      return;
    }
    setSaving(true);
    try {
      const db = getDbClient();
      const time = new Date().toISOString();

      let changedFields: Record<string, any> = {};

      if (isEditing && original) {
        const orig = (v: any) => (v !== null && v !== undefined ? String(v) : "");
        if (orig(title) !== orig(original.title)) changedFields.title = title;
        if (orig(code) !== orig(original.code)) changedFields.code = code || null;
        if (orig(scope) !== orig(original.scope)) changedFields.scope = scope || null;
        if (orig(data) !== orig(original.data)) changedFields.data = data;

        if (Object.keys(changedFields).length === 0) {
          Alert.alert("No changes", "No fields were modified.");
          setSaving(false);
          return;
        }

        const setClauses = Object.keys(changedFields).map((k) => `${k} = ?`).join(", ");
        const setValues = Object.values(changedFields);
        await db.run(`UPDATE matter SET ${setClauses} WHERE id = ?`, [...setValues, recordId]);
      } else {
        const dataVal = data && data !== "{}" ? data : null;
        
        const insertCols = ["id", "title", "public", "time"];
        const insertVals: any[] = [recordId, title, 0, time];
        
        if (type) {
          insertCols.push("type");
          insertVals.push(type);
          changedFields.type = type;
        }
        if (code) {
          insertCols.push("code");
          insertVals.push(code);
          changedFields.code = code;
        }
        if (scope) {
          insertCols.push("scope");
          insertVals.push(scope);
          changedFields.scope = scope;
        }
        if (dataVal) {
          insertCols.push("data");
          insertVals.push(dataVal);
          changedFields.data = dataVal;
        }
        
        const placeholders = insertCols.map(() => "?").join(", ");
        await db.run(
          `INSERT INTO matter (${insertCols.join(", ")}) VALUES (${placeholders})`,
          insertVals
        );
      }

      router.back();
      
      try {
        if (db.isSync) {
          db.push().catch((err: any) => console.error("Background sync failed:", err));
        }
      } catch(e) {}
    } catch (error: any) {
      console.error("Save failed:", error);
      Alert.alert("Save Error", error?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiReply(null);
    try {
      let currentDataObj = {};
      try { currentDataObj = JSON.parse(data || "{}"); } catch {}
      const currentValues = isEditing
        ? { id: recordId, title, type, code, scope, data: currentDataObj }
        : { title, type, data: currentDataObj };

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

Allowed fields: title, type, code, scope.
${isEditing ? "NOTE: type is NOT editable (read-only)" : ""}
- Correct typos, spelling, and grammar in the user input automatically (e.g. "mall" -> "small", "lodge" -> "large").
- To update standard fields, use "fields": { "title": "..." }
- To update the data object, use "data_updates": { "key": "value" }. This will merge with existing data, preserving keys not mentioned.
- Return ONLY valid JSON: { "fields": { ... }, "data_updates": { ... }, "reply": "confirmation" }`,
            },
            { role: "user", content: aiInput },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const json = await response.json();
      const parsed = JSON.parse(json.choices[0].message.content);

      if (parsed.fields) {
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
        let old = {};
        try { old = JSON.parse(data || "{}"); } catch {}
        setData(JSON.stringify({ ...old, ...parsed.data_updates }));
      }
      setAiReply(parsed.reply || "Done.");
      setAiInput("");
    } catch (error) {
      console.error("Groq API Error:", error);
      setAiReply("Sorry, I couldn't process that.");
    } finally {
      setAiLoading(false);
    }
  };

  const updateDataField = (key: string, newVal: string) => {
    try {
      const current = JSON.parse(data || "{}");
      current[key] = newVal;
      setData(JSON.stringify(current));
    } catch {}
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
              <View style={styles.dataRow}>
                <Text style={styles.dataKey}>{key.replace(/_/g, " ")}</Text>
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
                    onChangeText={(v) => updateDataField(key, v)}
                    placeholderTextColor="#94a3b8"
                    multiline={String(val).length > 30}
                  />
                ) : (
                  <Text style={styles.dataRawValue}>{JSON.stringify(val)}</Text>
                )}
              </View>
              {idx < arr.length - 1 && <View style={styles.dataDivider} />}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 100 }} />
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
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.detailSaveBtn}>
              {saving ? <ActivityIndicator size="small" color="#6366f1" /> : <Text style={styles.detailSaveText}>Save</Text>}
            </TouchableOpacity>
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

            {renderDataList()}



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
              placeholder={isEditing ? 'Try "change code" or "add data field"' : 'Try "set type to product"'}
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
    lineHeight: 30, paddingVertical: 4, paddingHorizontal: 0, marginBottom: 4,
  },
  codeSubtitle: {
    fontSize: 13, fontWeight: "500", color: "#94a3b8", marginBottom: 24,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 11, fontWeight: "600", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6,
  },
  fieldInput: {
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
    paddingHorizontal: 0, paddingVertical: 8, fontSize: 15, color: "#1e293b",
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
});
