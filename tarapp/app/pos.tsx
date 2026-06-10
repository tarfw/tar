import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { DOMAINS } from "../lib/domainsData";
import { routeDbForEntity, getSelfId, isCollabSyncEnabled } from "../lib/db";

// ── Types ──────────────────────────────────────────────────────
interface CartItem {
  id: string;
  productId: string;
  title: string;
  variantLabel: string;
  massId: string;
  price: number;
  qty: number;
  modifiers: { title: string; price: number }[];
}

interface ActiveOrder {
  id: string;
  items: string;
  total: number;
  status: "PAID" | "REFUNDED";
  time: string;
  method: string;
}

// ── Constants & Colors ──────────────────────────────────────────
const BRAND_BLACK = "#0f172a";
const BG_LIGHT = "#ffffff";
const SURFACE_MUTED = "#f8fafc";
const BORDER_COLOR = "#e2e8f0";
const TEXT_PRIMARY = "#0f172a";
const TEXT_SECONDARY = "#475569";
const TEXT_MUTED = "#94a3b8";

const ACCENT = "#0066cc";       // Square Blue
const ACCENT_GREEN = "#16a34a"; // Success Green
const DANGER = "#dc2626";       // Danger Red

function rid(p: string) {
  return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

// ── Main Screen ────────────────────────────────────────────────
export default function PosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  // Search and Category Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | "Food" | "Retail">("All");

  // Product config modal
  const [configProduct, setConfigProduct] = useState<typeof DOMAINS[0] | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedMods, setSelectedMods] = useState<Set<number>>(new Set());

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "cash" | "upi">("card");
  const [showNumpad, setShowNumpad] = useState(false);
  const [typedAmount, setTypedAmount] = useState("0");

  const handlePaymentBack = () => {
    if (showNumpad) {
      setShowNumpad(false);
      setTypedAmount("0");
    } else {
      setShowPayment(false);
    }
  };

  const handleNumpadPress = (val: string) => {
    let nextStr = typedAmount;
    if (val === "⌫") {
      nextStr = nextStr.slice(0, -1);
      if (nextStr === "") nextStr = "0";
    } else if (val === ".") {
      if (!nextStr.includes(".")) {
        nextStr += ".";
      }
    } else {
      if (nextStr === "0") {
        nextStr = val;
      } else {
        nextStr += val;
      }
    }
    setTypedAmount(nextStr);

    const amtVal = parseFloat(nextStr) || 0;
    if (amtVal >= cartTotal) {
      checkout();
    }
  };

  // Active orders
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [showOrders, setShowOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);

  // Computed Values
  const cartTotal = cart.reduce((s, i) => s + (i.price + i.modifiers.reduce((m, x) => m + x.price, 0)) * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Load orders from database on mount
  useEffect(() => {
    loadOrders();
  }, []);

  // ── Database Operations ────────────────────────────────────
  const loadOrders = async () => {
    try {
      const selfId = await getSelfId();
      const scope = `c:${selfId}`;
      const db = routeDbForEntity("customer", scope);
      const rows = await db.all(
        `SELECT m.id, m.qty, m.value, m.time, m.data AS mass_data,
                (SELECT phase FROM motion WHERE stream = m.id ORDER BY seq DESC LIMIT 1) AS last_phase
         FROM mass m
         WHERE m.type = 'order' AND m.scope = ?
         ORDER BY m.time DESC LIMIT 100`,
        [scope]
      );

      const loaded = rows.map((r: any) => {
        let items = "";
        let method = "CARD";
        try {
          const d = JSON.parse(r.mass_data || "{}");
          items = d.items || "";
          method = d.method || "CARD";
        } catch (_) {}

        return {
          id: r.id,
          items,
          total: r.value || 0,
          status: (r.last_phase === 111 ? "REFUNDED" : "PAID") as "PAID" | "REFUNDED",
          time: r.time,
          method
        };
      });

      setOrders(loaded);
    } catch (err) {
      console.warn("[POS] Failed to load orders:", err);
    }
  };

  const appendMotion = async (db: any, stream: string, action: number, phase: number | null, delta: number | null, data: any) => {
    const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [stream]);
    const seq = seqRow[0]?.next_seq || (Date.now() * 1000);
    await db.run(
      "INSERT INTO motion (stream, seq, action, phase, delta, data) VALUES (?, ?, ?, ?, ?, ?)",
      [stream, seq, action, phase, delta, data ? JSON.stringify(data) : null]
    );
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const selfId = await getSelfId();
      const scope = `c:${selfId}`;
      const db = routeDbForEntity("customer", scope);
      const orderId = rid("ord");
      const now = new Date().toISOString();
      const items = cart.map(c => `${c.qty}x ${c.title} ${c.variantLabel}`).join(", ");
      const total = cartTotal;

      // 1. mass: order record
      await db.run(
        "INSERT INTO mass (id, matter, type, scope, qty, value, active, data, time) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        [
          orderId,
          cart[0].productId,
          "order",
          scope,
          cartCount,
          total,
          JSON.stringify({
            items,
            method: payMethod,
            cart: cart.map(c => ({ massId: c.massId, qty: c.qty, price: c.price }))
          }),
          now
        ]
      );

      // 2. motion: 101 SOLD (inventory decrement log)
      await appendMotion(db, orderId, 101, 101, -cartCount, null);

      // 3. motion: 801 PAYMENT_INIT, phase-updated directly to 802 PAYMENT_SUCCESS
      await appendMotion(db, orderId, 801, 802, total, { 
        m: payMethod, 
        ref: orderId, 
        ph: { "802": Date.now() } 
      });

      if (await isCollabSyncEnabled()) {
        await db.push().catch(() => {});
      }

      await loadOrders();
      setCart([]);
      setShowPayment(false);
      setShowCartSheet(false);
      setShowNumpad(false);
      setTypedAmount("0");

      Alert.alert(
        "✓ Sale Complete",
        `Order #${orderId.slice(-6).toUpperCase()}\n${items}\n${fmt(total)} via ${payMethod.toUpperCase()}`
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRefund = async (orderId: string) => {
    Alert.alert(
      "Confirm Refund",
      "Are you sure you want to refund this order? This will issue a return receipt and reverse the sale.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Refund",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const selfId = await getSelfId();
              const scope = `c:${selfId}`;
              const db = routeDbForEntity("customer", scope);

              // Fetch target order detail
              const orderRows = await db.all("SELECT value, qty FROM mass WHERE id = ?", [orderId]);
              if (orderRows.length === 0) {
                throw new Error("Order not found");
              }
              const { value: total, qty: cartCount } = orderRows[0] as any;

              // Log refund motion: 111
              await appendMotion(db, orderId, 111, 111, -total, {
                reason: "Customer Refund",
                refunded_at: new Date().toISOString()
              });

              // Adjust inventory back: log return motion 102
              await appendMotion(db, orderId, 102, 102, cartCount, {
                reason: "Inventory Return"
              });

              if (await isCollabSyncEnabled()) {
                await db.push().catch(() => {});
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert("✓ Refund Success", `Order #${orderId.slice(-6).toUpperCase()} has been fully refunded.`);
              
              setSelectedOrder(null);
              await loadOrders();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Refund failed");
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  };

  // ── Cart Handlers ──────────────────────────────────────────
  const openConfig = (d: typeof DOMAINS[0]) => {
    setConfigProduct(d);
    setSelectedVariantIdx(0);
    setSelectedMods(new Set());
  };

  const getVariantLabel = (d: typeof DOMAINS[0], idx: number) => {
    if (d.id === "pizza") return ["Small", "Medium", "Large"][idx] ?? `V${idx}`;
    if (d.id === "sneakers") {
      const colors = ["Black", "Red"];
      const sizes = ["S", "M"];
      return `${colors[Math.floor(idx / sizes.length)]} / ${sizes[idx % sizes.length]}`;
    }
    return `Option ${idx + 1}`;
  };

  const addToCart = () => {
    if (!configProduct) return;
    const mass = configProduct.mass[selectedVariantIdx];
    if (!mass) return;
    const price = parseFloat(mass.value) || 0;
    const mods = [...selectedMods].map(i => {
      const mod = configProduct.mass[i];
      return { title: mod.id, price: parseFloat(mod.value) || 0 };
    });
    const label = getVariantLabel(configProduct, selectedVariantIdx);
    const existing = cart.findIndex(c => c.massId === mass.id);

    if (existing >= 0) {
      setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart(prev => [
        ...prev,
        {
          id: rid("ci"),
          productId: configProduct.id,
          title: configProduct.title,
          variantLabel: label,
          massId: mass.id,
          price,
          qty: 1,
          modifiers: mods
        }
      ]);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfigProduct(null);
    if (!isTablet) {
      setShowCartSheet(true);
    }
  };

  const removeItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prev => {
      const item = prev.find(c => c.id === id);
      if (!item) return prev;
      if (item.qty > 1) return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
      return prev.filter(c => c.id !== id);
    });
  };

  // ── Render Helpers ─────────────────────────────────────────
  const renderProductCard = (d: typeof DOMAINS[0]) => {
    const outOfStock = d.mass.every(m => Number(m.qty) <= 0);
    const inStockQty = d.mass[0]?.qty;

    return (
      <TouchableOpacity
        key={d.id}
        style={[S.productCard, outOfStock && { opacity: 0.5 }]}
        onPress={() => !outOfStock && openConfig(d)}
        activeOpacity={0.7}
        disabled={outOfStock}
      >
        <View style={S.cardHeaderRow}>
          <View style={S.emojiBox}>
            <Text style={S.productEmoji}>{d.emoji}</Text>
          </View>
          <View style={[S.stockBadge, outOfStock ? S.stockBadgeOos : S.stockBadgeIn]}>
            <Text style={[S.stockBadgeText, outOfStock ? S.stockBadgeTextOos : S.stockBadgeTextIn]}>
              {outOfStock ? "Sold Out" : `${inStockQty || 50} left`}
            </Text>
          </View>
        </View>

        <View style={S.cardBottomStack}>
          <Text style={S.productTitle} numberOfLines={2}>
            {d.title}
          </Text>
          <Text style={S.productPrice}>{d.priceRange}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Filter products by category and search query
  const filteredProducts = DOMAINS.filter(d => d.id !== "crm").filter(d => {
    const matchSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory =
      selectedCategory === "All" ||
      (selectedCategory === "Food" && d.id === "pizza") ||
      (selectedCategory === "Retail" && d.id === "sneakers");
    return matchSearch && matchCategory;
  });

  const cartContent = (isModal = false) => (
    <View style={{ flex: 1 }}>
      {!isModal && (
        <View style={S.cartHeader}>
          <Text style={S.cartTitle}>Current Sale</Text>
          <View style={S.cartBadge}>
            <Text style={S.cartBadgeText}>{cartCount}</Text>
          </View>
        </View>
      )}

      {cart.length === 0 ? (
        <View style={S.emptyCart}>
          <Ionicons name="cart-outline" size={44} color={TEXT_MUTED} />
          <Text style={S.emptyCartText}>Cart is Empty{"\n"}Select items to build ticket</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {cart.map(item => {
            const itemTotal = (item.price + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.qty;
            return (
              <View key={item.id} style={S.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={S.cartItemName} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={S.cartItemVariant} numberOfLines={1}>
                    {item.variantLabel}
                  </Text>
                  {item.modifiers.map((m, i) => (
                    <Text key={i} style={S.cartItemMod}>
                      + {m.title} ({fmt(m.price)})
                    </Text>
                  ))}
                </View>
                <View style={S.cartItemRight}>
                  <Text style={S.cartItemPrice}>{fmt(itemTotal)}</Text>
                  <View style={S.qtyRow}>
                    <TouchableOpacity onPress={() => removeItem(item.id)} style={S.qtyBtn}>
                      <Ionicons name="remove" size={14} color={BRAND_BLACK} />
                    </TouchableOpacity>
                    <Text style={S.qtyText}>{item.qty}</Text>
                    <TouchableOpacity
                      onPress={() => setCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))}
                      style={S.qtyBtn}
                    >
                      <Ionicons name="add" size={14} color={BRAND_BLACK} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Cart Footer */}
      <View style={[S.cartFooter, isModal && { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={S.totalRow}>
          <Text style={S.totalLabel}>Total</Text>
          <Text style={S.totalAmount}>{fmt(cartTotal)}</Text>
        </View>
        <TouchableOpacity
          style={[S.chargeBtn, cart.length === 0 && { opacity: 0.4 }]}
          onPress={() => cart.length > 0 && setShowPayment(true)}
          disabled={cart.length === 0}
        >
          <Text style={S.chargeBtnText}>Charge {fmt(cartTotal)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={S.root} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Top Bar */}
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Tar Store</Text>
          <Text style={S.headerSub}>Store Terminal · s:102</Text>
        </View>
        <TouchableOpacity style={S.ordersBtn} onPress={() => { loadOrders(); setShowOrders(true); }}>
          <Ionicons name="receipt-outline" size={22} color={BRAND_BLACK} />
        </TouchableOpacity>
      </View>

      {/* Main Layout */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Catalog Side */}
        <View style={{ flex: isTablet ? 3 : 1, backgroundColor: BG_LIGHT }}>
          {/* Search and Category Headers */}
          <View style={S.filterSection}>
            <View style={S.searchContainer}>
              <Ionicons name="search" size={18} color={TEXT_MUTED} style={{ marginRight: 8 }} />
              <TextInput
                style={S.searchInput}
                placeholder="Search items..."
                placeholderTextColor={TEXT_MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.categoryRow}>
              {(["All", "Food", "Retail"] as const).map(cat => {
                const active = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[S.categoryChip, active && S.categoryChipActive]}
                  >
                    <Text style={[S.categoryChipText, active && S.categoryChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Grid View */}
          <FlatList
            key={isTablet ? "t" : "m"}
            data={filteredProducts}
            renderItem={({ item }) => renderProductCard(item)}
            keyExtractor={item => item.id}
            numColumns={isTablet ? 4 : 2}
            contentContainerStyle={S.gridContainer}
            ListEmptyComponent={
              <View style={S.emptyList}>
                <Text style={S.emptyListText}>No products found matching filters</Text>
              </View>
            }
          />
        </View>

        {/* Tablet Cart Split Panel */}
        {isTablet && <View style={[S.cartPanel, { paddingBottom: Math.max(insets.bottom, 16) }]}>{cartContent()}</View>}
      </View>

      {/* Floating Bottom Bar (Mobile Only) */}
      {!isTablet && cartCount > 0 && (
        <View style={[S.floatingReviewBar, { bottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={S.reviewSaleBtn} onPress={() => setShowCartSheet(true)}>
            <View style={S.reviewSaleBadge}>
              <Text style={S.reviewSaleBadgeText}>{cartCount}</Text>
            </View>
            <Text style={S.reviewSaleText}>Review Sale</Text>
            <Text style={S.reviewSaleTotal}>{fmt(cartTotal)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mobile Cart Sheet Modal */}
      <Modal
        visible={showCartSheet}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowCartSheet(false)}
      >
        <SafeAreaView style={[S.root, { paddingHorizontal: 16 }]} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={S.ordersModalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={S.ordersModalTitle}>Current Sale</Text>
              <View style={S.cartBadge}>
                <Text style={S.cartBadgeText}>{cartCount}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowCartSheet(false)}>
              <Ionicons name="close" size={26} color={BRAND_BLACK} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingTop: 12 }}>
            {cartContent(true)}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Config Product Modal */}
      <Modal
        visible={!!configProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigProduct(null)}
      >
        <View style={S.modalBackdrop}>
          <View style={[S.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={S.modalKnob} />
            {configProduct && (
              <>
                <View style={S.modalProductHeader}>
                  <View style={S.modalEmojiBox}>
                    <Text style={S.modalProductEmoji}>{configProduct.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.modalProductName}>{configProduct.title}</Text>
                    <Text style={S.modalProductOwner}>by {configProduct.owner}</Text>
                  </View>
                </View>

                {/* Variants Selection */}
                <Text style={S.modalSectionLabel}>CHOOSE SIZE / OPTION</Text>
                <View style={S.variantGrid}>
                  {configProduct.mass
                    .filter(m => !m.id.startsWith("price"))
                    .map((m, i) => {
                      const label = getVariantLabel(configProduct, i);
                      const sel = selectedVariantIdx === i;
                      const oos = Number(m.qty) === 0;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => !oos && setSelectedVariantIdx(i)}
                          style={[
                            S.variantChip,
                            sel && S.variantChipSel,
                            oos && { opacity: 0.3 }
                          ]}
                          disabled={oos}
                        >
                          <Text style={[S.variantChipText, sel && S.variantChipTextSel]}>
                            {label}
                          </Text>
                          <Text style={[S.variantChipPrice, sel && { color: ACCENT }]}>
                            {fmt(parseFloat(m.value))}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>

                {/* Modifiers (Add-ons) Selection */}
                {configProduct.mass.some(m => m.id.startsWith("price")) && (
                  <>
                    <Text style={S.modalSectionLabel}>ADD-ONS</Text>
                    <View style={S.variantGrid}>
                      {configProduct.mass.map((m, i) =>
                        !m.id.startsWith("price") ? null : (
                          <TouchableOpacity
                            key={m.id}
                            onPress={() => {
                              const s = new Set(selectedMods);
                              if (s.has(i)) s.delete(i);
                              else s.add(i);
                              setSelectedMods(s);
                            }}
                            style={[
                              S.variantChip,
                              selectedMods.has(i) && S.variantChipSel
                            ]}
                          >
                            <Text
                              style={[
                                S.variantChipText,
                                selectedMods.has(i) && S.variantChipTextSel
                              ]}
                            >
                              {m.id.replace("price", "")}
                            </Text>
                            <Text
                              style={[
                                S.variantChipPrice,
                                selectedMods.has(i) && { color: ACCENT }
                              ]}
                            >
                              +{fmt(parseFloat(m.value))}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </>
                )}

                {/* Action Buttons */}
                <View style={{ gap: 8, marginTop: 16 }}>
                  <TouchableOpacity style={S.addToCartBtn} onPress={addToCart}>
                    <Text style={S.addToCartBtnText}>Add to Ticket</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={S.cancelBtn}
                    onPress={() => setConfigProduct(null)}
                  >
                    <Text style={S.cancelBtnText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Payment Options Modal */}
      <Modal
        visible={showPayment}
        transparent={false}
        animationType="slide"
        onRequestClose={handlePaymentBack}
      >
        <SafeAreaView style={[S.root, { paddingHorizontal: 16 }]} edges={["top", "bottom"]}>
          {!showNumpad ? (
            /* Phase 1: Select Payment Method */
            <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 24 }}>
              <View style={{ alignItems: "center", marginTop: 90, marginBottom: 16 }}>
                <Text style={S.payAmount}>{fmt(cartTotal)}</Text>
              </View>

              <View style={{ paddingHorizontal: 4, marginBottom: 40 }}>
                {(["card", "cash", "upi"] as const).map(m => {
                  const labelMap = { card: "Card", cash: "Cash", upi: "UPI" };
                  return (
                    <TouchableOpacity
                      key={m}
                      style={S.payMethodRowVertical}
                      onPress={() => {
                        setPayMethod(m);
                        setTypedAmount("0");
                        setShowNumpad(true);
                      }}
                    >
                      <Text style={[S.payMethodH1Text, { color: TEXT_PRIMARY }]}>
                        {labelMap[m]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            /* Phase 2: Enter Amount to Tally */
            <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 24 }}>
              <View style={{ alignItems: "center", marginTop: 40 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT_SECONDARY, letterSpacing: 1 }}>
                  TALLY TO {fmt(cartTotal)}
                </Text>
                <Text style={S.payAmount}>{fmt(parseFloat(typedAmount) || 0)}</Text>
              </View>

              {/* Custom Numpad Grid */}
              <View style={{ marginBottom: 16 }}>
                {[
                  ["1", "2", "3"],
                  ["4", "5", "6"],
                  ["7", "8", "9"],
                  [".", "0", "⌫"]
                ].map((row, rIdx) => (
                  <View key={rIdx} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                    {row.map(val => (
                      <TouchableOpacity
                        key={val}
                        style={{
                          flex: 1,
                          backgroundColor: val === "⌫" ? "#fee2e2" : SURFACE_MUTED,
                          paddingVertical: 18,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onPress={() => handleNumpadPress(val)}
                      >
                        <Text style={{
                          fontSize: 26,
                          fontWeight: "900",
                          color: val === "⌫" ? DANGER : TEXT_PRIMARY
                        }}>
                          {val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          {busy && (
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999
            }}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Full-Screen Transactions Drawer Modal */}
      <Modal
        visible={showOrders}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowOrders(false)}
      >
        <SafeAreaView style={[S.root, { paddingHorizontal: 16 }]} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={S.ordersModalHeader}>
            <Text style={S.ordersModalTitle}>Transactions</Text>
            <TouchableOpacity onPress={() => { setShowOrders(false); setSelectedOrder(null); }}>
              <Ionicons name="close" size={26} color={BRAND_BLACK} />
            </TouchableOpacity>
          </View>

          {selectedOrder ? (
            /* Selected Order Details View */
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }}>
              <TouchableOpacity
                style={S.backToOrdersBtn}
                onPress={() => setSelectedOrder(null)}
              >
                <Ionicons name="chevron-back" size={18} color={ACCENT} />
                <Text style={S.backToOrdersText}>Back to List</Text>
              </TouchableOpacity>

              <View style={S.detailCard}>
                <View style={S.detailCardHeader}>
                  <View>
                    <Text style={S.detailOrderNumber}>ORDER #{selectedOrder.id.slice(-6).toUpperCase()}</Text>
                    <Text style={S.detailOrderTime}>{new Date(selectedOrder.time).toLocaleString()}</Text>
                  </View>
                  <View style={[S.statusBadge, selectedOrder.status === "REFUNDED" ? S.statusBadgeRefunded : S.statusBadgePaid]}>
                    <Text style={[S.statusBadgeText, selectedOrder.status === "REFUNDED" ? S.statusBadgeTextRefunded : S.statusBadgeTextPaid]}>
                      {selectedOrder.status}
                    </Text>
                  </View>
                </View>

                <View style={S.divider} />

                <Text style={S.detailSectionLabel}>ITEMS SUMMARY</Text>
                <Text style={S.detailItemsText}>{selectedOrder.items}</Text>

                <View style={S.divider} />

                <View style={S.detailRow}>
                  <Text style={S.detailFieldLabel}>Payment Method</Text>
                  <Text style={S.detailFieldValue}>{selectedOrder.method.toUpperCase()}</Text>
                </View>

                <View style={S.detailRow}>
                  <Text style={S.detailFieldLabel}>Total Amount</Text>
                  <Text style={S.detailFieldValueBold}>{fmt(selectedOrder.total)}</Text>
                </View>

                {selectedOrder.status === "PAID" && (
                  <TouchableOpacity
                    style={S.refundBtn}
                    onPress={() => handleRefund(selectedOrder.id)}
                  >
                    <Ionicons name="arrow-undo-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={S.refundBtnText}>Issue Full Refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          ) : (
            /* Transactions List View */
            <FlatList
              data={orders}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: Math.max(insets.bottom, 16) }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={S.transactionRow}
                  onPress={() => setSelectedOrder(item)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={S.transId}>#{item.id.slice(-6).toUpperCase()}</Text>
                      <View style={[S.miniStatusBadge, item.status === "REFUNDED" ? S.statusBadgeRefunded : S.statusBadgePaid]}>
                        <Text style={[S.miniStatusBadgeText, item.status === "REFUNDED" ? S.statusBadgeTextRefunded : S.statusBadgeTextPaid]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={S.transItems} numberOfLines={1}>
                      {item.items}
                    </Text>
                    <Text style={S.transTime}>
                      {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.method.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[S.transAmount, item.status === "REFUNDED" && { textDecorationLine: "line-through", color: TEXT_MUTED }]}>
                      {fmt(item.total)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={S.emptyList}>
                  <Text style={S.emptyListText}>No transactions logged in this store.</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_LIGHT
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: BG_LIGHT
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800"
  },
  headerSub: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    marginTop: 1
  },
  ordersBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center"
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: BG_LIGHT,
    gap: 8
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_MUTED,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: BORDER_COLOR
  },
  searchInput: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    paddingVertical: 0
  },
  categoryRow: {
    flexDirection: "row",
    marginVertical: 4
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: SURFACE_MUTED,
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR
  },
  categoryChipActive: {
    backgroundColor: BRAND_BLACK,
    borderColor: BRAND_BLACK
  },
  categoryChipText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600"
  },
  categoryChipTextActive: {
    color: "#ffffff"
  },
  gridContainer: {
    padding: 12,
    gap: 8
  },
  productCard: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    borderRadius: 12,
    padding: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    justifyContent: "space-between"
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  emojiBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center"
  },
  productEmoji: {
    fontSize: 20
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6
  },
  stockBadgeIn: {
    backgroundColor: "#dcfce7"
  },
  stockBadgeOos: {
    backgroundColor: "#fee2e2"
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: "700"
  },
  stockBadgeTextIn: {
    color: "#15803d"
  },
  stockBadgeTextOos: {
    color: "#ef4444"
  },
  cardBottomStack: {
    gap: 4
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    height: 36,
    lineHeight: 18
  },
  productPrice: {
    fontSize: 12,
    fontWeight: "500",
    color: TEXT_SECONDARY
  },
  cartPanel: {
    width: 320,
    backgroundColor: BG_LIGHT,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_COLOR,
    flexDirection: "column"
  },
  cartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: BG_LIGHT
  },
  cartTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    flex: 1
  },
  cartBadge: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  cartBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyCart: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 40
  },
  emptyCartText: {
    color: TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20
  },
  cartItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    flexDirection: "row",
    gap: 8
  },
  cartItemName: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700"
  },
  cartItemVariant: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    marginTop: 2
  },
  cartItemMod: {
    color: TEXT_MUTED,
    fontSize: 10,
    marginTop: 1
  },
  cartItemRight: {
    alignItems: "flex-end",
    gap: 6
  },
  cartItemPrice: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700"
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  qtyBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR
  },
  qtyText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
    minWidth: 16,
    textAlign: "center"
  },
  cartFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    gap: 10,
    backgroundColor: BG_LIGHT
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600"
  },
  totalAmount: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800"
  },
  chargeBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center"
  },
  chargeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  },
  cancelBtn: {
    backgroundColor: SURFACE_MUTED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR
  },
  cancelBtnText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: BG_LIGHT,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5
      },
      android: {
        elevation: 10
      }
    })
  },
  modalKnob: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_COLOR,
    alignSelf: "center",
    marginBottom: 4
  },
  closeModalBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  modalProductHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 6
  },
  modalEmojiBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center"
  },
  modalProductEmoji: {
    fontSize: 26
  },
  modalProductName: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800"
  },
  modalProductOwner: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 1
  },
  modalSectionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 8
  },
  variantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  variantChip: {
    flex: 1,
    minWidth: 90,
    backgroundColor: SURFACE_MUTED,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    alignItems: "center",
    gap: 4
  },
  variantChipSel: {
    borderColor: ACCENT,
    backgroundColor: "#eff6ff"
  },
  variantChipText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600"
  },
  variantChipTextSel: {
    color: ACCENT,
    fontWeight: "700"
  },
  variantChipPrice: {
    color: TEXT_SECONDARY,
    fontSize: 11
  },
  addToCartBtn: {
    backgroundColor: BRAND_BLACK,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center"
  },
  addToCartBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  },
  payTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center"
  },
  payAmount: {
    color: BRAND_BLACK,
    fontSize: 72,
    fontWeight: "900",
    textAlign: "center",
    marginVertical: 12
  },
  payMethodRow: {
    flexDirection: "row",
    gap: 8
  },
  payMethodRowVertical: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR
  },
  payMethodH1Text: {
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 52
  },
  emptyList: {
    paddingVertical: 40,
    alignItems: "center"
  },
  emptyListText: {
    color: TEXT_MUTED,
    fontSize: 13
  },
  floatingReviewBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: BRAND_BLACK,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5
      },
      android: {
        elevation: 8
      }
    })
  },
  reviewSaleBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16
  },
  reviewSaleBadge: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  reviewSaleBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  reviewSaleText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 12
  },
  reviewSaleTotal: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  },
  ordersModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR
  },
  ordersModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT_PRIMARY
  },
  transactionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  transId: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY
  },
  transItems: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 3
  },
  transTime: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2
  },
  transAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusBadgePaid: {
    backgroundColor: "#dcfce7"
  },
  statusBadgeRefunded: {
    backgroundColor: "#f1f5f9"
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  statusBadgeTextPaid: {
    color: "#15803d"
  },
  statusBadgeTextRefunded: {
    color: TEXT_SECONDARY
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  miniStatusBadgeText: {
    fontSize: 9,
    fontWeight: "700"
  },
  backToOrdersBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 12
  },
  backToOrdersText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600"
  },
  detailCard: {
    backgroundColor: BG_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 16,
    gap: 12
  },
  detailCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  detailOrderNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY
  },
  detailOrderTime: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_SECONDARY,
    letterSpacing: 1
  },
  detailItemsText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 20
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  detailFieldLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY
  },
  detailFieldValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY
  },
  detailFieldValueBold: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT_PRIMARY
  },
  divider: {
    height: 1,
    backgroundColor: BORDER_COLOR
  },
  refundBtn: {
    backgroundColor: DANGER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8
  },
  refundBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700"
  }
});
