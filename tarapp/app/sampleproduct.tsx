import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { getUserDb } from "../lib/db";

interface MatterRow {
  id: string;
  code: string;
  type: string;
  scope: string;
  owner: string;
  title: string;
  public: string;
  data: string;
  time: string;
}

interface MassRow {
  id: string;
  matter: string;
  type: string;
  scope: string;
  qty: string | null;
  value: string;
  active: string;
  variant: string | null;
  mark: string;
  time: string;
}

interface MotionRow {
  stream: string;
  seq: string;
  action: string;
  phase: string | null;
  delta: string;
  data: string | null;
  isLocal?: boolean;
  time?: string;
}

export default function StorefrontScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pizza" | "sneakers">("pizza");
  const [loading, setLoading] = useState(true);

  // --- INTERACTIVE POS STATE MOCKUPS ---
  const [posColor, setPosColor] = useState("Black");
  const [posSize, setPosSize] = useState("S");
  
  const [posPizzaSize, setPosPizzaSize] = useState("Medium");
  const [posCheese, setPosCheese] = useState(true);
  const [posPepperoni, setPosPepperoni] = useState(false);

  // --- EXPANDABLE SECTIONS STATE ---
  const [sneakerExpanded, setSneakerExpanded] = useState(false);
  const [pizzaExpanded, setPizzaExpanded] = useState(false);

  // --- IMAGE VIEW TOGGLE (POS vs STOREFRONT) ---
  const [viewMode, setViewMode] = useState<"pos" | "storefront">("pos");

  // --- STATIC TABLES FROM SAMPLEPRODUCT2.MD ---
  const sneakerMatter: MatterRow[] = [
    { id: "sneakers", code: "SNEAKERS01", type: "product", scope: "g", owner: "sneakercompany", title: "Everyday Sneakers", public: "1", data: '{"cat":"retail","p":"89.00","o":{"c":["Black","Red"],"s":["S","M"]}}', time: "1780833600" },
    { id: "store101", code: "TAMILSHOES", type: "profile", scope: "g", owner: "sneakercompany", title: "Tamil Shoes Store", public: "1", data: '{"cat":"store","cur":"INR"}', time: "1780833600" }
  ];

  const sneakerMass: MassRow[] = [
    { id: "sneakers0", matter: "sneakers", type: "1", scope: "s:101", qty: "10", value: "89.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
    { id: "sneakers1", matter: "sneakers", type: "1", scope: "s:101", qty: "5", value: "89.00", active: "1", variant: "1", mark: "0", time: "1780833600" },
    { id: "sneakers2", matter: "sneakers", type: "1", scope: "s:101", qty: "8", value: "95.00", active: "1", variant: "2", mark: "0", time: "1780833600" },
    { id: "sneakers3", matter: "sneakers", type: "1", scope: "s:101", qty: "0", value: "95.00", active: "1", variant: "3", mark: "0", time: "1780833600" }
  ];

  const sneakerMotion: MotionRow[] = [
    { stream: "sneakers0", seq: "1780833900000001", action: "101", phase: null, delta: "-1.0", data: null },
    { stream: "sneakers0", seq: "1780834800000001", action: "105", phase: "109", delta: "1.0", data: '{"co":"web","ph":{"109":1780835100},"carrier":"express"}' },
    { stream: "sneakers0", seq: "1780835400000001", action: "110", phase: null, delta: "89.00", data: '{"tax":12.00}' },
    { stream: "sneakers0", seq: "1780835700000001", action: "111", phase: null, delta: "-1.0", data: '{"r":"return"}' },
    { stream: "sneakers0", seq: "1780836000000001", action: "201", phase: null, delta: "89.00", data: '{"pay":"cash"}' },
    { stream: "sneakers0", seq: "1780836300000001", action: "405", phase: null, delta: "-5.0", data: '{"dest":"warehouse2"}' },
    { stream: "sneakers0", seq: "1780836600000001", action: "406", phase: null, delta: "10.0", data: '{"src":"warehouse1"}' },
    { stream: "sneakers0", seq: "1780836900000001", action: "801", phase: "802", delta: "89.00", data: '{"m":"stripe","ref":"ref123","ph":{"802":1780836960}}' },
    // Local private
    { stream: "sneakers0", seq: "1", action: "102", phase: null, delta: "1.0", data: null, isLocal: true, time: "1780834200" },
    { stream: "sneakers0", seq: "2", action: "103", phase: null, delta: "-1.0", data: null, isLocal: true, time: "1780834500" },
    { stream: "sneakers0", seq: "3", action: "104", phase: null, delta: "0.0", data: '{"step":"billing"}', isLocal: true, time: "1780834560" }
  ];

  const pizzaMatter: MatterRow[] = [
    { id: "pizza", code: "PIZZA01", type: "product", scope: "g", owner: "pizzacompany", title: "Pepperoni Pizza", public: "1", data: '{"cat":"food","p":"12.00","o":{"s":["Small","Medium","Large"]}}', time: "1780833600" },
    { id: "extracheese", code: "MODCHEESE", type: "product", scope: "g", owner: "pizzacompany", title: "Extra Cheese", public: "1", data: '{"mod":1}', time: "1780833600" },
    { id: "pepperoni", code: "MODPEPPERONI", type: "product", scope: "g", owner: "pizzacompany", title: "Extra Pepperoni", public: "1", data: '{"mod":1}', time: "1780833600" },
    { id: "store102", code: "TAMILPIZZA", type: "profile", scope: "g", owner: "pizzacompany", title: "Tamil Pizza Shop", public: "1", data: '{"cat":"restaurant","cur":"INR"}', time: "1780833600" }
  ];

  const pizzaMass: MassRow[] = [
    { id: "pizza0", matter: "pizza", type: "1", scope: "s:102", qty: "50", value: "10.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
    { id: "pizza1", matter: "pizza", type: "1", scope: "s:102", qty: "50", value: "12.00", active: "1", variant: "1", mark: "0", time: "1780833600" },
    { id: "pizza2", matter: "pizza", type: "1", scope: "s:102", qty: "50", value: "15.00", active: "1", variant: "2", mark: "0", time: "1780833600" },
    { id: "pricecheese", matter: "extracheese", type: "1", scope: "s:102", qty: null, value: "1.50", active: "1", variant: null, mark: "0", time: "1780833600" },
    { id: "pricepepperoni", matter: "pepperoni", type: "1", scope: "s:102", qty: null, value: "2.00", active: "1", variant: null, mark: "0", time: "1780833600" }
  ];

  const pizzaMotion: MotionRow[] = [
    { stream: "pizza0", seq: "1780833900000002", action: "101", phase: null, delta: "-1.0", data: null },
    { stream: "pizza0", seq: "1780834200000002", action: "105", phase: "109", delta: "1.0", data: '{"ph":{"106":1780834320,"107":1780834500,"206":1780834560,"207":1780834800,"108":1780834920,"109":1780835100},"staff":"mgr01","kds":"kds1"}' },
    { stream: "pizza0", seq: "1780835400000002", action: "201", phase: null, delta: "10.00", data: '{"till":"till1"}' },
    { stream: "pizza0", seq: "1780835460000002", action: "801", phase: "802", delta: "10.00", data: '{"m":"card","ref":"tx992","ph":{"802":1780835520}}' }
  ];

  const OPCODE_LABELS: { [key: number]: string } = {
    101: "SOLD",
    102: "CART ADD",
    103: "CART REMOVE",
    104: "CHECKOUT",
    105: "PLACED",
    106: "CONFIRMED",
    107: "PREPARING",
    108: "READY",
    109: "DELIVERED",
    110: "INVOICE GEN",
    111: "REFUND",
    201: "SALE",
    206: "ORDER FIRE",
    207: "ITEM READY",
    405: "TRANSFER OUT",
    406: "TRANSFER IN",
    801: "PAYMENT INIT",
    802: "PAYMENT SUCCESS",
    805: "PAYMENT FAIL"
  };

  useEffect(() => {
    // Background SQLite seed verification
    const autoSeed = async () => {
      try {
        const db = getUserDb();
        if (db) {
          const rows = await db.all("SELECT id FROM matter WHERE id = 'sneakers'") as any[];
          if (rows.length === 0) {
            const nowStr = new Date().toISOString();
            await db.run(
              `INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['sneakers', 'SNEAKERS01', 'product', 'g', 'sneakercompany', 'Everyday Sneakers', 1, '{"cat":"retail","p":"89.00","o":{"c":["Black","Red"],"s":["S","M"]}}', nowStr]
            );
            await db.run(
              `INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['store101', 'TAMILSHOES', 'profile', 'g', 'sneakercompany', 'Tamil Shoes Store', 1, '{"cat":"store","cur":"INR"}', nowStr]
            );
          }
        }
      } catch (err) {
        console.error("Autoseed check failed:", err);
      } finally {
        setLoading(false);
      }
    };
    autoSeed();
  }, []);

  const getLogTimestamp = (log: MotionRow) => {
    if (log.isLocal && log.time) {
      return Number(log.time);
    }
    return Math.floor(Number(log.seq) / 1000000);
  };

  const getGroupedMotion = (list: MotionRow[]) => {
    const sortedList = [...list].sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
    const groups: { [key: string]: MotionRow[] } = {};
    sortedList.forEach(item => {
      if (!groups[item.stream]) {
        groups[item.stream] = [];
      }
      groups[item.stream].push(item);
    });
    return groups;
  };

  const parseAction = (actionStr: string) => {
    const codeNum = Number(actionStr);
    const text = OPCODE_LABELS[codeNum] || `OP ${actionStr}`;
    return { opcode: actionStr, text };
  };

  const formatTime = (log: MotionRow) => {
    const unixSecs = getLogTimestamp(log);
    const date = new Date(unixSecs * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const getStatusText = (action: string, phase: string | null) => {
    if (phase === null || phase === undefined || phase === action) return "";
    const activeOp = Number(phase);
    return OPCODE_LABELS[activeOp] || `OP ${activeOp}`;
  };



  const renderPhaseSubRows = (log: MotionRow) => {
    if (!log.data) return null;
    try {
      const parsed = JSON.parse(log.data);
      if (!parsed.ph) return null;
      
      const transitions = Object.entries(parsed.ph)
        .map(([opCode, timestamp]) => ({
          opCode: Number(opCode),
          timestamp: Number(timestamp)
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      if (transitions.length === 0) return null;

      return (
        <View>
          <View style={styles.itemDivider} />
          {transitions.map((t, sIdx) => {
            const timeStr = new Date(t.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const label = OPCODE_LABELS[t.opCode] || `OP ${t.opCode}`;
            return (
              <View key={sIdx}>
                <View style={styles.flatListRowItem}>
                  {/* Col 1: Time / Label */}
                  <View style={styles.col1}>
                    <View style={{ marginRight: 20, minWidth: 70 }}>
                      <Text style={{ fontSize: 9, color: "#94a3b8" }}>{timeStr}</Text>
                    </View>
                    <Text style={[styles.flatListActionText, { color: "#64748b", fontWeight: "500" }]}>
                      {label}
                    </Text>
                  </View>

                  {/* Col 3: Empty */}
                  <View style={styles.col3} />
                </View>
                {sIdx < transitions.length - 1 && <View style={styles.itemDivider} />}
              </View>
            );
          })}
        </View>
      );
    } catch (e) {
      return null;
    }
  };

  const groupedMotion = getGroupedMotion(activeTab === "sneakers" ? sneakerMotion : pizzaMotion);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#18181b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>POS Storefront</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs ordered: 1st Pizza (pepperoni), 2nd Sneakers */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "pizza" ? styles.tabButtonActive : null]}
          onPress={() => setActiveTab("pizza")}
        >
          <Ionicons
            name="pizza-outline"
            size={16}
            color={activeTab === "pizza" ? "#18181b" : "#71717a"}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabButtonText, activeTab === "pizza" ? styles.tabButtonTextActive : null] as any}>
            Pizza
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "sneakers" ? styles.tabButtonActive : null]}
          onPress={() => setActiveTab("sneakers")}
        >
          <Ionicons
            name="shirt-outline"
            size={16}
            color={activeTab === "sneakers" ? "#18181b" : "#71717a"}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabButtonText, activeTab === "sneakers" ? styles.tabButtonTextActive : null] as any}>
            Sneakers
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#18181b" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {activeTab === "pizza" ? (
            <View>
              {/* POS STOREFRONT PRODUCT DISPLAY */}
              <View style={styles.flatProductContainer}>
                <View style={styles.posInfoPanel}>
                  <Text style={styles.posTitle}>{pizzaMatter[0].title}</Text>
                  {/* Code shown directly under product title */}
                  <Text style={styles.posMetaCode}>@{pizzaMatter[0].code.toLowerCase()}</Text>
                  <Text style={styles.posOwnerText}>by {pizzaMatter[0].owner}</Text>
                  <Text style={styles.posPriceText}>$10.00 - $15.00</Text>
                </View>

                {/* Square sized Image container with absolute Top-Right toggle button */}
                <View style={styles.posEmojiContainerSquare}>
                  {viewMode === "pos" ? (
                    <View style={styles.posViewInnerContent}>
                      <Text style={styles.posBigEmojiFullWidth}>🍕</Text>
                      {/* Name along price at bottom left aligned */}
                      <View style={styles.posViewInfoOverlay}>
                        <Text style={styles.posViewOverlayTitle}>{pizzaMatter[0].title}</Text>
                        <Text style={styles.posViewOverlayPrice}>$10.00 - $15.00</Text>
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={require("../assets/images/pizza_storefront.jpg")}
                      style={styles.storefrontImage}
                      resizeMode="cover"
                    />
                  )}
                  {/* Top-Right Toggle Button */}
                  <TouchableOpacity
                    onPress={() => setViewMode(viewMode === "pos" ? "storefront" : "pos")}
                    style={styles.imageToggleContainer}
                  >
                    <Text style={styles.imageToggleText}>
                      {viewMode === "pos" ? "POS" : "STORE"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* AMAZON STYLE SPECIFICATIONS ACCORDION */}
                <TouchableOpacity
                  onPress={() => setPizzaExpanded(!pizzaExpanded)}
                  style={styles.detailsHeaderRow}
                >
                  <Text style={styles.detailsHeaderTitle}>Product Details & Specifications</Text>
                  <Ionicons
                    name={pizzaExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#1d4ed8"
                  />
                </TouchableOpacity>

                {pizzaExpanded && (
                  <View style={styles.detailsContentContainer}>
                    <Text style={styles.detailsSpecsTitle}>Technical Details</Text>
                    <View style={styles.detailsSpecsTable}>
                      <View style={[styles.detailsSpecsTableRow, styles.detailsSpecsTableRowAlt]}>
                        <Text style={styles.detailsSpecsKey}>Item Model Number</Text>
                        <Text style={styles.detailsSpecsVal}>@{pizzaMatter[0].code.toLowerCase()}</Text>
                      </View>
                      <View style={styles.detailsSpecsTableRow}>
                        <Text style={styles.detailsSpecsKey}>ASIN / Blueprint ID</Text>
                        <Text style={styles.detailsSpecsVal}>@{pizzaMatter[0].id.toLowerCase()}</Text>
                      </View>
                      <View style={[styles.detailsSpecsTableRow, styles.detailsSpecsTableRowAlt]}>
                        <Text style={styles.detailsSpecsKey}>Category</Text>
                        <Text style={styles.detailsSpecsVal}>Hot Food / Pizza</Text>
                      </View>
                      <View style={styles.detailsSpecsTableRow}>
                        <Text style={styles.detailsSpecsKey}>Manufacturer</Text>
                        <Text style={styles.detailsSpecsVal}>{pizzaMatter[0].owner}</Text>
                      </View>
                      <View style={[styles.detailsSpecsTableRow, styles.detailsSpecsTableRowAlt]}>
                        <Text style={styles.detailsSpecsKey}>Scope / Region</Text>
                        <Text style={styles.detailsSpecsVal}>Global (g)</Text>
                      </View>
                      <View style={styles.detailsSpecsTableRow}>
                        <Text style={styles.detailsSpecsKey}>Visibility</Text>
                        <Text style={styles.detailsSpecsVal}>Public Shared (1)</Text>
                      </View>
                    </View>

                    <Text style={styles.detailsSpecsTitle}>About this item</Text>
                    <View style={styles.detailsBulletContainer}>
                      <View style={styles.detailsBulletRow}>
                        <Text style={styles.detailsBulletDot}>•</Text>
                        <Text style={styles.detailsBulletText}>
                          Freshly baked stone-oven crust topped with signature marinara, mozzarella cheese, and spicy beef pepperoni.
                        </Text>
                      </View>
                      <View style={styles.detailsBulletRow}>
                        <Text style={styles.detailsBulletDot}>•</Text>
                        <Text style={styles.detailsBulletText}>
                          Customize instantly with modifier blueprints like extra cheese and extra pepperoni to suit your taste.
                        </Text>
                      </View>
                      <View style={styles.detailsBulletRow}>
                        <Text style={styles.detailsBulletDot}>•</Text>
                        <Text style={styles.detailsBulletText}>
                          Fired directly to kitchen display systems and tracked using POS-native status update motion ledgers.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Grid selection boxes (POS style) */}
                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Pizza Size</Text>
                  <View style={styles.posOptionsGrid}>
                    {["Small", "Medium", "Large"].map(sz => {
                      const isSelected = posPizzaSize === sz;
                      const price = sz === "Small" ? 10.00 : (sz === "Medium" ? 12.00 : 15.00);
                      return (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => setPosPizzaSize(sz)}
                          style={[
                            styles.posGridSelectBox,
                            isSelected ? styles.posGridSelectBoxSelected : null
                          ] as any}
                        >
                          <Text style={styles.posEmojiIconSmall}>🍕</Text>
                          <View style={styles.posGridSelectBoxTextContainer}>
                            <Text style={[styles.posGridBoxTitle, isSelected ? styles.posGridBoxTitleSelected : null] as any}>
                              {sz}
                            </Text>
                            <Text style={styles.posGridBoxSubtitle}>${price.toFixed(2)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Toppings</Text>
                  <View style={styles.posOptionsGrid}>
                    {/* Extra Cheese */}
                    <TouchableOpacity
                      onPress={() => setPosCheese(!posCheese)}
                      style={[
                        styles.posGridSelectBox,
                        posCheese ? styles.posGridSelectBoxSelected : null
                      ] as any}
                    >
                      <Text style={styles.posEmojiIconSmall}>🧀</Text>
                      <View style={styles.posGridSelectBoxTextContainer}>
                        <Text style={[styles.posGridBoxTitle, posCheese ? styles.posGridBoxTitleSelected : null] as any}>
                          Extra Cheese
                        </Text>
                        <Text style={styles.posGridBoxSubtitle}>+$1.50</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Extra Pepperoni */}
                    <TouchableOpacity
                      onPress={() => setPosPepperoni(!posPepperoni)}
                      style={[
                        styles.posGridSelectBox,
                        posPepperoni ? styles.posGridSelectBoxSelected : null
                      ] as any}
                    >
                      <Text style={styles.posEmojiIconSmall}>🥓</Text>
                      <View style={styles.posGridSelectBoxTextContainer}>
                        <Text style={[styles.posGridBoxTitle, posPepperoni ? styles.posGridBoxTitleSelected : null] as any}>
                          Pepperoni Topper
                        </Text>
                        <Text style={styles.posGridBoxSubtitle}>+$2.00</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* STORE PROFILE */}
              <View style={styles.flatStoreContainer}>
                <View style={styles.profileHeaderRow}>
                  {/* Verified business profile style brand illustration picture */}
                  <View style={[styles.profileAvatarSquare, { backgroundColor: "#881337" }]}>
                    <Text style={styles.profileAvatarBrandText}>TP</Text>
                  </View>
                  <View style={styles.profileHeaderText}>
                    <Text style={styles.profileTitle}>{pizzaMatter[3].title}</Text>
                    <Text style={styles.profileHandleText}>@{pizzaMatter[3].code.toLowerCase()}</Text>
                  </View>
                  <View style={styles.profileBadge}>
                    <Text style={styles.profileBadgeText}>KDS SCREEN</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* MASS REALIZATIONS */}
              <Text style={styles.visualSectionHeader}>Inventory</Text>
              <View style={styles.flatListGroupContainer}>
                {pizzaMass.map((item, index) => {
                  const isModifier = item.id.startsWith("price");
                  const isSelectedCheese = item.id === "pricecheese" && posCheese;
                  const isSelectedPep = item.id === "pricepepperoni" && posPepperoni;
                  const pizzaSizes = ["Small", "Medium", "Large"];
                  const sizeName = item.variant !== null ? pizzaSizes[Number(item.variant)] : "";
                  const isSelectedSize = !isModifier && posPizzaSize === sizeName;
                  const isSelected = isSelectedCheese || isSelectedPep || isSelectedSize;

                  return (
                    <View key={index}>
                      <View
                        style={[
                          styles.massListCard,
                          isSelected ? styles.massListCardSelected : null,
                        ] as any}
                      >
                        <View style={styles.massListLeft}>
                          <Ionicons
                            name={isModifier ? "options-outline" : "pizza-outline"}
                            size={16}
                            color="#1d4ed8"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={[styles.massVariantTitle, isSelected ? { color: "#1d4ed8" } : null] as any}>
                            {isModifier
                              ? (item.id === "pricecheese" ? "Extra Cheese Topper" : "Pepperoni Topper")
                              : `Pizza Size: ${sizeName}`
                            }
                          </Text>
                        </View>
                        <View style={styles.massListRight}>
                          <Text style={styles.massVariantPrice}>${Number(item.value).toFixed(2)}</Text>
                          <Text style={[styles.massStockText, item.qty === null ? { color: "#64748b" } : styles.inStockCol] as any}>
                            {item.qty !== null ? `${item.qty} units` : "untracked"}
                          </Text>
                        </View>
                      </View>
                      {index < pizzaMass.length - 1 && <View style={styles.itemDivider} />}
                    </View>
                  );
                })}
              </View>

              <View style={styles.sectionDivider} />

              {/* MOTION FLATLIST GROUPED BY STREAMID */}
              <Text style={styles.visualSectionHeader}>Ledger</Text>

              {Object.keys(groupedMotion).map((streamId, groupIdx) => (
                <View key={streamId}>
                  <View style={styles.streamHeaderRow}>
                    <Ionicons name="git-branch-outline" size={14} color="#1d4ed8" style={{ marginRight: 6 }} />
                    <Text style={styles.streamTitleText}>STREAM ID: {streamId}</Text>
                  </View>
                  
                  {/* Table Header Row */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>SEQ / TIME / ACTION</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>DELTA</Text>
                  </View>

                  <View style={styles.flatListWrapper}>
                    {groupedMotion[streamId].map((log, idx) => {
                      const parsed = parseAction(log.action);
                      return (
                        <View key={idx}>
                          <View style={styles.flatListRowItem}>
                            {/* Col 1: Action & Opcode */}
                            <View style={styles.col1}>
                              <View style={{ marginRight: 20, minWidth: 70 }}>
                                <Text style={styles.flatListRowSeq}>
                                  {log.isLocal ? `#${log.seq}` : `#${log.seq.slice(-4)}`}
                                </Text>
                                <Text style={{ fontSize: 9, color: "#94a3b8" }}>{formatTime(log)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.flatListActionText}>{parsed.text}</Text>
                              </View>
                            </View>

                            {/* Col 3: Strategy & Delta */}
                            <View style={styles.col3}>
                              <Text style={[
                                styles.flatListDeltaText,
                                Number(log.delta) < 0 ? styles.outStockCol : styles.inStockCol
                              ] as any}>
                                {Number(log.delta) > 0 ? `+${log.delta}` : log.delta}
                              </Text>

                            </View>
                          </View>
                          {renderPhaseSubRows(log)}
                          {idx < groupedMotion[streamId].length - 1 && <View style={styles.itemDivider} />}
                        </View>
                      );
                    })}
                  </View>
                  {groupIdx < Object.keys(groupedMotion).length - 1 && <View style={styles.sectionDivider} />}
                </View>
              ))}
            </View>
          ) : (
            <View>
              {/* POS STOREFRONT PRODUCT DISPLAY */}
              <View style={styles.flatProductContainer}>
                <View style={styles.posInfoPanel}>
                  <Text style={styles.posTitle}>{sneakerMatter[0].title}</Text>
                  {/* Code shown directly under product title */}
                  <Text style={styles.posMetaCode}>@{sneakerMatter[0].code.toLowerCase()}</Text>
                  <Text style={styles.posOwnerText}>by {sneakerMatter[0].owner}</Text>
                  <Text style={styles.posPriceText}>$89.00 - $95.00</Text>
                </View>

                {/* Square sized Image container with absolute Top-Right toggle button */}
                <View style={styles.posEmojiContainerSquare}>
                  {viewMode === "pos" ? (
                    <View style={styles.posViewInnerContent}>
                      <Text style={styles.posBigEmojiFullWidth}>👟</Text>
                      {/* Name along price at bottom left aligned */}
                      <View style={styles.posViewInfoOverlay}>
                        <Text style={styles.posViewOverlayTitle}>{sneakerMatter[0].title}</Text>
                        <Text style={styles.posViewOverlayPrice}>$89.00 - $95.00</Text>
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={require("../assets/images/sneaker_storefront.png")}
                      style={styles.storefrontImage}
                      resizeMode="cover"
                    />
                  )}
                  {/* Top-Right Toggle Button */}
                  <TouchableOpacity
                    onPress={() => setViewMode(viewMode === "pos" ? "storefront" : "pos")}
                    style={styles.imageToggleContainer}
                  >
                    <Text style={styles.imageToggleText}>
                      {viewMode === "pos" ? "POS" : "STORE"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* AMAZON STYLE SPECIFICATIONS ACCORDION */}
                <TouchableOpacity
                  onPress={() => setSneakerExpanded(!sneakerExpanded)}
                  style={styles.detailsHeaderRow}
                >
                  <Text style={styles.detailsHeaderTitle}>Product Details & Specifications</Text>
                  <Ionicons
                    name={sneakerExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#1d4ed8"
                  />
                </TouchableOpacity>

                {sneakerExpanded && (
                  <View style={styles.detailsContentContainer}>
                    <Text style={styles.detailsSpecsTitle}>Technical Details</Text>
                    <View style={styles.detailsSpecsTable}>
                      <View style={[styles.detailsSpecsTableRow, styles.detailsSpecsTableRowAlt]}>
                        <Text style={styles.detailsSpecsKey}>Item Model Number</Text>
                        <Text style={styles.detailsSpecsVal}>@{sneakerMatter[0].code.toLowerCase()}</Text>
                      </View>
                      <View style={styles.detailsSpecsTableRow}>
                        <Text style={styles.detailsSpecsKey}>ASIN / Blueprint ID</Text>
                        <Text style={styles.detailsSpecsVal}>@{sneakerMatter[0].id.toLowerCase()}</Text>
                      </View>
                      <View style={[styles.detailsSpecsTableRow, styles.detailsSpecsTableRowAlt]}>
                        <Text style={styles.detailsSpecsKey}>Department</Text>
                        <Text style={styles.detailsSpecsVal}>Unisex-Adult</Text>
                      </View>
                      <View style={styles.detailsSpecsTableRow}>
                        <Text style={styles.detailsSpecsKey}>Manufacturer</Text>
                        <Text style={styles.detailsSpecsVal}>{sneakerMatter[0].owner}</Text>
                      </View>
                      <View style={[styles.detailsSpecsTableRow, styles.detailsSpecsTableRowAlt]}>
                        <Text style={styles.detailsSpecsKey}>Scope / Region</Text>
                        <Text style={styles.detailsSpecsVal}>Global (g)</Text>
                      </View>
                      <View style={styles.detailsSpecsTableRow}>
                        <Text style={styles.detailsSpecsKey}>Visibility</Text>
                        <Text style={styles.detailsSpecsVal}>Public Shared (1)</Text>
                      </View>
                    </View>

                    <Text style={styles.detailsSpecsTitle}>About this item</Text>
                    <View style={styles.detailsBulletContainer}>
                      <View style={styles.detailsBulletRow}>
                        <Text style={styles.detailsBulletDot}>•</Text>
                        <Text style={styles.detailsBulletText}>
                          Premium canvas & athletic mesh upper providing breathable comfort all day long.
                        </Text>
                      </View>
                      <View style={styles.detailsBulletRow}>
                        <Text style={styles.detailsBulletDot}>•</Text>
                        <Text style={styles.detailsBulletText}>
                          Dynamic configuration capabilities supporting real-time option switching for color and size.
                        </Text>
                      </View>
                      <View style={styles.detailsBulletRow}>
                        <Text style={styles.detailsBulletDot}>•</Text>
                        <Text style={styles.detailsBulletText}>
                          Full local replication ledgers synchronized via TAMILSHOES regional store profile databases.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Grid selection boxes (POS style) */}
                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Color</Text>
                  <View style={styles.posOptionsGrid}>
                    {["Black", "Red"].map(col => {
                      const isSelected = posColor === col;
                      return (
                        <TouchableOpacity
                          key={col}
                          onPress={() => setPosColor(col)}
                          style={[
                            styles.posGridSelectBox,
                            isSelected ? styles.posGridSelectBoxSelected : null
                          ] as any}
                        >
                          <View style={[
                            styles.posColorDot,
                            { backgroundColor: col.toLowerCase() === "black" ? "#000" : "#ef4444" }
                          ]} />
                          <View style={styles.posGridSelectBoxTextContainer}>
                            <Text style={[styles.posGridBoxTitle, isSelected ? styles.posGridBoxTitleSelected : null] as any}>
                              {col}
                            </Text>
                            <Text style={styles.posGridBoxSubtitle}>Everyday Color</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Size</Text>
                  <View style={styles.posOptionsGrid}>
                    {["S", "M"].map(sz => {
                      const isSelected = posSize === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => setPosSize(sz)}
                          style={[
                            styles.posGridSelectBox,
                            isSelected ? styles.posGridSelectBoxSelected : null
                          ] as any}
                        >
                          <Text style={styles.posEmojiIconSmall}>👟</Text>
                          <View style={styles.posGridSelectBoxTextContainer}>
                            <Text style={[styles.posGridBoxTitle, isSelected ? styles.posGridBoxTitleSelected : null] as any}>
                              Size {sz}
                            </Text>
                            <Text style={styles.posGridBoxSubtitle}>Standard Fit</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* STORE PROFILE */}
              <View style={styles.flatStoreContainer}>
                <View style={styles.profileHeaderRow}>
                  {/* Verified business profile style brand illustration picture */}
                  <View style={[styles.profileAvatarSquare, { backgroundColor: "#1e293b" }]}>
                    <Text style={styles.profileAvatarBrandText}>TS</Text>
                  </View>
                  <View style={styles.profileHeaderText}>
                    <Text style={styles.profileTitle}>{sneakerMatter[1].title}</Text>
                    <Text style={styles.profileHandleText}>@{sneakerMatter[1].code.toLowerCase()}</Text>
                  </View>
                  <View style={styles.profileBadge}>
                    <Text style={styles.profileBadgeText}>INR STORE</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* MASS REALIZATIONS */}
              <Text style={styles.visualSectionHeader}>Inventory</Text>
              <View style={styles.flatListGroupContainer}>
                {sneakerMass.map((variant, index) => {
                  const matterData = JSON.parse(sneakerMatter[0].data);
                  const colors = matterData.o?.c || [];
                  const sizes = matterData.o?.s || [];
                  const variantIdx = Number(variant.variant);
                  const colorIdx = Math.floor(variantIdx / sizes.length);
                  const sizeIdx = variantIdx % sizes.length;
                  const colorName = colors[colorIdx];
                  const sizeName = sizes[sizeIdx];
                  const isOutOfStock = Number(variant.qty) <= 0;
                  const isCurrentSelection = colorName === posColor && sizeName === posSize;

                  return (
                    <View key={index}>
                      <View
                        style={[
                          styles.massListCard,
                          isCurrentSelection ? styles.massListCardSelected : null,
                        ] as any}
                      >
                        <View style={styles.massListLeft}>
                          <View style={[
                            styles.massColorBadge,
                            { backgroundColor: colorName?.toLowerCase() === "black" ? "#000" : "#ef4444" }
                          ]} />
                          <Text style={[styles.massVariantTitle, isCurrentSelection ? { color: "#1d4ed8" } : null] as any}>
                            {colorName} / Size {sizeName}
                          </Text>
                        </View>
                        <View style={styles.massListRight}>
                          <Text style={styles.massVariantPrice}>${Number(variant.value).toFixed(2)}</Text>
                          <Text style={[
                            styles.massStockText,
                            isOutOfStock ? styles.outStockCol : styles.inStockCol
                          ] as any}>
                            {isOutOfStock ? "SOLD OUT" : `${variant.qty} available`}
                          </Text>
                        </View>
                      </View>
                      {index < sneakerMass.length - 1 && <View style={styles.itemDivider} />}
                    </View>
                  );
                })}
              </View>

              <View style={styles.sectionDivider} />

              {/* MOTION FLATLIST GROUPED BY STREAMID */}
              <Text style={styles.visualSectionHeader}>Ledger</Text>

              {Object.keys(groupedMotion).map((streamId, groupIdx) => (
                <View key={streamId}>
                  <View style={styles.streamHeaderRow}>
                    <Ionicons name="git-branch-outline" size={14} color="#1d4ed8" style={{ marginRight: 6 }} />
                    <Text style={styles.streamTitleText}>STREAM ID: {streamId}</Text>
                  </View>
                  
                  {/* Table Header Row */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>SEQ / TIME / ACTION</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>DELTA</Text>
                  </View>

                  <View style={styles.flatListWrapper}>
                    {groupedMotion[streamId].map((log, idx) => {
                      const parsed = parseAction(log.action);
                      return (
                        <View key={idx}>
                          <View style={styles.flatListRowItem}>
                            {/* Col 1: Action & Opcode */}
                            <View style={styles.col1}>
                              <View style={{ marginRight: 20, minWidth: 70 }}>
                                <Text style={styles.flatListRowSeq}>
                                  {log.isLocal ? `#${log.seq}` : `#${log.seq.slice(-4)}`}
                                </Text>
                                <Text style={{ fontSize: 9, color: "#94a3b8" }}>{formatTime(log)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.flatListActionText}>{parsed.text}</Text>
                              </View>
                            </View>

                            {/* Col 3: Strategy & Delta */}
                            <View style={styles.col3}>
                              <Text style={[
                                styles.flatListDeltaText,
                                Number(log.delta) < 0 ? styles.outStockCol : styles.inStockCol
                              ] as any}>
                                {Number(log.delta) > 0 ? `+${log.delta}` : log.delta}
                              </Text>

                            </View>
                          </View>
                          {renderPhaseSubRows(log)}
                          {idx < groupedMotion[streamId].length - 1 && <View style={styles.itemDivider} />}
                        </View>
                      );
                    })}
                  </View>
                  {groupIdx < Object.keys(groupedMotion).length - 1 && <View style={styles.sectionDivider} />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: "#ffffff"
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b"
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    gap: 4
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  tabButtonActive: {
    borderBottomColor: "#18181b"
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a"
  },
  tabButtonTextActive: {
    color: "#18181b"
  },
  scroll: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  visualSectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase"
  },
  flatProductContainer: {
    backgroundColor: "#ffffff",
    paddingVertical: 8
  },
  flatStoreContainer: {
    backgroundColor: "#ffffff",
    paddingVertical: 8
  },
  posBadgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center"
  },
  posMetaCode: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 2
  },
  posInfoPanel: {
    width: "100%"
  },
  posTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  posOwnerText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4
  },
  posPriceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d4ed8",
    marginTop: 4
  },
  posEmojiContainerSquare: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
    position: "relative",
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  posViewInnerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative"
  },
  posViewInfoOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    alignItems: "flex-start"
  },
  posViewOverlayTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a"
  },
  posViewOverlayPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
    marginTop: 2
  },
  storefrontImage: {
    width: "100%",
    height: "100%"
  },
  imageToggleContainer: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  imageToggleText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1d4ed8"
  },
  posBigEmojiFullWidth: {
    fontSize: 72,
    transform: [{ translateY: -15 }]
  },
  posColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 4
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  profileAvatarSquare: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0"
  },
  profileAvatarBrandText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  },
  profileHeaderText: {
    flex: 1
  },
  profileTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  profileHandleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1
  },
  profileBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  profileBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1d4ed8"
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#f4f4f5",
    marginVertical: 20
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#f4f4f5",
    marginVertical: 4
  },
  massListCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 12
  },
  massListCardSelected: {
    backgroundColor: "#ffffff"
  },
  massListLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  massColorBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12
  },
  massVariantTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a"
  },
  massListRight: {
    alignItems: "flex-end"
  },
  massVariantPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  massStockText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1
  },
  inStockCol: {
    color: "#10b981"
  },
  outStockCol: {
    color: "#ef4444"
  },
  flatListGroupContainer: {
    backgroundColor: "#ffffff"
  },
  streamHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 8
  },
  streamTitleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1d4ed8",
    letterSpacing: 0.5
  },
  flatListWrapper: {
    gap: 8
  },
  flatListRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8
  },
  col1: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center"
  },
  col2: {
    flex: 1,
    justifyContent: "center"
  },
  col3: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  flatListRowSeq: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700"
  },
  flatListPointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1d4ed8",
    marginRight: 10
  },
  flatListActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b"
  },
  flatListOpcodeText: {
    fontSize: 9,
    color: "#64748b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 1
  },
  flatListStatusColumnText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "700"
  },
  flatListStrategyBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2
  },
  flatListStrategyText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#1d4ed8"
  },
  flatListDeltaText: {
    fontSize: 12,
    fontWeight: "800"
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // --- POS STYLING SHEETS ---
  posOptionsSectionGrid: {
    marginTop: 14
  },
  posGridSectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8
  },
  posOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  posGridSelectBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: "45%",
    borderWidth: 2,
    borderColor: "transparent",
    gap: 10
  },
  posGridSelectBoxTextContainer: {
    flex: 1
  },
  posGridSelectBoxSelected: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff"
  },
  posGridBoxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#18181b"
  },
  posGridBoxTitleSelected: {
    color: "#1d4ed8"
  },
  posGridBoxSubtitle: {
    fontSize: 11,
    color: "#71717a",
    marginTop: 1
  },
  posEmojiIconSmall: {
    fontSize: 18
  },

  // --- COLLAPSIBLE SPECS & BULLETS STYLE ---
  detailsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    marginTop: 12
  },
  detailsHeaderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1d4ed8"
  },
  detailsContentContainer: {
    paddingVertical: 12,
    gap: 12
  },
  detailsSpecsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1e293b",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  detailsSpecsTable: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden"
  },
  detailsSpecsTableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  detailsSpecsTableRowAlt: {
    backgroundColor: "#f8fafc"
  },
  detailsSpecsKey: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b"
  },
  detailsSpecsVal: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a"
  },
  detailsBulletContainer: {
    gap: 6
  },
  detailsBulletRow: {
    flexDirection: "row",
    gap: 8
  },
  detailsBulletDot: {
    fontSize: 14,
    color: "#1d4ed8",
    lineHeight: 16
  },
  detailsBulletText: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
    lineHeight: 16
  },
  detailContainer: {
    paddingLeft: 64,
    paddingTop: 4,
    paddingBottom: 6,
  },
  detailBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  detailBadge: {
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#71717a",
  },
  timelineWrapper: {
    marginTop: 4,
  },
  timelineHeader: {
    fontSize: 9,
    fontWeight: "800",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timelinePath: {
    borderLeftWidth: 1,
    borderLeftColor: "#e4e4e7",
    paddingLeft: 8,
    marginLeft: 3,
    gap: 4,
  },
  timelineStep: {
    flexDirection: "row",
    alignItems: "center",
  },
  timelineNode: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#a1a1aa",
    position: "absolute",
    left: -11,
  },
  timelineStepText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#52525b",
  }
});
