import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Tabs, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import React from "react";
import {
    Dimensions,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useMemoryStore } from "../../hooks/use-memory-store";
import { useThemeColors } from "../../hooks/use-theme-colors";
import { TABLES } from "../../lib/constants";
import { syncDb } from "../../lib/db";

const { width } = Dimensions.get("window");

const MemoryListItem = React.memo(
  ({ item, memory, setMemory, setIsFilterModalVisible, colors }: any) => {
    const isActive = memory === item.id;
    const isStates = item.id === "state";

    const handleSubSelect = (type: string) => {
      setMemory(`state:${type}`);
      setIsFilterModalVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
      <View>
        <TouchableOpacity
          style={[styles.memoryListItem, { borderBottomColor: colors.border }]}
          onPress={() => {
            setMemory(item.id);
            setIsFilterModalVisible(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name={item.icon as any}
            size={22}
            color={
              isActive || (isStates && memory.startsWith("state:"))
                ? colors.accent
                : colors.secondaryText
            }
            style={{ marginRight: 14 }}
          />
          <Text
            style={[
              styles.memoryListItemText,
              { color: colors.text },
              (isActive || (isStates && memory.startsWith("state:"))) && {
                color: colors.accent,
                fontWeight: "700",
              },
            ]}
          >
            {item.name}
          </Text>

          {isActive && !isStates && (
            <MaterialCommunityIcons
              name="check"
              size={20}
              color={colors.accent}
              style={{ marginLeft: "auto" }}
            />
          )}
        </TouchableOpacity>

        {isStates && (
          <View style={{ paddingLeft: 36 }}>
            {["Products", "Collections", "Posts"].map((subItem) => {
              const subId = `state:${subItem}`;
              const isSubActive = memory === subId;
              return (
                <TouchableOpacity
                  key={subItem}
                  style={[
                    styles.memoryListItem,
                    { borderBottomColor: colors.border, paddingVertical: 12 },
                  ]}
                  onPress={() => handleSubSelect(subItem)}
                >
                  <Text
                    style={[
                      styles.memoryListItemText,
                      { fontSize: 15, color: colors.secondaryText },
                      isSubActive && {
                        color: colors.accent,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {subItem}
                  </Text>
                  {isSubActive && (
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color={colors.accent}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  },
);

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { memory, setMemory } = useMemoryStore();
  const router = useRouter();
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const [isFilterModalVisible, setIsFilterModalVisible] = React.useState(false);

  const activeTable = TABLES.find((t) => t.id === memory);

  const renderMemoryItem = React.useCallback(
    ({ item }: { item: any }) => (
      <MemoryListItem
        item={item}
        memory={memory}
        setMemory={setMemory}
        setIsFilterModalVisible={setIsFilterModalVisible}
        colors={colors}
      />
    ),
    [memory, setMemory, setIsFilterModalVisible, colors],
  );

  const insets = useSafeAreaInsets();

  const formattedMemory = React.useMemo(() => {
    if (!memory) return "Memory";
    if (memory.includes(":")) {
      const [, type] = memory.split(":");
      return type;
    }
    return memory.charAt(0).toUpperCase() + memory.slice(1);
  }, [memory]);

  return (
    <View
      style={[
        styles.tabBarContainer,
        { bottom: Math.max(30, insets.bottom + 10) },
      ]}
    >
      <View style={styles.leftWrapper}>
        <BlurView
          intensity={90}
          tint={colorScheme === "dark" ? "dark" : "light"}
          style={[
            styles.tabBarInner,
            {
              backgroundColor: colors.tabBarBackground,
              borderColor: colors.border,
              width: "auto",
              minWidth: 100,
              paddingHorizontal: 20,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              setIsFilterModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.text,
              }}
            >
              {formattedMemory}
            </Text>
          </TouchableOpacity>
        </BlurView>
      </View>

      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            { backgroundColor: colors.background },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Memories
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.secondaryText },
                  ]}
                >
                  Select a partition to explore
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsFilterModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={28}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={TABLES}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalListContent}
              renderItem={renderMemoryItem}
            />
          </SafeAreaView>
        </View>
      </Modal>

      <View style={styles.rightWrapper}>
        <BlurView
          intensity={90}
          tint={colorScheme === "dark" ? "dark" : "light"}
          style={[
            styles.rightContainer,
            {
              backgroundColor: colors.tabBarBackground,
              borderColor: colors.border,
            },
          ]}
        >
          {(memory === "state:Products" ||
            memory === "state:Collections" ||
            memory === "state:Posts") && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const type = memory.split(":")[1];
                router.push({ pathname: "/add-state", params: { type } });
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="plus"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          )}

          {memory === "instance" && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/add-instance");
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="plus"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
        </BlurView>
      </View>
    </View>
  );
}

function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();
  const { colorScheme, setColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();

  const handleSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await syncDb();
  };

  const toggleTheme = () => {
    const nextScheme = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(nextScheme);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const isAgentsScreen = pathname === "/agents";

  return (
    <View
      style={[
        styles.topBarContainer,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          height: 60 + insets.top,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.leftGroup}>
        <TouchableOpacity
          style={styles.topActionItem}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={colorScheme === "dark" ? "weather-sunny" : "weather-night"}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.rightActionsGroup}>
        {!isAgentsScreen && (
          <TouchableOpacity
            style={styles.topActionItem}
            onPress={handleSync}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="brain"
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.topActionItem}
          onPress={() => router.push("/relay")}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="asterisk"
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.profileCircle,
            {
              backgroundColor: colorScheme === "dark" ? "#2C2C2E" : "#F7F6F3",
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.profileInitial, { color: colors.text }]}>A</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <TopBar />

      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            headerTitle: "Trace",
          }}
        />

        <Tabs.Screen
          name="relay"
          options={{
            headerTitle: "Relay",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  topBarContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  rightActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  leftWrapper: {
    flex: 1,
    marginRight: 15,
    alignItems: "flex-start",
  },
  rightWrapper: {
    alignItems: "flex-end",
  },
  tabBarInner: {
    flexDirection: "row",
    borderRadius: 25,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    minWidth: 90,
  },
  rightContainer: {
    flexDirection: "row",
    borderRadius: 25,
    paddingHorizontal: 5,
    height: 48,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    minWidth: 90,
    justifyContent: "center",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  actionItem: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
  },
  addButton: {
    backgroundColor: "#006AFF",
  },
  topActionItem: {
    padding: 4,
  },
  profileCircle: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginLeft: 4,
  },
  profileInitial: {
    fontSize: 11,
    fontWeight: "700",
  },
  fullScreenModal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 4,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(142, 142, 147, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalListContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  memoryListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memoryListItemText: {
    fontSize: 17,
    fontWeight: "500",
  },
  aiButtonBadge: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  aiButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
});
