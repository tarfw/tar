import React, { useState, useEffect } from "react";
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
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { getUserDb, getSelfId, routeDbForEntity, isCollabSyncEnabled } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";

export default function CreateNoteScreen() {
  const router = useRouter();

  const type = "note";
  const [matterId, setMatterId] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("p");
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [time, setTime] = useState("");
  const [data, setData] = useState<Record<string, any>>({});

  // Action log state
  const [selectedOpcode, setSelectedOpcode] = useState<any | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [actionDelta, setActionDelta] = useState("");
  const [actionData, setActionData] = useState("");
  const [isExecutingOpcode, setIsExecutingOpcode] = useState(false);

  const NOTE_OPCODES: any[] = [
    { code: 307, label: "REPLY", defaultStatus: "REPLY", hasDelta: false, defaultData: { text: "Follow up comment" }, color: "#3b82f6" },
    { code: 505, label: "PERFORMANCE NOTE", defaultStatus: "LOGGED", hasDelta: false, defaultData: { rating: 5 }, color: "#10b981" },
  ];

  const executeOpcodeAction = async (opcodeOpt: any) => {
    const finalId = matterId.trim();
    const finalTitle = title.trim();
    if (!finalId) {
      Alert.alert("Validation Error", "Please provide a unique Matter ID first.");
      return;
    }
    if (!finalTitle) {
      Alert.alert("Validation Error", "Please enter a title first.");
      return;
    }

    setIsExecutingOpcode(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const db = routeDbForEntity("motion", scope);
      const timeStr = new Date().toISOString();

      // Automatically save the matter itself so the stream ID has a valid parent matter.
      const matterDb = getUserDb();
      await matterDb.run(
        "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalId,
          code.trim() || null,
          type,
          scope.trim(),
          owner.trim() || null,
          finalTitle,
          isPublic ? 1 : 0,
          JSON.stringify(data),
          timeStr
        ]
      );
      
      try {
        await upsertMatterVector(finalId, {
          title: finalTitle,
          type,
          scope: scope.trim(),
          code: code.trim() || null,
          data: JSON.stringify(data)
        });
      } catch (vErr) {
        console.warn("Vector sync failed:", vErr);
      }

      // Compute next monotonic seq for this stream
      const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [finalId]);
      const nextSeq = seqRow[0]?.next_seq || 1;

      // Parse delta and data
      const deltaVal = opcodeOpt.hasDelta ? Number(actionDelta || opcodeOpt.defaultDelta || 0) : null;
      let parsedDataPayload = opcodeOpt.defaultData;
      try {
        if (actionData.trim()) {
          parsedDataPayload = JSON.parse(actionData);
        }
      } catch (_) {
        parsedDataPayload = { ...opcodeOpt.defaultData, raw_input: actionData };
      }

      const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const targetStatus = actionStatus.trim() || opcodeOpt.defaultStatus;

      await db.run(
        "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          motionId,
          finalId,
          nextSeq,
          opcodeOpt.code,
          targetStatus,
          deltaVal,
          scope.trim(),
          JSON.stringify(parsedDataPayload),
          timeStr
        ]
      );

      const syncEnabled = await isCollabSyncEnabled();
      if (syncEnabled) {
        await db.push().catch((err) => console.warn("Failed to push sync:", err));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Action Executed",
        `Successfully logged Opcode ${opcodeOpt.code} (${opcodeOpt.label}) to the Kinetic Ledger.`,
        [{ text: "OK", onPress: () => setSelectedOpcode(null) }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to execute opcode action.");
    } finally {
      setIsExecutingOpcode(false);
    }
  };

  useEffect(() => {
    async function initFields() {
      const userId = await getSelfId();
      setOwner(userId);
      setTime(new Date().toISOString());
      const randSuffix = Math.random().toString(36).substring(2, 8);
      setMatterId(`note_${randSuffix}`);
    }
    initFields();
  }, []);

  const handleSave = async () => {
    const finalId = matterId.trim();
    const finalTitle = title.trim();
    if (!finalId) {
      Alert.alert("Validation Error", "Please provide a unique Matter ID.");
      return;
    }
    if (!finalTitle) {
      Alert.alert("Validation Error", "Please enter a title.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const db = getUserDb();
      const finalTime = time.trim() || new Date().toISOString();
      await db.run(
        "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalId,
          code.trim() || null,
          type,
          scope.trim(),
          owner.trim() || null,
          finalTitle,
          isPublic ? 1 : 0,
          JSON.stringify(data),
          finalTime
        ]
      );
      try {
        await upsertMatterVector(finalId, {
          title: finalTitle,
          type,
          scope: scope.trim(),
          code: code.trim() || null,
          data: JSON.stringify(data)
        });
      } catch (vectorErr) {
        console.error(vectorErr);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save.");
    }
  };

  const renderPill = (
    fieldKey: string,
    label: string,
    color: string,
    value: string | undefined,
    placeholder: string,
    styleOverrides?: { container?: any; text?: any; placeholderTextColor?: string }
  ) => {
    return (
      <TextInput
        style={[
          styles.sentencePill,
          styles.sentencePillText,
          { backgroundColor: color + "12", borderColor: color + "30", color, minWidth: 80, textAlign: "center" },
          styleOverrides?.container,
          styleOverrides?.text
        ]}
        value={value ?? ""}
        onChangeText={(text) => {
          if (fieldKey === "title") setTitle(text);
          else if (fieldKey.startsWith("data.")) {
            const subKey = fieldKey.split(".")[1];
            setData((prev) => ({ ...prev, [subKey]: text }));
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={styleOverrides?.placeholderTextColor ?? (color + "80")}
        multiline={false}
        autoCapitalize="none"
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, marginTop: 10 }}>
        <ScrollView style={styles.editorArea} contentContainerStyle={styles.editorScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.sentenceTypeBadge}>
                <Text style={styles.sentenceTypeBadgeText}>NOTE</Text>
              </View>
            </View>
          </View>

          <View style={{ width: "100%", gap: 12 }}>
            {renderPill("title", "Title", "#18181b", title, "Untitled Note", {
              container: {
                backgroundColor: "transparent",
                borderWidth: 0,
                fontSize: 24,
                fontWeight: "800",
                textAlign: "left",
                paddingVertical: 6,
                paddingHorizontal: 0,
                borderRadius: 0,
                width: "100%",
              },
              placeholderTextColor: "#d1d5db"
            })}
            
            <TextInput
              style={[
                styles.canvasNotesInput,
                {
                  backgroundColor: "#fafafa",
                  borderColor: "#e4e4e7",
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  minHeight: 150,
                  fontSize: 14,
                  color: "#18181b",
                  textAlignVertical: "top"
                }
              ]}
              value={data.text || ""}
              onChangeText={(text) => setData((prev) => ({ ...prev, text }))}
              placeholder="Type note content here..."
              placeholderTextColor="#a1a1aa"
              multiline={true}
              numberOfLines={6}
            />
          </View>

          {/* Kinetic Ledger / Opcode Operations Section */}
          <View style={styles.opcodeSection}>
            <View style={styles.opcodeSectionHeader}>
              <Ionicons name="git-network-outline" size={16} color="#71717a" />
              <Text style={styles.opcodeSectionTitle}>KINETIC LEDGER ACTIONS</Text>
            </View>
            <Text style={styles.opcodeSectionDesc}>
              Simulate actions and log status transitions in the append-only timeline stream (motion ledger).
            </Text>

            <View style={styles.opcodeGrid}>
              {NOTE_OPCODES.map((opt) => {
                const isActive = selectedOpcode?.code === opt.code;
                return (
                  <TouchableOpacity
                    key={opt.code}
                    style={[
                      styles.opcodeBtn,
                      { borderColor: opt.color + "40" },
                      isActive && { backgroundColor: opt.color + "10", borderColor: opt.color }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isActive) {
                        setSelectedOpcode(null);
                      } else {
                        setSelectedOpcode(opt);
                        setActionStatus(opt.defaultStatus);
                        setActionDelta(opt.hasDelta ? String(opt.defaultDelta ?? 0) : "");
                        setActionData(JSON.stringify(opt.defaultData));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.opcodeIndicator, { backgroundColor: opt.color }]} />
                    <Text style={styles.opcodeBtnLabel}>{opt.label}</Text>
                    <Text style={styles.opcodeBtnSub}>OP {opt.code}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedOpcode && (
              <View style={[styles.opcodeDetailsCard, { borderColor: selectedOpcode.color + "40" }]}>
                <View style={styles.opcodeDetailsHeader}>
                  <Text style={[styles.opcodeDetailsTitle, { color: selectedOpcode.color }]}>
                    Configure OP {selectedOpcode.code}: {selectedOpcode.label}
                  </Text>
                </View>

                <View style={styles.opcodeInputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opcodeInputLabel}>Status</Text>
                    <TextInput
                      style={styles.opcodeInput}
                      value={actionStatus}
                      onChangeText={setActionStatus}
                      placeholder="e.g. COMPLETED"
                    />
                  </View>

                  {selectedOpcode.hasDelta && (
                    <View style={{ width: 100 }}>
                      <Text style={styles.opcodeInputLabel}>Delta Value</Text>
                      <TextInput
                        style={styles.opcodeInput}
                        value={actionDelta}
                        onChangeText={setActionDelta}
                        keyboardType="numeric"
                        placeholder="e.g. 150"
                      />
                    </View>
                  )}
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.opcodeInputLabel}>JSON Payload (data)</Text>
                  <TextInput
                    style={[styles.opcodeInput, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, height: 60 }]}
                    value={actionData}
                    onChangeText={setActionData}
                    multiline
                    placeholder="{}"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.opcodeSubmitBtn, { backgroundColor: selectedOpcode.color }]}
                  onPress={() => executeOpcodeAction(selectedOpcode)}
                  disabled={isExecutingOpcode}
                  activeOpacity={0.8}
                >
                  {isExecutingOpcode ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.opcodeSubmitBtnText}>LOG TRANSACTION</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomStickyBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContainer}>
            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                const scopes = ["p", "g", "d"];
                const idx = scopes.indexOf(scope);
                const next = scopes[(idx + 1) % scopes.length];
                setScope(next);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }} 
              activeOpacity={0.7}
            >
              <Ionicons name="earth" size={14} color="#52525b" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{scope.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                if (Platform.OS === "ios" || Platform.OS === "android") {
                  Alert.prompt("Edit SKU Code", "Enter SKU / matter code:", [{ text: "Cancel", style: "cancel" }, { text: "OK", onPress: (val?: string) => setCode(val || "") }], "plain-text", code);
                } else {
                  const val = prompt("Enter SKU / matter code:", code);
                  if (val !== null) setCode(val);
                }
              }} 
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag-outline" size={14} color="#52525b" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{code || "Code"}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsPublic(!isPublic);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={isPublic ? "eye-outline" : "eye-off-outline"} size={14} color="#52525b" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{isPublic ? "Public" : "Private"}</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />
            <TouchableOpacity style={[styles.chip, { backgroundColor: "#ec4899", borderColor: "#ec4899" }]} onPress={handleSave} activeOpacity={0.8}>
              <Text style={[styles.chipText, { color: "white" }]}>Publish</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  editorArea: { flex: 1 },
  editorScrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  bottomStickyBar: { backgroundColor: "white", borderTopWidth: 0.5, borderTopColor: "#e4e4e7" },
  chipsScrollContainer: { paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", gap: 6, flexGrow: 1 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "#f4f4f5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  sentenceTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#f4f4f5" },
  sentenceTypeBadgeText: { fontSize: 11, fontWeight: "700", color: "#18181b" },
  sentencePill: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center" },
  sentencePillText: { fontSize: 14, fontWeight: "600", color: "#27272a" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#f4f4f5", paddingBottom: 12, marginBottom: 16 },
  canvasNotesInput: { fontSize: 18, color: "#52525b", lineHeight: 26, padding: 0 },
  opcodeSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 20,
    paddingBottom: 20,
  },
  opcodeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  opcodeSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#71717a",
    letterSpacing: 1,
  },
  opcodeSectionDesc: {
    fontSize: 12,
    color: "#a1a1aa",
    marginBottom: 14,
    lineHeight: 16,
  },
  opcodeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  opcodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
    gap: 6,
  },
  opcodeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  opcodeBtnLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#27272a",
  },
  opcodeBtnSub: {
    fontSize: 9,
    fontWeight: "700",
    color: "#a1a1aa",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  opcodeDetailsCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    padding: 14,
    marginTop: 8,
  },
  opcodeDetailsHeader: {
    marginBottom: 10,
  },
  opcodeDetailsTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  opcodeInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  opcodeInputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  opcodeInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: "#18181b",
    marginTop: 4,
  },
  opcodeSubmitBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  opcodeSubmitBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
});
