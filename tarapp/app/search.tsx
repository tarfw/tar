import React, { useState, useEffect, useCallback } from "react";
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
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient, getUserDb, getTenantDb, getGlobalDb } from "../lib/db";
import { setActiveMassId } from "../lib/state";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const MODEL = "openai/gpt-oss-120b";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  code: "Code",
  type: "Type",
  data: "Data (JSON)",
  qty: "Quantity",
  value: "Value",
  geo: "Geo Location",
  start: "Start Time",
  end: "End Time",
};

const NUMERIC_FIELDS = new Set(["qty", "value"]);
const MULTILINE_FIELDS = new Set(["data"]);
const READ_ONLY_FIELDS = new Set(["type"]);

const MATTER_FIELDS = ["title", "data"];
const MASS_FIELDS = ["qty", "value", "geo", "start", "end", "data"];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    matter: any[];
    mass: any[];
    motion: any[];
  }>({ matter: [], mass: [], motion: [] });
  const [loading, setLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState<{
    type: "matter" | "mass";
    data: any;
    editFields: Record<string, string>;
  } | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [types, setTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const performSearch = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const uDb = getUserDb();
      const tDb = getTenantDb();
      const gDb = getGlobalDb();

      const hasQuery = text.trim().length > 0;
      const searchTerm = `%${text}%`;
      const fuzzyTerm = text.length > 1 ? `%${text.split("").join("%")}%` : searchTerm;

      const matterTypeClause = selectedType ? "AND type = ?" : "";
      const matterWhereClause = hasQuery
        ? "WHERE title LIKE ? OR title LIKE ? OR code LIKE ? OR code LIKE ? OR data LIKE ? OR type LIKE ?"
        : "WHERE 1=1";

      const matterParams: any[] = hasQuery
        ? [searchTerm, fuzzyTerm, searchTerm, fuzzyTerm, searchTerm, searchTerm]
        : [];
      if (selectedType) matterParams.push(selectedType);

      const [uMatter, tMatter, gMatter] = await Promise.all([
        uDb.all(`SELECT *, 'user' as originDb FROM matter ${matterWhereClause} ${matterTypeClause} LIMIT 10`, matterParams).catch(() => []),
        tDb.all(`SELECT *, 'tenant' as originDb FROM matter ${matterWhereClause} ${matterTypeClause} LIMIT 10`, matterParams).catch(() => []),
        gDb.all(`SELECT *, 'global' as originDb FROM matter ${matterWhereClause} ${matterTypeClause} LIMIT 10`, matterParams).catch(() => [])
      ]);

      const massTypeClause = selectedType ? "AND m.type = ?" : "";
      const massWhereClause = hasQuery
        ? "WHERE m.data LIKE ? OR m.type LIKE ? OR t.title LIKE ? OR t.title LIKE ?"
        : "WHERE 1=1";

      const massParams: any[] = hasQuery
        ? [searchTerm, searchTerm, searchTerm, fuzzyTerm]
        : [];
      if (selectedType) massParams.push(selectedType);

      const [uMass, tMass, gMass] = await Promise.all([
        uDb.all(`
          SELECT m.*, t.title as matter_title, 'user' as originDb
          FROM mass m
          LEFT JOIN matter t ON m.matter = t.id
          ${massWhereClause} ${massTypeClause}
          LIMIT 10
        `, massParams).catch(() => []),
        tDb.all(`
          SELECT m.*, t.title as matter_title, 'tenant' as originDb
          FROM mass m
          LEFT JOIN matter t ON m.matter = t.id
          ${massWhereClause} ${massTypeClause}
          LIMIT 10
        `, massParams).catch(() => []),
        gDb.all(`
          SELECT m.*, t.title as matter_title, 'global' as originDb
          FROM mass m
          LEFT JOIN matter t ON m.matter = t.id
          ${massWhereClause} ${massTypeClause}
          LIMIT 10
        `, massParams).catch(() => [])
      ]);

      const motionWhereClause = hasQuery
        ? "WHERE data LIKE ? OR stream LIKE ?"
        : "WHERE 1=1";
      const motionParams = hasQuery ? [searchTerm, searchTerm] : [];

      const [uMotion, tMotion, gMotion] = await Promise.all([
        uDb.all(`SELECT *, 'user' as originDb FROM motion ${motionWhereClause} LIMIT 10`, motionParams).catch(() => []),
        tDb.all(`SELECT *, 'tenant' as originDb FROM motion ${motionWhereClause} LIMIT 10`, motionParams).catch(() => []),
        gDb.all(`SELECT *, 'global' as originDb FROM motion ${motionWhereClause} LIMIT 10`, motionParams).catch(() => [])
      ]);

      const deduplicateById = (arr: any[]) => {
        const seen = new Set();
        return arr.filter((item) => {
          if (!item.id) return true;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      setResults({
        matter: deduplicateById([...(uMatter || []), ...(tMatter || []), ...(gMatter || [])]).slice(0, 15),
        mass: deduplicateById([...(uMass || []), ...(tMass || []), ...(gMass || [])]).slice(0, 15),
        motion: deduplicateById([...(uMotion || []), ...(tMotion || []), ...(gMotion || [])]).slice(0, 15),
      });
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    (async () => {
      try {
        const uDb = getUserDb();
        const tDb = getTenantDb();
        const gDb = getGlobalDb();

        const [uMatterTypes, tMatterTypes, gMatterTypes, uMassTypes, tMassTypes, gMassTypes] = await Promise.all([
          uDb.all("SELECT DISTINCT type FROM matter WHERE type IS NOT NULL AND type != ''").catch(() => []),
          tDb.all("SELECT DISTINCT type FROM matter WHERE type IS NOT NULL AND type != ''").catch(() => []),
          gDb.all("SELECT DISTINCT type FROM matter WHERE type IS NOT NULL AND type != ''").catch(() => []),
          uDb.all("SELECT DISTINCT type FROM mass WHERE type IS NOT NULL AND type != ''").catch(() => []),
          tDb.all("SELECT DISTINCT type FROM mass WHERE type IS NOT NULL AND type != ''").catch(() => []),
          gDb.all("SELECT DISTINCT type FROM mass WHERE type IS NOT NULL AND type != ''").catch(() => []),
        ]);

        const all = new Set<string>();
        const rows = [
          ...(uMatterTypes || []),
          ...(tMatterTypes || []),
          ...(gMatterTypes || []),
          ...(uMassTypes || []),
          ...(tMassTypes || []),
          ...(gMassTypes || [])
        ];
        for (const row of rows) {
          if (row.type) all.add(String(row.type));
        }
        setTypes(Array.from(all).sort());
      } catch (e) {
        console.error("Failed to fetch types:", e);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const selectItem = (type: "matter" | "mass", data: any) => {
    const fields = type === "matter" ? MATTER_FIELDS : MASS_FIELDS;
    const editFields: Record<string, string> = {};
    for (const field of fields) {
      const val = data[field];
      editFields[field] = val !== null && val !== undefined ? String(val) : "";
    }
    setSelectedItem({ type, data, editFields });
    setAiReply(null);
    setAiInput("");
    if (type === "mass") {
      setActiveMassId(data.id);
    }
  };

  const closeDetail = () => {
    Keyboard.dismiss();
    setSelectedItem(null);
    setAiReply(null);
    setAiInput("");
    setActiveMassId(null);
  };

  const handleAiSend = async () => {
    if (!aiInput.trim() || !selectedItem) return;

    setAiLoading(true);
    setAiReply(null);

    try {
      const { type, data, editFields } = selectedItem;
      const currentValues = { ...data, ...editFields };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: `You are a TAR database editor. The user selected a ${type} record.
Current values: ${JSON.stringify(currentValues, null, 2)}

Allowed fields for ${type}:
${type === "matter" ? "- Editable in UI: title, data | Also editable via AI: code, scope" : "- Editable in UI: qty, value, geo, start, end, data | Also editable via AI: scope"}
NOTE: type is NOT editable (read-only)

Map the user's natural language request to field updates.
- qty and value should be number strings (e.g. "50")
- data is a JSON string
- start and end are ISO timestamp strings

Return ONLY valid JSON (no markdown):
{ "fields": { "field_name": "new_value" }, "reply": "short confirmation message" }

If no fields need changing, return: { "fields": {}, "reply": "explanation why" }`,
            },
            { role: "user", content: aiInput },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const json = await response.json();
      const content = json.choices[0].message.content;
      const parsed = JSON.parse(content);

      if (parsed.fields && Object.keys(parsed.fields).length > 0) {
        setSelectedItem((prev) => {
          if (!prev) return prev;
          const newFields = { ...prev.editFields };
          for (const [key, value] of Object.entries(parsed.fields)) {
            if (READ_ONLY_FIELDS.has(key)) continue;
            newFields[key] = String(value);
          }
          return { ...prev, editFields: newFields };
        });
      }

      setAiReply(parsed.reply || "Done.");
      setAiInput("");
    } catch (error) {
      console.error("Groq API Error:", error);
      setAiReply("Sorry, I couldn't process that. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);

    try {
      const { type, data, editFields } = selectedItem;
      const originDb = data.originDb || "tenant";
      const db = originDb === "user" ? getUserDb() : originDb === "global" ? getGlobalDb() : getTenantDb();

      const changedFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(editFields)) {
        if (READ_ONLY_FIELDS.has(key)) continue;
        const original = data[key] !== null && data[key] !== undefined ? String(data[key]) : "";
        if (value !== original) {
          changedFields[key] = value;
        }
      }

      if (Object.keys(changedFields).length === 0) {
        Alert.alert("No changes", "No fields were modified.");
        setSaving(false);
        return;
      }

      const setClauses: string[] = [];
      const setValues: any[] = [];
      for (const [key, value] of Object.entries(changedFields)) {
        setClauses.push(`${key} = ?`);
        if (NUMERIC_FIELDS.has(key)) {
          const num = parseFloat(value);
          setValues.push(isNaN(num) ? null : num);
        } else {
          setValues.push(value || null);
        }
      }

      const table = type === "matter" ? "matter" : "mass";
      await db.run(`UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = ?`, [
        ...setValues,
        data.id,
      ]);

      if (type === "mass") {
        const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const seqRow = await db.all(
          "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?",
          [data.id]
        );
        const seq = seqRow[0]?.next_seq || 1;
        await db.run(
          "INSERT INTO motion (id, stream, seq, action, status, delta, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            motionId,
            data.id,
            seq,
            100,
            "COMPLETED",
            null,
            JSON.stringify({ action: "UPDATE", table, fields: changedFields }),
          ]
        );
      }

      closeDetail();

      if (query.trim()) performSearch(query);

      db.push().catch((err) => console.error("Background sync failed:", err));
    } catch (error) {
      console.error("Save failed:", error);
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (type: "matter" | "mass", item: any) => {
    const label = type === "matter" ? item.title : item.matter_title || "Stock Item";
    Alert.alert(`Delete ${type}`, `Remove "${label}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const originDb = item.originDb || "tenant";
            const db = originDb === "user" ? getUserDb() : originDb === "global" ? getGlobalDb() : getTenantDb();
            if (type === "mass") {
              await db.run("DELETE FROM mass WHERE id = ?", [item.id]);
            } else {
              await db.run("DELETE FROM mass WHERE matter = ?", [item.id]);
              await db.run("DELETE FROM matter WHERE id = ?", [item.id]);
            }
            if (type === "mass") {
              const seqRow = await db.all(
                "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?",
                [item.id]
              );
              const seq = seqRow[0]?.next_seq || 1;
              const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
              await db.run(
                "INSERT INTO motion (id, stream, seq, action, status, delta, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [motionId, item.id, seq, 100, "COMPLETED", null, JSON.stringify({ action: "DELETE", type })]
              );
            }
            db.push().catch((err) => console.error("Background sync failed:", err));
            if (query.trim()) performSearch(query);
          } catch (error) {
            console.error("Delete failed:", error);
            Alert.alert("Error", "Failed to delete.");
          }
        },
      },
    ]);
  };

  const updateField = (field: string, value: string) => {
    setSelectedItem((prev) => {
      if (!prev) return prev;
      return { ...prev, editFields: { ...prev.editFields, [field]: value } };
    });
  };

  const renderField = (field: string, value: string) => {
    const isNumeric = NUMERIC_FIELDS.has(field);
    const isTitle = field === "title";
    const isData = field === "data";

    if (isTitle) {
      return (
        <View key={field} style={styles.titleGroup}>
          <TextInput
            style={styles.titleInput}
            value={value}
            onChangeText={(v) => updateField(field, v)}
            placeholder="Untitled"
            placeholderTextColor="#cbd5e1"
            multiline
          />
        </View>
      );
    }

    if (isData) {
      let parsed: Record<string, any> = {};
      try { parsed = JSON.parse(value || "{}"); } catch {}
      const isFlat = Object.values(parsed).every(
        (v) => v === null || typeof v !== "object"
      );

      if (isFlat && Object.keys(parsed).length > 0) {
        return (
          <View key={field} style={styles.dataContainer}>
            {Object.entries(parsed).map(([key, val], idx, arr) => (
              <React.Fragment key={key}>
                <View style={styles.dataRow}>
                  <Text style={styles.dataKey}>{key}</Text>
                  <TextInput
                    style={styles.dataValue}
                    value={String(val ?? "")}
                    onChangeText={(newVal) => {
                      try {
                        const current = JSON.parse(value || "{}");
                        current[key] = newVal;
                        updateField(field, JSON.stringify(current));
                      } catch {}
                    }}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                {idx < arr.length - 1 && <View style={styles.dataDivider} />}
              </React.Fragment>
            ))}
          </View>
        );
      }

      return (
        <View key={field} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Data (JSON)</Text>
          <TextInput
            style={styles.fieldInputMultiline}
            value={value}
            onChangeText={(v) => updateField(field, v)}
            placeholderTextColor="#94a3b8"
            placeholder="{}"
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    }

    return (
      <View key={field} style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{FIELD_LABELS[field] || field}</Text>
        <TextInput
          style={[
            styles.fieldInput,
            isNumeric && styles.fieldInputNumeric,
          ]}
          value={value}
          onChangeText={(v) => updateField(field, v)}
          placeholderTextColor="#94a3b8"
          placeholder={FIELD_LABELS[field] || field}
          keyboardType={isNumeric ? "numeric" : "default"}
        />
      </View>
    );
  };

  const renderSection = (title: string, data: any[], type: "matter" | "mass" | "motion") => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {data.map((item, index) => (
          <TouchableOpacity
            key={item.id ? `${item.originDb || type}_${item.id}` : `${type}_${index}`}
            style={styles.resultItem}
            activeOpacity={0.7}
            onPress={() => {
              if (type === "matter") {
                router.push(`/matter?id=${item.id}`);
              } else if (type === "mass") {
                selectItem(type, item);
              }
            }}
            onLongPress={() => {
              if (type === "matter" || type === "mass") {
                handleDelete(type, item);
              }
            }}
          >
            <View style={styles.resultIcon}>
              <Ionicons
                name={type === "matter" ? "cube-outline" : type === "mass" ? "scale-outline" : "flash-outline"}
                size={18}
                color="#64748b"
              />
            </View>
            <View style={styles.resultText}>
              <Text style={styles.resultTitle}>
                {type === "matter" ? item.title : type === "mass" ? (item.matter_title || "Stock Item") : `Action ${item.action}`}
              </Text>
              <Text style={styles.resultSubtitle} numberOfLines={1}>
                {type === "matter" ? (item.code || item.type || "No code") : type === "mass" ? `${item.qty || 0} units` : (item.stream || "No stream")}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderDetailView = () => {
    if (!selectedItem) return null;
    const { type, data, editFields } = selectedItem;
    const fields = type === "matter" ? MATTER_FIELDS : MASS_FIELDS;

    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailContent}
          keyboardShouldPersistTaps="handled"
        >
          {type === "mass" && data.matter_title && (
            <View style={styles.referenceRow}>
              <Ionicons name="link-outline" size={14} color="#94a3b8" />
              <Text style={styles.referenceText}>{data.matter_title}</Text>
            </View>
          )}

          {fields.map((field) => {
            if (field === "title") {
              const codeVal = editFields.code || data.code;
              return (
                <View key="title">
                  {renderField("title", editFields.title || "")}
                  {type === "matter" && codeVal && (
                    <Text style={styles.codeSubtitle}>{codeVal}</Text>
                  )}
                </View>
              );
            }
            return renderField(field, editFields[field] || "");
          })}

          {aiReply && (
            <View style={styles.aiReplyBanner}>
              <Ionicons name="sparkles" size={16} color="#6366f1" />
              <Text style={styles.aiReplyText}>{aiReply}</Text>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen
        options={{
          animation: "fade",
          presentation: "transparentModal",
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />

      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          {selectedItem ? (
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderTags}>
                <View style={[styles.badge, selectedItem.type === "matter" ? styles.badgeMatter : styles.badgeMass]}>
                  <Text style={styles.badgeText}>{selectedItem.type.toUpperCase()}</Text>
                </View>
                {selectedItem.data.type && (
                  <View style={styles.typeTag}>
                    <Text style={styles.typeTagText}>{selectedItem.data.type}</Text>
                  </View>
                )}
                {(selectedItem.editFields.scope || selectedItem.data.scope) && (
                  <View style={styles.scopeTag}>
                    <Text style={styles.scopeTagText}>{selectedItem.editFields.scope || selectedItem.data.scope}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.detailSaveBtn}>
                {saving ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <Text style={styles.detailSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.header}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Search database..."
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholderTextColor="#94a3b8"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")}>
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {!selectedItem && (
            <View style={styles.chipRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, selectedType === null && styles.chipSelected]}
                  onPress={() => setSelectedType(null)}
                >
                  <Text style={[styles.chipText, selectedType === null && styles.chipTextSelected]}>All</Text>
                </TouchableOpacity>
                {types.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, selectedType === t && styles.chipSelected]}
                    onPress={() => setSelectedType(t)}
                  >
                    <Text style={[styles.chipText, selectedType === t && styles.chipTextSelected]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {selectedItem ? (
            renderDetailView()
          ) : (
            <ScrollView
              style={styles.resultsList}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {loading && <ActivityIndicator style={styles.loader} color="#6366f1" />}

              {!loading && query.length > 0 && results.matter.length === 0 && results.mass.length === 0 && results.motion.length === 0 && (
                <Text style={styles.emptyText}>No results found for "{query}"</Text>
              )}

              {renderSection("Entities", results.matter, "matter")}
              {renderSection("Inventory", results.mass, "mass")}
              {renderSection("Logs", results.motion, "motion")}
            </ScrollView>
          )}
        </SafeAreaView>

        {selectedItem && (
          <View style={[styles.aiBar, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder='Try "change qty to 50" or "update price"'
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
                {aiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500",
  },
  closeBtn: {
    marginLeft: 16,
  },
  closeText: {
    color: "#6366f1",
    fontWeight: "600",
    fontSize: 16,
  },
  chipRow: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  chipContainer: {
    paddingHorizontal: 16,
    gap: 4,
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipSelected: {
    backgroundColor: "#f1f5f9",
  },
  chipText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  chipTextSelected: {
    color: "#1e293b",
    fontWeight: "600",
  },
  resultsList: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: "#64748b",
    fontSize: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f8fafc",
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },

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
  detailSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  detailSaveText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366f1",
  },

  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeMatter: {
    backgroundColor: "#e0e7ff",
  },
  badgeMass: {
    backgroundColor: "#fce7f3",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#1e293b",
  },
  typeTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  scopeTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  scopeTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b45309",
  },

  referenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  referenceText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },

  titleGroup: {
    marginBottom: 4,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 30,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  codeSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94a3b8",
    marginBottom: 28,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    color: "#1e293b",
  },
  fieldInputNumeric: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 20,
  },

  dataContainer: {
    marginBottom: 20,
  },
  dataRow: {
    paddingVertical: 10,
  },
  dataKey: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  dataValue: {
    fontSize: 15,
    color: "#1e293b",
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  dataDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },

  aiReplyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#eef2ff",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  aiReplyText: {
    flex: 1,
    fontSize: 14,
    color: "#4338ca",
    marginLeft: 10,
    lineHeight: 20,
  },

  aiBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  aiInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: "#1e293b",
    maxHeight: 80,
  },
  aiSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  aiSendBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },
});
