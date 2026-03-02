import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useMemoryStore } from "../../hooks/use-memory-store";
import { useThemeColors } from "../../hooks/use-theme-colors";
import { dbHelpers, subscribeToDbChanges } from "../../lib/db";
import { useEmbeddingService } from "../../lib/embedding-service";

/**
 * TRACE SCREEN
 * Displays real data from Turso with Semantic Search.
 */

export default function TraceScreen() {
  const router = useRouter();
  const { memory: activeTab, setMemory: setActiveTab } = useMemoryStore();
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();

  const [tableData, setTableData] = useState<Record<string, any[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  const { generateEmbedding, isEmbeddingReady, isEmbeddingGenerating } =
    useEmbeddingService();

  const fetchData = async () => {
    try {
      const [states, traces, instances] = await Promise.all([
        dbHelpers.getStates(),
        dbHelpers.getTraces(),
        dbHelpers.getInstances(),
      ]);

      setTableData({
        state: states,
        trace: traces,
        instance: instances,
      });
    } catch (error) {
      console.error("[Trace] Fetch error:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = subscribeToDbChanges(fetchData);

    // Default to trace if memory store is empty or 'Memory'
    if (activeTab === "Memory") {
      setActiveTab("trace");
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !isEmbeddingReady) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const vector = await generateEmbedding(searchQuery);
      if (vector) {
        // Perform multiple searches in parallel
        const [stateResults, traceResults] = await Promise.all([
          dbHelpers.semanticSearchState(vector, 10),
          dbHelpers.semanticSearchTraces(vector, 5),
        ]);

        // Map to common result format
        const formattedStates = stateResults.map((s: any) => ({
          ...s,
          id: s.id,
          title: s.title,
          type: "state",
          subtitle: s.type,
          distance: s.distance,
        }));

        const formattedTraces = traceResults.map((t: any) => ({
          ...t,
          id: t.id,
          title: t.scope,
          type: "trace",
          subtitle: t.payload ? "Event" : "Trace",
          distance: t.distance,
        }));

        // Combine and sort by distance
        const combinedResults = [...formattedStates, ...formattedTraces].sort(
          (a, b) => a.distance - b.distance,
        );

        setSearchResults(combinedResults);
      }
    } catch (error) {
      console.error("[Trace] Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery === "") {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const [baseTab, filter] = activeTab.split(":");

  const formattedActiveTab = React.useMemo(() => {
    if (!activeTab) return "Memory";
    if (filter) return filter;
    // Map internal IDs to Display Names
    if (baseTab === "state") return "States";
    if (baseTab === "instance") return "Instances";
    if (baseTab === "trace") return "Timeline";
    return baseTab.charAt(0).toUpperCase() + baseTab.slice(1);
  }, [activeTab, baseTab, filter]);

  const renderItem = ({ item }: { item: any }) => {
    let title = "";
    let subtitle = "";
    let typeIcon: any = "";
    const itemType = searchResults && item.type ? item.type : baseTab;

    switch (itemType) {
      case "state":
        title = item.title || item.ucode;
        subtitle = item.type;
        typeIcon = "database";
        break;
      case "trace":
        const date = new Date(item.ts);
        const timeStr = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        title = item.scope || item.title;
        subtitle = `Op ${item.opcode}`;
        typeIcon = "lightning-bolt";
        return (
          <TouchableOpacity
            style={styles.timelineItem}
            onPress={() => {
              router.push({
                pathname: "/mstate",
                params: {
                  ...item,
                  title,
                  subtitle,
                  type: "orevents",
                },
              });
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.timelineThumbnail,
                {
                  backgroundColor:
                    item.status === "success"
                      ? colorScheme === "dark"
                        ? "rgba(34, 197, 94, 0.15)"
                        : "#F0FDF4"
                      : item.status === "failed"
                        ? colorScheme === "dark"
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#FEF2F2"
                        : colorScheme === "dark"
                          ? "#2C2C2E"
                          : "#F8FAFC",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={typeIcon}
                size={18}
                color={
                  item.status === "success"
                    ? "#22C55E"
                    : item.status === "failed"
                      ? "#EF4444"
                      : colorScheme === "dark"
                        ? "#94A3B8"
                        : "#64748B"
                }
              />
            </View>

            <View style={styles.timelineInfo}>
              <Text
                style={[styles.timelineTitle, { color: colors.timelineTitle }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        item.status === "success"
                          ? "#22C55E"
                          : item.status === "failed"
                            ? "#EF4444"
                            : "#94A3B8",
                    },
                  ]}
                />
                <Text style={[styles.statusText, { color: colors.statusText }]}>
                  {subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.timelineTrailing}>
              <Text style={[styles.timeLabel, { color: colors.timeLabel }]}>
                {timeStr}
              </Text>
            </View>
          </TouchableOpacity>
        );
      case "instance":
        title = `State: ${item.stateid}`;
        subtitle = `${item.currency || ""} ${item.qty || item.value || ""}`;
        typeIcon = "map-marker";
        break;
      default:
        title = item.id;
    }

    // For states with payload, parse it for rich display
    let payloadData: any = null;
    if (itemType === "state" && typeof item.payload === "string") {
      try {
        payloadData = JSON.parse(item.payload);
      } catch {}
    }

    const isProduct =
      itemType === "state" &&
      (item.type === "Product" || item.type === "Products");
    const isPost =
      itemType === "state" && (item.type === "Post" || item.type === "Posts");

    const priceStr =
      payloadData?.price?.amount != null
        ? `${payloadData.price.currency || "$"}${payloadData.price.amount}`
        : null;
    const brandStr = payloadData?.brand || null;
    const categoryStr = payloadData?.categorization?.category || null;
    const isInStock = payloadData?.availability
      ?.toLowerCase()
      .includes("stock");

    // Post-specific data
    const postContent = payloadData?.content || null;
    const postTags = payloadData?.tags || null;

    return (
      <TouchableOpacity
        style={[styles.itemContainer, { borderBottomColor: colors.border }]}
        onPress={() => {
          router.push({
            pathname: "/mstate",
            params: {
              ...item,
              title,
              subtitle,
              type: itemType,
            },
          });
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colorScheme === "dark" ? "#27272A" : "#F4F4F5" },
          ]}
        >
          {isProduct && (payloadData?.image || payloadData?.images?.[0]) ? (
            <Image
              source={{ uri: payloadData.image || payloadData.images[0] }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          ) : typeIcon ? (
            <MaterialCommunityIcons
              name={typeIcon}
              size={20}
              color={colorScheme === "dark" ? "#A1A1AA" : "#3F3F46"}
            />
          ) : null}
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[styles.itemTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {isProduct && (priceStr || brandStr || categoryStr) ? (
            <View style={styles.richSubRow}>
              <View style={styles.leftSub}>
                {brandStr && (
                  <Text
                    style={[styles.metaTag, { color: colors.secondaryText }]}
                  >
                    {brandStr}
                  </Text>
                )}
                {categoryStr && (
                  <Text
                    style={[styles.metaTag, { color: colors.secondaryText }]}
                  >
                    · {categoryStr}
                  </Text>
                )}
              </View>
              <View style={styles.rightSub}>
                {priceStr && <Text style={styles.priceTag}>{priceStr}</Text>}
                {payloadData?.availability && (
                  <View
                    style={[
                      styles.stockDot,
                      { backgroundColor: isInStock ? "#22C55E" : "#F59E0B" },
                    ]}
                  />
                )}
              </View>
            </View>
          ) : isPost && (postContent || postTags) ? (
            <View style={{ marginTop: 2 }}>
              {postContent && (
                <Text
                  style={[styles.itemSubtitle, { color: colors.secondaryText }]}
                  numberOfLines={1}
                >
                  {postContent}
                </Text>
              )}
              {postTags && postTags.length > 0 && (
                <View style={{ flexDirection: "row", marginTop: 4, gap: 6 }}>
                  {postTags.slice(0, 3).map((tag: string, i: number) => (
                    <Text
                      key={i}
                      style={[
                        styles.metaTag,
                        { color: colors.secondaryText, fontSize: 11 },
                      ]}
                    >
                      #{tag}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ) : subtitle ? (
            <Text
              style={[styles.itemSubtitle, { color: colors.secondaryText }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // Filter data based on active tab and optional filter (e.g. state:Product)
  const filteredData = React.useMemo(() => {
    const data = tableData[baseTab] || [];
    if (filter && baseTab === "state") {
      return data.filter((item) => {
        const type = item.type || "";
        if (filter === "Products")
          return type === "Product" || type === "Products";
        if (filter === "Collections")
          return type === "Collection" || type === "Collections";
        if (filter === "Posts") return type === "Post" || type === "Posts";
        return type === filter;
      });
    }
    return data;
  }, [tableData, baseTab, filter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.searchBar }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.searchBar }]}>
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color={colors.secondaryText}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Semantic search across memory..."
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && !isSearching && !isEmbeddingGenerating && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          )}
          {(isSearching || isEmbeddingGenerating) && (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={{ marginRight: 8 }}
            />
          )}
        </View>
      </View>

      {searchResults ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          ListHeaderComponent={
            <Text style={[styles.sectionHeader, { color: colors.accent }]}>
              Search Results
            </Text>
          }
        />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconContainer,
                  { backgroundColor: colors.secondaryBackground },
                ]}
              >
                <MaterialCommunityIcons
                  name="database-off"
                  size={48}
                  color={colors.secondaryText}
                />
              </View>
              <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                No data in {formattedActiveTab}.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#F2F2F7",
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 60,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#000",
    height: "100%",
  },
  clearButton: {
    padding: 4,
    marginRight: 4,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#09090B",
    letterSpacing: -0.3,
  },
  itemSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
    marginTop: 2,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.1)",
  },
  timelineThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  timelineInfo: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A", // Overridden in renderItem inline for theme awareness
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  timelineTrailing: {
    marginLeft: 12,
    alignItems: "flex-end",
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  richSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  leftSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rightSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceTag: {
    fontSize: 14,
    fontWeight: "800",
    color: "#18181B",
  },
  metaTag: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
