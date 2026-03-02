import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { dbHelpers } from "../lib/db";
import { ProductPayload, refineProductPayload } from "../lib/groq-service";

/**
 * MEMORY DETAIL SCREEN — Notion-style with AI edit
 */

export default function MemoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { title, subtitle, type, ...rest } = params;

  const isProduct =
    type === "state" &&
    (subtitle === "Product" ||
      rest.type === "Product" ||
      rest.type === "Products");

  const [currentPayload, setCurrentPayload] = useState<any>(() => {
    if (typeof rest.payload === "string") {
      try {
        return JSON.parse(rest.payload);
      } catch {
        return {};
      }
    }
    return {};
  });
  const [currentTitle, setCurrentTitle] = useState(String(title || ""));
  const [currentCode, setCurrentCode] = useState(
    String(rest.universalcode || ""),
  );

  // AI refine state
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=FFFFFF&color=000000&data=${currentCode || "0000"}`;

  // ─── AI Refine ───
  const handleAiRefine = async () => {
    if (!refinePrompt.trim()) return;
    setIsRefining(true);
    try {
      const payload: ProductPayload = {
        ...currentPayload,
        title: currentTitle,
        universal_code: currentCode,
      };
      const refined = await refineProductPayload(payload, refinePrompt.trim());

      // Update local state
      if (refined.title) setCurrentTitle(refined.title);
      if (refined.universal_code) setCurrentCode(refined.universal_code);

      const { title: _t, universal_code: _uc, ...payloadRest } = refined;
      const newPayload = { ...currentPayload, ...payloadRest };
      setCurrentPayload(newPayload);

      // Persist to database
      const stateId = String(rest.id || "");
      if (stateId) {
        await dbHelpers.updateState(stateId, {
          title: refined.title || currentTitle,
          ucode: refined.universal_code || currentCode,
          payload: JSON.stringify(newPayload),
        });
      }

      setRefinePrompt("");
      Keyboard.dismiss();
    } catch (e: any) {
      Alert.alert("AI Error", e.message || "Failed to refine.");
    } finally {
      setIsRefining(false);
    }
  };

  // ─── Property Row ───
  const P = ({ label, value }: { label: string; value: string }) => (
    <View style={s.prop}>
      <Text style={s.propLabel}>{label}</Text>
      <Text style={s.propValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  // ─── Generic detail rows ───
  const renderDetailRow = (label: string, value: any) => {
    if (value === undefined || value === null || value === "" || label === "id")
      return null;
    if (label === "payload" || label === "embedding") return null;

    let displayValue = "";
    try {
      displayValue =
        typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value);
    } catch {
      displayValue = "Error";
    }

    return (
      <View key={label} style={s.detailRow}>
        <Text style={s.detailLabel}>{label.replace(/_/g, " ")}</Text>
        <Text style={s.detailValue}>{displayValue}</Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {isProduct && (
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeText}>
              {String(rest.type || rest.nodetype || "Product")}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Title ── */}
        <Text style={s.title}>{currentTitle || "Untitled"}</Text>

        {/* ── Universal Code ── */}
        {currentCode ? (
          <View style={s.codeRow}>
            <MaterialCommunityIcons
              name="barcode-scan"
              size={14}
              color="#52525B"
            />
            <Text style={s.codeText}>{currentCode}</Text>
          </View>
        ) : null}

        <View style={s.divider} />

        {isProduct ? (
          <>
            {/* ──────── PROPERTIES TABLE ──────── */}
            <View style={s.propTable}>
              {currentPayload.brand && (
                <P label="Brand" value={currentPayload.brand} />
              )}
              {currentPayload.price?.amount != null && (
                <P
                  label="Price"
                  value={`${currentPayload.price.currency || "USD"} ${currentPayload.price.amount}${currentPayload.price.range ? `  (${currentPayload.price.range})` : ""}`}
                />
              )}
              {currentPayload.availability && (
                <View style={s.prop}>
                  <Text style={s.propLabel}>Status</Text>
                  <View style={s.statusPill}>
                    <View
                      style={[
                        s.statusDot,
                        {
                          backgroundColor: currentPayload.availability
                            .toLowerCase()
                            .includes("stock")
                            ? "#22C55E"
                            : "#F59E0B",
                        },
                      ]}
                    />
                    <Text style={s.statusText}>
                      {currentPayload.availability}
                    </Text>
                  </View>
                </View>
              )}
              {currentPayload.categorization?.category && (
                <P
                  label="Category"
                  value={`${currentPayload.categorization.category}${currentPayload.categorization.subcategory ? " › " + currentPayload.categorization.subcategory : ""}`}
                />
              )}
              {currentPayload.gtin && (
                <P label="GTIN" value={currentPayload.gtin} />
              )}
              {currentPayload.mpn && (
                <P label="MPN" value={currentPayload.mpn} />
              )}
              {currentPayload.delivery && (
                <P label="Delivery" value={currentPayload.delivery} />
              )}
              {currentPayload.return_policy && (
                <P label="Returns" value={currentPayload.return_policy} />
              )}
            </View>

            {/* ──────── TAGS ──────── */}
            {currentPayload.categorization?.tags &&
              currentPayload.categorization.tags.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Tags</Text>
                  <View style={s.tagsRow}>
                    {currentPayload.categorization.tags.map(
                      (tag: string, i: number) => (
                        <View key={i} style={s.tag}>
                          <Text style={s.tagText}>{tag}</Text>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              )}

            {/* ──────── DESCRIPTION ──────── */}
            {currentPayload.description && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Description</Text>
                <Text style={s.descText}>{currentPayload.description}</Text>
              </View>
            )}

            {/* ──────── OPTIONS ──────── */}
            {currentPayload.options &&
              Array.isArray(currentPayload.options) &&
              currentPayload.options.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Options</Text>
                  {currentPayload.options.map((opt: any, idx: number) => (
                    <View key={idx} style={s.optGroup}>
                      <Text style={s.optName}>{opt.name}</Text>
                      <View style={s.optValuesRow}>
                        {opt.values?.map((val: string, vi: number) => (
                          <View key={vi} style={s.optChip}>
                            <Text style={s.optChipText}>{val}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

            {/* ──────── SPECIFICATIONS ──────── */}
            {currentPayload.specifications &&
              typeof currentPayload.specifications === "object" &&
              Object.keys(currentPayload.specifications).length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Specifications</Text>
                  <View style={s.specTable}>
                    {Object.entries(currentPayload.specifications).map(
                      ([k, v], i) => (
                        <View key={i} style={s.specRow}>
                          <Text style={s.specKey}>{k}</Text>
                          <Text style={s.specVal}>{String(v)}</Text>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              )}

            {/* ──────── PRODUCT IMAGE ──────── */}
            {(currentPayload?.image || currentPayload?.images?.[0]) && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Image</Text>
                <View style={s.imageContainer}>
                  <Image
                    source={{
                      uri: currentPayload.image || currentPayload.images[0],
                    }}
                    style={s.image}
                    contentFit="cover"
                  />
                </View>
              </View>
            )}

            {/* ──────── QR CODE ──────── */}
            {currentCode ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>QR Code</Text>
                <View style={s.qrWrap}>
                  <Image
                    source={{ uri: qrCodeUrl }}
                    style={s.qrImage}
                    contentFit="contain"
                  />
                  <Text style={s.qrLabel}>{currentCode}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View>
            {Object.entries(rest).map(([key, value]) =>
              renderDetailRow(key, value),
            )}
          </View>
        )}

        {/* No spacer needed when not using absolute positioning */}
      </ScrollView>

      {/* ── AI Refine Bar (perfect keyboard avoiding) ── */}
      {isProduct && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 100}
        >
          <View style={s.refineBarOuter}>
            <View style={s.refineBar}>
              <TextInput
                style={s.refineInput}
                placeholder="Edit with AI — e.g. change price to $250..."
                placeholderTextColor="#A1A1AA"
                value={refinePrompt}
                onChangeText={setRefinePrompt}
                onSubmitEditing={handleAiRefine}
                returnKeyType="send"
                editable={!isRefining}
              />
              {refinePrompt.trim().length > 0 || isRefining ? (
                <TouchableOpacity
                  style={[s.refineSend, isRefining && { opacity: 0.4 }]}
                  onPress={handleAiRefine}
                  disabled={isRefining}
                >
                  {isRefining ? (
                    <ActivityIndicator color="#09090B" size="small" />
                  ) : (
                    <MaterialCommunityIcons
                      name="arrow-up-circle"
                      size={30}
                      color="#09090B"
                    />
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  typeBadge: {
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#18181B",
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },

  // ── Title ──
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#09090B",
    letterSpacing: -1,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#52525B",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
  },

  // ── Properties Table ──
  propTable: {
    borderTopWidth: 1,
    borderTopColor: "#F4F4F5",
  },
  prop: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
    gap: 4,
  },
  propLabel: { fontSize: 13, fontWeight: "500", color: "#71717A", width: 100 },
  propValue: { flex: 1, fontSize: 14, fontWeight: "600", color: "#18181B" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#18181B",
    textTransform: "capitalize",
  },

  // ── Sections ──
  section: {
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: "#F4F4F5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  tagText: { fontSize: 13, fontWeight: "600", color: "#18181B" },

  // Description
  descText: {
    fontSize: 15,
    color: "#27272A",
    lineHeight: 24,
    fontWeight: "400",
  },

  // Options
  optGroup: { marginBottom: 16 },
  optName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3F3F46",
    marginBottom: 8,
  },
  optValuesRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  optChipText: { fontSize: 13, fontWeight: "600", color: "#18181B" },

  // Specifications Table
  specTable: {
    borderWidth: 1,
    borderColor: "#F4F4F5",
    borderRadius: 10,
    overflow: "hidden",
  },
  specRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
  },
  specKey: { fontSize: 13, fontWeight: "600", color: "#71717A", width: 130 },
  specVal: { flex: 1, fontSize: 13, fontWeight: "600", color: "#18181B" },

  // Image
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
  },
  image: { width: "100%", aspectRatio: 1.5 },

  // QR Code
  qrWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    padding: 20,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F4F4F5",
  },
  qrImage: { width: 80, height: 80, borderRadius: 6 },
  qrLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#09090B",
    letterSpacing: 1,
  },

  // Generic Detail Rows
  detailRow: { marginBottom: 28 },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#71717A",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  detailValue: { fontSize: 17, fontWeight: "600", color: "#09090B" },

  // ── AI Refine Bar ──
  refineBarOuter: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#F4F4F5",
  },
  refineBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  refineInput: {
    flex: 1,
    fontSize: 15,
    color: "#18181B",
    paddingVertical: 2,
  },
  refineSend: {
    marginLeft: 8,
  },
});
