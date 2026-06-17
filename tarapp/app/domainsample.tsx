import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  MatterRow,
  MotionRow,
  TechnicalDetail,
  DomainDefinition,
  DOMAINS,
  OPCODE_LABELS
} from "../lib/domainsData";

export default function DomainSampleScreen() {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<DomainDefinition>(DOMAINS[0]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // --- IMAGE VIEW TOGGLE (POS vs STOREFRONT) ---
  const [viewMode, setViewMode] = useState<"pos" | "storefront">("pos");

  // --- INTERACTIVE OPTION STATES ---
  // Pizza
  const [posPizzaSize, setPosPizzaSize] = useState("Medium");
  const [posCheese, setPosCheese] = useState(true);
  const [posPepperoni, setPosPepperoni] = useState(false);

  // Sneakers
  const [posColor, setPosColor] = useState("Black");
  const [posSize, setPosSize] = useState("S");

  // Retail
  const [retailSize, setRetailSize] = useState("M");
  const [retailDiscount, setRetailDiscount] = useState(false);

  // POS (Chicken Biryani)
  const [posSpice, setPosSpice] = useState("medium");
  const [posFired, setPosFired] = useState(false);






  // Dynamic Ledger State
  const [localMass, setLocalMass] = useState<MatterRow[]>(selectedDomain.matters);
  const [localMotion, setLocalMotion] = useState<MotionRow[]>(selectedDomain.motions);

  // Reset expandable whenever active domain changes, and synchronize local motion list
  useEffect(() => {
    setExpanded(false);
    setViewMode("pos");
    setLocalMass(selectedDomain.matters);
    setLocalMotion(selectedDomain.motions);
  }, [selectedDomain]);

  const selectDomain = (domain: DomainDefinition) => {
    setSelectedDomain(domain);
    setIsDropdownVisible(false);
  };

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
        <View style={styles.phaseSubContainer}>
          <View style={styles.itemDivider} />
          {transitions.map((t, sIdx) => {
            const timeStr = new Date(t.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const label = OPCODE_LABELS[t.opCode] || `OP ${t.opCode}`;
            return (
              <View key={sIdx}>
                <View style={styles.flatListRowItem}>
                  <View style={styles.col1}>
                    <View style={{ marginRight: 20, minWidth: 70 }}>
                      <Text style={{ fontSize: 9, color: "#94a3b8" }}>{timeStr}</Text>
                    </View>
                    <Text style={[styles.flatListActionText, { color: "#64748b", fontWeight: "500" }]}>
                      {label}
                    </Text>
                  </View>
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

  const groupedMotion = getGroupedMotion(localMotion);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* CUSTOM DROPDOWN SELECTOR BLOCK */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          onPress={() => setIsDropdownVisible(true)}
          style={[styles.dropdownButton, { borderWidth: 0, paddingHorizontal: 0 }]}
          activeOpacity={0.7}
        >
          <View style={styles.dropdownLeft}>
            <Text style={styles.dropdownEmoji}>{selectedDomain.emoji}</Text>
            <View>
              <Text style={styles.dropdownSubTitle}>ACTIVE SYSTEM DOMAIN</Text>
              <Text style={[styles.dropdownTitle, { color: "#18181b" }]}>{selectedDomain.name}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#71717a" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          
          {/* PRODUCT DISPLAY & STYLING */}
          <View style={styles.flatProductContainer}>
            <View style={styles.posInfoPanel}>
              <Text style={styles.posTitle}>{selectedDomain.title}</Text>
              <Text style={styles.posMetaCode}>@{selectedDomain.code.toLowerCase()}</Text>
              <Text style={styles.posOwnerText}>by {selectedDomain.owner}</Text>
              <Text style={styles.posPriceText}>{selectedDomain.priceRange}</Text>
            </View>

            {/* Square aspect ratio image or emoji placeholder with bottom-left details */}
            {selectedDomain.id !== "crm" && (
              <View style={styles.posEmojiContainerSquare}>
                {viewMode === "pos" || !selectedDomain.image ? (
                  <View style={styles.posViewInnerContent}>
                    <Text style={styles.posBigEmojiFullWidth}>{selectedDomain.emoji}</Text>
                    <View style={styles.posViewInfoOverlay}>
                      <Text style={styles.posViewOverlayTitle}>{selectedDomain.title}</Text>
                      <Text style={styles.posViewOverlayPrice}>{selectedDomain.priceRange}</Text>
                    </View>
                  </View>
                ) : (
                  <Image
                    source={selectedDomain.image}
                    style={styles.storefrontImage}
                    resizeMode="cover"
                  />
                )}
                {selectedDomain.image && (
                  <TouchableOpacity
                    onPress={() => setViewMode(viewMode === "pos" ? "storefront" : "pos")}
                    style={styles.imageToggleContainer}
                  >
                    <Text style={styles.imageToggleText}>
                      {viewMode === "pos" ? "POS" : "STORE"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* COLLAPSIBLE SPECIFICATIONS ACCORDION (Hidden for CRM & Support) */}
            {selectedDomain.id !== "crm" && (
              <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                style={styles.detailsHeaderRow}
              >
                <Text style={styles.detailsHeaderTitle}>Product Details & Specifications</Text>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#1d4ed8"
                />
              </TouchableOpacity>
            )}

            {selectedDomain.id !== "crm" && expanded && (
              <View style={styles.detailsContentContainer}>
                <Text style={styles.detailsSpecsTitle}>Technical Details</Text>
                <View style={styles.detailsSpecsTable}>
                  {selectedDomain.technicalDetails.map((detail, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.detailsSpecsTableRow,
                        idx % 2 === 1 ? styles.detailsSpecsTableRowAlt : null
                      ]}
                    >
                      <Text style={styles.detailsSpecsKey}>{detail.key}</Text>
                      <Text style={styles.detailsSpecsVal}>{detail.val}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.detailsSpecsTitle}>About this item</Text>
                <View style={styles.detailsBulletContainer}>
                  {selectedDomain.bullets.map((bullet, idx) => (
                    <View key={idx} style={styles.detailsBulletRow}>
                      <Text style={styles.detailsBulletDot}>•</Text>
                      <Text style={styles.detailsBulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* INTERACTIVE OPTIONS GRID */}
            {selectedDomain.id === "pizza" && (
              <View>
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
            )}

            {selectedDomain.id === "sneakers" && (
              <View>
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
            )}



            {selectedDomain.id === "retail" && (
              <View>
                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Thermos Size</Text>
                  <View style={styles.posOptionsGrid}>
                    {["S", "M", "L"].map(sz => {
                      const isSelected = retailSize === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => setRetailSize(sz)}
                          style={[
                            styles.posGridSelectBox,
                            isSelected ? styles.posGridSelectBoxSelected : null
                          ] as any}
                        >
                          <Text style={styles.posEmojiIconSmall}>🍼</Text>
                          <View style={styles.posGridSelectBoxTextContainer}>
                            <Text style={[styles.posGridBoxTitle, isSelected ? styles.posGridBoxTitleSelected : null] as any}>
                              Size {sz}
                            </Text>
                            <Text style={styles.posGridBoxSubtitle}>Titanium Body</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Promos & Coupons</Text>
                  <View style={styles.posOptionsGrid}>
                    <TouchableOpacity
                      onPress={() => setRetailDiscount(!retailDiscount)}
                      style={[
                        styles.posGridSelectBox,
                        retailDiscount ? styles.posGridSelectBoxSelected : null
                      ] as any}
                    >
                      <Text style={styles.posEmojiIconSmall}>🏷️</Text>
                      <View style={styles.posGridSelectBoxTextContainer}>
                        <Text style={[styles.posGridBoxTitle, retailDiscount ? styles.posGridBoxTitleSelected : null] as any}>
                          SAVE50 Flash
                        </Text>
                        <Text style={styles.posGridBoxSubtitle}>50% Off Total</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {selectedDomain.id === "pos" && (
              <View>
                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Spice Preference</Text>
                  <View style={styles.posOptionsGrid}>
                    {["mild", "medium", "hot"].map(sp => {
                      const isSelected = posSpice === sp;
                      return (
                        <TouchableOpacity
                          key={sp}
                          onPress={() => setPosSpice(sp)}
                          style={[
                            styles.posGridSelectBox,
                            isSelected ? styles.posGridSelectBoxSelected : null
                          ] as any}
                        >
                          <Text style={styles.posEmojiIconSmall}>🌶️</Text>
                          <View style={styles.posGridSelectBoxTextContainer}>
                            <Text style={[styles.posGridBoxTitle, isSelected ? styles.posGridBoxTitleSelected : null] as any}>
                              {sp.toUpperCase()}
                            </Text>
                            <Text style={styles.posGridBoxSubtitle}>Authentic Spices</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.posOptionsSectionGrid}>
                  <Text style={styles.posGridSectionLabel}>Kitchen Dispatch</Text>
                  <View style={styles.posOptionsGrid}>
                    <TouchableOpacity
                      onPress={() => setPosFired(!posFired)}
                      style={[
                        styles.posGridSelectBox,
                        posFired ? styles.posGridSelectBoxSelected : null
                      ] as any}
                    >
                      <Text style={styles.posEmojiIconSmall}>🔥</Text>
                      <View style={styles.posGridSelectBoxTextContainer}>
                        <Text style={[styles.posGridBoxTitle, posFired ? styles.posGridBoxTitleSelected : null] as any}>
                          {posFired ? "Ordered!" : "Fire Order"}
                        </Text>
                        <Text style={styles.posGridBoxSubtitle}>To Table 4 KDS</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}















          </View>

          <View style={styles.sectionDivider} />

          {/* STORE PROFILE CARD (1000% MATCHING ORIGINAL) */}
          <View style={styles.flatStoreContainer}>
            <View style={styles.profileHeaderRow}>
              <View style={[styles.profileAvatarSquare, { backgroundColor: selectedDomain.profileAvatarBg }]}>
                <Text style={styles.profileAvatarBrandText}>{selectedDomain.profileAvatarText}</Text>
              </View>
              <View style={styles.profileHeaderText}>
                <Text style={styles.profileTitle}>{selectedDomain.profileTitle}</Text>
                <Text style={styles.profileHandleText}>@{selectedDomain.profileCode.toLowerCase()}</Text>
              </View>
              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>{selectedDomain.profileBadgeText}</Text>
              </View>
            </View>
          </View>

          {selectedDomain.id !== "crm" && (
          <>
          <View style={styles.sectionDivider} />

          {/* INVENTORY / MASS REALIZATIONS (1000% MATCHING ORIGINAL) */}
          <Text style={styles.visualSectionHeader}>Inventory</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Realized Mass / Matter</Text>
            <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Value & Quantity</Text>
          </View>
          <View style={styles.flatListGroupContainer}>
            {localMass.map((item, index) => {
              // Logic to highlight item if selected in options
              let isSelected = false;
              let title = item.id;
              
              if (selectedDomain.id === "pizza") {
                const isModifier = item.id.startsWith("price");
                const isSelectedCheese = item.id === "pricecheese" && posCheese;
                const isSelectedPep = item.id === "pricepepperoni" && posPepperoni;
                const pizzaSizes = ["Small", "Medium", "Large"];
                const sizeName = item.variant !== null ? pizzaSizes[Number(item.variant)] : "";
                const isSelectedSize = !isModifier && posPizzaSize === sizeName;
                isSelected = isSelectedCheese || isSelectedPep || isSelectedSize;
                title = isModifier
                  ? (item.id === "pricecheese" ? "Extra Cheese Topper" : "Pepperoni Topper")
                  : `Pizza Size: ${sizeName}`;
              } else if (selectedDomain.id === "sneakers") {
                const colors = ["Black", "Red"];
                const sizes = ["S", "M"];
                const variantIdx = Number(item.variant);
                const colorIdx = Math.floor(variantIdx / sizes.length);
                const sizeIdx = variantIdx % sizes.length;
                const colorName = colors[colorIdx];
                const sizeName = sizes[sizeIdx];
                isSelected = colorName === posColor && sizeName === posSize;
                title = `${colorName} / Size ${sizeName}`;
              } else if (selectedDomain.id === "retail") {
                const sizeName = item.variant === "0" ? "S" : (item.variant === "1" ? "M" : "L");
                isSelected = item.type === "stock" && retailSize === sizeName;
                title = item.type === "cart" ? "Storefront Checkout Cart" : `Thermos Stock Size: ${sizeName}`;
              } else if (selectedDomain.id === "pos") {
                isSelected = item.type === "stock" && posSpice === "medium";
                title = item.type === "slot" ? "Dining Table #4 Reservation" : "Biryani Inventory Reserve";

              }



              const isOutOfStock = item.qty !== null && Number(item.qty) <= 0;

              return (
                <View key={index}>
                  <View
                    style={[
                      styles.massListCard,
                      isSelected ? styles.massListCardSelected : null,
                    ] as any}
                  >
                    <View style={styles.massListLeft}>
                      {selectedDomain.id === "pizza" ? (
                        <View style={[
                          styles.massColorBadge,
                          { backgroundColor: item.id.startsWith("price") ? selectedDomain.color : "#ea580c" }
                        ]} />
                      ) : selectedDomain.id === "sneakers" ? (
                        <View style={[
                          styles.massColorBadge,
                          { backgroundColor: item.variant === "0" || item.variant === "1" ? "#000" : "#ef4444" }
                        ]} />
                      ) : (
                        <View style={[styles.massColorBadge, { backgroundColor: selectedDomain.color }]} />
                      )}
                      <Text style={[styles.massVariantTitle, isSelected ? { color: "#1d4ed8" } : null] as any}>
                        {title}
                      </Text>
                    </View>
                    <View style={styles.massListRight}>
                      <Text style={styles.massVariantPrice}>
                        {parseFloat(item.value) > 0 ? `$${parseFloat(item.value).toFixed(2)}` : "FREE"}
                      </Text>
                      <Text style={[
                        styles.massStockText,
                        isOutOfStock ? styles.outStockCol : styles.inStockCol
                      ] as any}>
                        {isOutOfStock ? "SOLD OUT" : (item.qty !== null ? `${item.qty} units` : "untracked")}
                      </Text>
                    </View>
                  </View>
                  {index < localMass.length - 1 && <View style={styles.itemDivider} />}
                </View>
              );
            })}
          </View>

          <View style={styles.sectionDivider} />

          {/* LEDGER / MOTION RECORDS (1000% MATCHING ORIGINAL) */}
          <Text style={styles.visualSectionHeader}>Ledger</Text>
          {Object.keys(groupedMotion).map((streamId, groupIdx) => (
            <View key={streamId}>
              <View style={styles.streamHeaderRow}>
                <Ionicons name="git-branch-outline" size={14} color="#1d4ed8" style={{ marginRight: 6 }} />
                <Text style={styles.streamTitleText}>STREAM ID: {streamId}</Text>
              </View>
              
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
          </>
          )}

        </ScrollView>
      )}

      {/* BOTTOM SHEET DROPDOWN MODAL (SELECTION DRAWER) */}
      <Modal
        visible={isDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsDropdownVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalKnob} />
              <Text style={styles.modalTitle}>Select Business Domain</Text>
              <Text style={styles.modalSubtitle}>Displaying scoped database models & logs</Text>
            </View>
            
            <ScrollView style={styles.modalList}>
              <View style={[styles.tableHeaderRow, { paddingHorizontal: 12 }]}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Domain</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Equivalent Scope</Text>
              </View>
              {DOMAINS.map(domain => {
                const isSelected = selectedDomain.id === domain.id;
                return (
                  <TouchableOpacity
                    key={domain.id}
                    onPress={() => selectDomain(domain)}
                    style={[
                      styles.modalItem,
                      isSelected ? { backgroundColor: "#f4f4f5" } : null,
                      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                      <Text style={styles.modalItemEmoji}>{domain.emoji}</Text>
                      <Text style={[styles.modalItemName, isSelected ? { fontWeight: "800", color: "#0f172a" } : { fontWeight: "500", color: "#334155" }]}>
                        {domain.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
                      {domain.scopeClass}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b"
  },
  dropdownContainer: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff"
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  dropdownEmoji: {
    fontSize: 24
  },
  dropdownSubTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: "800"
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
  flatListActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b"
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
    marginBottom: 6
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
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
  phaseSubContainer: {
    paddingLeft: 24,
    backgroundColor: "#fafbfd"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 24
  },
  modalHeader: {
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  modalKnob: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2
  },
  modalList: {
    paddingHorizontal: 16
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 4
  },
  modalItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  modalItemEmoji: {
    fontSize: 22
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b"
  },
  modalItemMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1
  }
});
