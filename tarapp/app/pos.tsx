import React, { useState, useCallback } from "react";
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator, FlatList
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { DOMAINS, OPCODE_LABELS } from "../lib/domainsData";
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
  status: string;
  time: string;
}

// ── Constants ──────────────────────────────────────────────────
const BG = "#0f0f0f";
const SURFACE = "#1c1c1e";
const SURFACE2 = "#2c2c2e";
const ACCENT = "#34c759";
const ACCENT2 = "#007aff";
const DANGER = "#ff3b30";
const TEXT = "#ffffff";
const TEXT2 = "#ebebf5";
const TEXT3 = "#8e8e93";
const BORDER = "#3a3a3c";

function rid(p: string) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function fmt(n: number) { return `$${n.toFixed(2)}`; }

// ── Main Screen ────────────────────────────────────────────────
export default function PosScreen() {
  const router = useRouter();
  const domain = DOMAINS[0]; // pizza as default catalog demo

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [busy, setBusy] = useState(false);

  // Product config modal (size + modifiers)
  const [configProduct, setConfigProduct] = useState<typeof DOMAINS[0] | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedMods, setSelectedMods] = useState<Set<number>>(new Set());

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [payMethod, setPayMethod] = useState<"card"|"cash"|"upi">("card");

  // Active orders
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [showOrders, setShowOrders] = useState(false);

  // Computed
  const cartTotal = cart.reduce((s, i) => s + (i.price + i.modifiers.reduce((m,x)=>m+x.price,0)) * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // ── Config modal helpers ───────────────────────────────────
  const openConfig = (d: typeof DOMAINS[0]) => {
    setConfigProduct(d);
    setSelectedVariantIdx(0);
    setSelectedMods(new Set());
  };

  const getVariantLabel = (d: typeof DOMAINS[0], idx: number) => {
    if (d.id === "pizza") return ["Small","Medium","Large"][idx] ?? `V${idx}`;
    if (d.id === "sneakers") {
      const colors = ["Black","Red"]; const sizes = ["S","M"];
      return `${colors[Math.floor(idx/sizes.length)]} / ${sizes[idx%sizes.length]}`;
    }
    return `Option ${idx+1}`;
  };

  const addToCart = () => {
    if (!configProduct) return;
    const mass = configProduct.mass[selectedVariantIdx];
    if (!mass) return;
    const price = parseFloat(mass.value) || 0;
    const mods = [...selectedMods].map(i => {
      const mod = configProduct.mass[i];
      return { title: mod.id, price: parseFloat(mod.value)||0 };
    });
    const label = getVariantLabel(configProduct, selectedVariantIdx);
    const existing = cart.findIndex(c => c.massId === mass.id);
    if (existing >= 0) {
      setCart(prev => prev.map((c,i) => i===existing ? {...c, qty: c.qty+1} : c));
    } else {
      setCart(prev => [...prev, {
        id: rid("ci"), productId: configProduct.id,
        title: configProduct.title, variantLabel: label,
        massId: mass.id, price, qty: 1, modifiers: mods
      }]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfigProduct(null);
    setShowCart(true);
  };

  const removeItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prev => {
      const item = prev.find(c=>c.id===id);
      if (!item) return prev;
      if (item.qty > 1) return prev.map(c=>c.id===id?{...c,qty:c.qty-1}:c);
      return prev.filter(c=>c.id!==id);
    });
  };

  // ── Checkout ───────────────────────────────────────────────
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
      const items = cart.map(c=>`${c.qty}x ${c.title} ${c.variantLabel}`).join(", ");
      const total = cartTotal;

      // mass: order record
      await db.run(
        "INSERT INTO mass (id,matter,type,scope,qty,value,active,data,time) VALUES(?,?,?,?,?,?,?,?,?)",
        [orderId, cart[0].productId, "order", scope, cartCount, total, 1,
         JSON.stringify({ items, method: payMethod, cart: cart.map(c=>({massId:c.massId,qty:c.qty,price:c.price})) }), now]
      );
      // motion: 105 PLACED
      const seqRow = await db.all("SELECT COALESCE(MAX(seq),0)+1 AS n FROM motion WHERE stream=?", [orderId]);
      let seq = (seqRow[0] as any)?.n || 1;
      const motId = () => rid("mot");
      await db.run(
        "INSERT INTO motion (id,stream,seq,action,status,delta,scope,data,time) VALUES(?,?,?,?,?,?,?,?,?)",
        [motId(), orderId, seq++, 105, "PLACED", cartCount, scope, JSON.stringify({items, channel:"pos"}), now]
      );
      // motion: 801 PAYMENT_INIT
      await db.run(
        "INSERT INTO motion (id,stream,seq,action,status,delta,scope,data,time) VALUES(?,?,?,?,?,?,?,?,?)",
        [motId(), orderId, seq++, 801, "PAYMENT_INIT", total, scope, JSON.stringify({m:payMethod}), now]
      );
      // motion: 802 PAYMENT_SUCCESS
      await db.run(
        "INSERT INTO motion (id,stream,seq,action,status,delta,scope,data,time) VALUES(?,?,?,?,?,?,?,?,?)",
        [motId(), orderId, seq++, 802, "PAYMENT_SUCCESS", total, scope, JSON.stringify({ref:orderId}), now]
      );
      // motion: 101 SOLD (deduct)
      await db.run(
        "INSERT INTO motion (id,stream,seq,action,status,delta,scope,data,time) VALUES(?,?,?,?,?,?,?,?,?)",
        [motId(), orderId, seq++, 101, "SOLD", -cartCount, scope, null, now]
      );
      if (await isCollabSyncEnabled()) {
        await db.push().catch(()=>{});
      }
      setOrders(prev => [{id:orderId, items, total, status:"PAID", time: new Date().toLocaleTimeString()},...prev]);
      setCart([]);
      setShowPayment(false);
      setShowCart(false);
      Alert.alert("✓ Sale Complete", `Order #${orderId.slice(-6).toUpperCase()}\n${items}\n${fmt(total)} via ${payMethod.toUpperCase()}`);
    } catch(e:any) {
      Alert.alert("Error", e.message||"Checkout failed");
    } finally { setBusy(false); }
  };

  // ── Product Grid ───────────────────────────────────────────
  const renderProduct = (d: typeof DOMAINS[0]) => {
    const basePrice = parseFloat(d.mass[0]?.value||"0");
    const outOfStock = d.mass.every(m=>Number(m.qty)<=0);
    return (
      <TouchableOpacity key={d.id} style={[S.productCard, outOfStock&&{opacity:0.4}]}
        onPress={()=>!outOfStock&&openConfig(d)} activeOpacity={0.7} disabled={outOfStock}>
        <Text style={S.productEmoji}>{d.emoji}</Text>
        <View style={S.productInfo}>
          <Text style={S.productName} numberOfLines={1}>{d.title}</Text>
          <Text style={S.productPrice}>{d.priceRange}</Text>
          {d.mass[0]?.qty && <Text style={S.productStock}>{d.mass[0].qty} in stock</Text>}
        </View>
        <View style={S.addBtn}>
          <Ionicons name="add" size={18} color="#fff"/>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={S.root} edges={["top","left","right"]}>
      <StatusBar style="light"/>

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={()=>router.back()} style={{padding:4}}>
          <Ionicons name="arrow-back" size={20} color={TEXT}/>
        </TouchableOpacity>
        <View style={{flex:1, marginLeft:12}}>
          <Text style={S.headerTitle}>POS Terminal</Text>
          <Text style={S.headerSub}>Tamil Pizza Shop · s:102</Text>
        </View>
        <TouchableOpacity style={S.ordersBtn} onPress={()=>setShowOrders(true)}>
          <Ionicons name="receipt-outline" size={16} color={TEXT3}/>
          <Text style={S.ordersBtnText}>Orders</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={{flex:1, flexDirection:"row"}}>
        {/* Catalog */}
        <ScrollView style={S.catalog} contentContainerStyle={{padding:12,gap:10}}>
          <Text style={S.sectionLabel}>CATALOG</Text>
          {DOMAINS.filter(d=>d.id!=="crm").map(renderProduct)}
        </ScrollView>

        {/* Cart Panel */}
        <View style={S.cartPanel}>
          <View style={S.cartHeader}>
            <Text style={S.cartTitle}>Cart</Text>
            <Text style={S.cartBadge}>{cartCount}</Text>
          </View>

          {cart.length === 0 ? (
            <View style={S.emptyCart}>
              <Ionicons name="cart-outline" size={36} color={TEXT3}/>
              <Text style={S.emptyCartText}>Tap items{"\n"}to add</Text>
            </View>
          ) : (
            <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false}>
              {cart.map(item => (
                <View key={item.id} style={S.cartItem}>
                  <View style={{flex:1}}>
                    <Text style={S.cartItemName} numberOfLines={1}>{item.title}</Text>
                    <Text style={S.cartItemVariant} numberOfLines={1}>{item.variantLabel}</Text>
                    {item.modifiers.map((m,i)=>(
                      <Text key={i} style={S.cartItemMod}>+ {m.title} {fmt(m.price)}</Text>
                    ))}
                  </View>
                  <View style={S.cartItemRight}>
                    <Text style={S.cartItemPrice}>{fmt((item.price+item.modifiers.reduce((s,m)=>s+m.price,0))*item.qty)}</Text>
                    <View style={S.qtyRow}>
                      <TouchableOpacity onPress={()=>removeItem(item.id)} style={S.qtyBtn}>
                        <Ionicons name="remove" size={14} color={TEXT}/>
                      </TouchableOpacity>
                      <Text style={S.qtyText}>{item.qty}</Text>
                      <TouchableOpacity onPress={()=>setCart(prev=>prev.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c))} style={S.qtyBtn}>
                        <Ionicons name="add" size={14} color={TEXT}/>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Total + Checkout */}
          <View style={S.cartFooter}>
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Total</Text>
              <Text style={S.totalAmount}>{fmt(cartTotal)}</Text>
            </View>
            <TouchableOpacity
              style={[S.checkoutBtn, cart.length===0&&{opacity:0.3}]}
              onPress={()=>cart.length>0&&setShowPayment(true)}
              disabled={cart.length===0}>
              <Text style={S.checkoutBtnText}>Charge {fmt(cartTotal)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Config Modal */}
      <Modal visible={!!configProduct} transparent animationType="slide" onRequestClose={()=>setConfigProduct(null)}>
        <View style={S.modalBackdrop}>
          <View style={S.modalSheet}>
            <View style={S.modalKnob}/>
            {configProduct && <>
              <View style={S.modalProductHeader}>
                <Text style={S.modalProductEmoji}>{configProduct.emoji}</Text>
                <View>
                  <Text style={S.modalProductName}>{configProduct.title}</Text>
                  <Text style={S.modalProductOwner}>by {configProduct.owner}</Text>
                </View>
              </View>

              {/* Variants */}
              <Text style={S.modalSectionLabel}>SELECT VARIANT</Text>
              <View style={S.variantGrid}>
                {configProduct.mass.filter(m=>!m.id.startsWith("price")).map((m,i) => {
                  const label = getVariantLabel(configProduct, i);
                  const sel = selectedVariantIdx === i;
                  const oos = Number(m.qty) === 0;
                  return (
                    <TouchableOpacity key={m.id} onPress={()=>!oos&&setSelectedVariantIdx(i)}
                      style={[S.variantChip, sel&&S.variantChipSel, oos&&{opacity:0.3}]} disabled={oos}>
                      <Text style={[S.variantChipText, sel&&S.variantChipTextSel]}>{label}</Text>
                      <Text style={S.variantChipPrice}>{fmt(parseFloat(m.value))}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Modifiers */}
              {configProduct.mass.some(m=>m.id.startsWith("price")) && <>
                <Text style={S.modalSectionLabel}>ADD-ONS</Text>
                <View style={S.variantGrid}>
                  {configProduct.mass.map((m,i)=> !m.id.startsWith("price") ? null : (
                    <TouchableOpacity key={m.id} onPress={()=>{
                      const s=new Set(selectedMods);
                      s.has(i)?s.delete(i):s.add(i); setSelectedMods(s);
                    }} style={[S.variantChip, selectedMods.has(i)&&S.variantChipSel]}>
                      <Text style={[S.variantChipText, selectedMods.has(i)&&S.variantChipTextSel]}>{m.id}</Text>
                      <Text style={S.variantChipPrice}>+{fmt(parseFloat(m.value))}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>}

              <TouchableOpacity style={S.addToCartBtn} onPress={addToCart}>
                <Text style={S.addToCartBtnText}>Add to Cart</Text>
              </TouchableOpacity>
            </>}
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} transparent animationType="slide" onRequestClose={()=>setShowPayment(false)}>
        <View style={S.modalBackdrop}>
          <View style={S.modalSheet}>
            <View style={S.modalKnob}/>
            <Text style={S.payTitle}>Collect Payment</Text>
            <Text style={S.payAmount}>{fmt(cartTotal)}</Text>
            <Text style={S.modalSectionLabel}>PAYMENT METHOD</Text>
            <View style={S.payMethodRow}>
              {(["card","cash","upi"] as const).map(m=>(
                <TouchableOpacity key={m} style={[S.payMethodBtn, payMethod===m&&S.payMethodBtnSel]} onPress={()=>setPayMethod(m)}>
                  <Ionicons name={m==="card"?"card-outline":m==="cash"?"cash-outline":"phone-portrait-outline"} size={22} color={payMethod===m?ACCENT:TEXT3}/>
                  <Text style={[S.payMethodText, payMethod===m&&{color:ACCENT}]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{gap:10, marginTop:8}}>
              <TouchableOpacity style={[S.checkoutBtn, busy&&{opacity:0.5}]} onPress={checkout} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff"/> : <Text style={S.checkoutBtnText}>Confirm Sale · {fmt(cartTotal)}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={S.cancelBtn} onPress={()=>setShowPayment(false)}>
                <Text style={S.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Orders Modal */}
      <Modal visible={showOrders} transparent animationType="slide" onRequestClose={()=>setShowOrders(false)}>
        <View style={S.modalBackdrop}>
          <View style={[S.modalSheet,{maxHeight:"80%"}]}>
            <View style={S.modalKnob}/>
            <Text style={S.payTitle}>Recent Orders</Text>
            {orders.length === 0
              ? <Text style={{color:TEXT3, textAlign:"center", marginTop:24}}>No orders yet this session</Text>
              : <ScrollView>
                {orders.map(o=>(
                  <View key={o.id} style={S.orderRow}>
                    <View style={{flex:1}}>
                      <Text style={S.orderRowId}>#{o.id.slice(-6).toUpperCase()}</Text>
                      <Text style={S.orderRowItems} numberOfLines={1}>{o.items}</Text>
                      <Text style={S.orderRowTime}>{o.time}</Text>
                    </View>
                    <View style={{alignItems:"flex-end"}}>
                      <Text style={S.orderRowTotal}>{fmt(o.total)}</Text>
                      <View style={S.orderStatusBadge}>
                        <Text style={S.orderStatusText}>{o.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            }
            <TouchableOpacity style={S.cancelBtn} onPress={()=>setShowOrders(false)}>
              <Text style={S.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:{flex:1,backgroundColor:BG},
  header:{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:BORDER},
  headerTitle:{color:TEXT,fontSize:16,fontWeight:"700"},
  headerSub:{color:TEXT3,fontSize:11,marginTop:1},
  ordersBtn:{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:SURFACE2,paddingHorizontal:12,paddingVertical:7,borderRadius:20},
  ordersBtnText:{color:TEXT3,fontSize:12,fontWeight:"600"},
  catalog:{flex:1,backgroundColor:BG},
  sectionLabel:{color:TEXT3,fontSize:10,fontWeight:"700",letterSpacing:1,marginBottom:4},
  productCard:{backgroundColor:SURFACE,borderRadius:12,flexDirection:"row",alignItems:"center",padding:14,gap:12},
  productEmoji:{fontSize:28},
  productInfo:{flex:1},
  productName:{color:TEXT,fontSize:14,fontWeight:"600"},
  productPrice:{color:TEXT3,fontSize:12,marginTop:2},
  productStock:{color:ACCENT,fontSize:11,marginTop:2},
  addBtn:{width:30,height:30,borderRadius:15,backgroundColor:ACCENT2,alignItems:"center",justifyContent:"center"},
  cartPanel:{width:200,backgroundColor:SURFACE,borderLeftWidth:1,borderLeftColor:BORDER,flexDirection:"column"},
  cartHeader:{flexDirection:"row",alignItems:"center",gap:8,padding:14,borderBottomWidth:1,borderBottomColor:BORDER},
  cartTitle:{color:TEXT,fontSize:15,fontWeight:"700",flex:1},
  cartBadge:{backgroundColor:ACCENT2,borderRadius:10,minWidth:20,height:20,alignItems:"center",justifyContent:"center",paddingHorizontal:6},
  emptyCart:{flex:1,alignItems:"center",justifyContent:"center",gap:10},
  emptyCartText:{color:TEXT3,fontSize:12,textAlign:"center",lineHeight:18},
  cartItem:{padding:12,borderBottomWidth:1,borderBottomColor:BORDER,flexDirection:"row",gap:8},
  cartItemName:{color:TEXT,fontSize:12,fontWeight:"600"},
  cartItemVariant:{color:TEXT3,fontSize:11,marginTop:2},
  cartItemMod:{color:TEXT3,fontSize:10},
  cartItemRight:{alignItems:"flex-end",gap:6},
  cartItemPrice:{color:TEXT,fontSize:12,fontWeight:"700"},
  qtyRow:{flexDirection:"row",alignItems:"center",gap:8},
  qtyBtn:{width:22,height:22,borderRadius:11,backgroundColor:SURFACE2,alignItems:"center",justifyContent:"center"},
  qtyText:{color:TEXT,fontSize:12,fontWeight:"600",minWidth:16,textAlign:"center"},
  cartFooter:{padding:12,borderTopWidth:1,borderTopColor:BORDER,gap:10},
  totalRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  totalLabel:{color:TEXT3,fontSize:13,fontWeight:"600"},
  totalAmount:{color:TEXT,fontSize:18,fontWeight:"800"},
  checkoutBtn:{backgroundColor:ACCENT,borderRadius:10,padding:14,alignItems:"center"},
  checkoutBtnText:{color:"#fff",fontSize:14,fontWeight:"700"},
  cancelBtn:{backgroundColor:SURFACE2,borderRadius:10,padding:14,alignItems:"center"},
  cancelBtnText:{color:TEXT2,fontSize:14,fontWeight:"600"},
  modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.7)",justifyContent:"flex-end"},
  modalSheet:{backgroundColor:SURFACE,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,gap:14},
  modalKnob:{width:36,height:4,borderRadius:2,backgroundColor:BORDER,alignSelf:"center",marginBottom:4},
  modalProductHeader:{flexDirection:"row",alignItems:"center",gap:14},
  modalProductEmoji:{fontSize:40},
  modalProductName:{color:TEXT,fontSize:18,fontWeight:"700"},
  modalProductOwner:{color:TEXT3,fontSize:12,marginTop:2},
  modalSectionLabel:{color:TEXT3,fontSize:10,fontWeight:"700",letterSpacing:1},
  variantGrid:{flexDirection:"row",flexWrap:"wrap",gap:8},
  variantChip:{backgroundColor:SURFACE2,borderRadius:10,paddingHorizontal:14,paddingVertical:10,borderWidth:1.5,borderColor:"transparent",minWidth:80,alignItems:"center"},
  variantChipSel:{borderColor:ACCENT,backgroundColor:"#1a3a2a"},
  variantChipText:{color:TEXT2,fontSize:13,fontWeight:"600"},
  variantChipTextSel:{color:ACCENT},
  variantChipPrice:{color:TEXT3,fontSize:11,marginTop:2},
  addToCartBtn:{backgroundColor:ACCENT2,borderRadius:12,padding:16,alignItems:"center"},
  addToCartBtnText:{color:"#fff",fontSize:15,fontWeight:"700"},
  payTitle:{color:TEXT,fontSize:20,fontWeight:"800",textAlign:"center"},
  payAmount:{color:ACCENT,fontSize:36,fontWeight:"800",textAlign:"center"},
  payMethodRow:{flexDirection:"row",gap:10},
  payMethodBtn:{flex:1,backgroundColor:SURFACE2,borderRadius:12,padding:14,alignItems:"center",gap:6,borderWidth:1.5,borderColor:"transparent"},
  payMethodBtnSel:{borderColor:ACCENT,backgroundColor:"#1a3a2a"},
  payMethodText:{color:TEXT3,fontSize:11,fontWeight:"600"},
  orderRow:{padding:14,borderBottomWidth:1,borderBottomColor:BORDER,flexDirection:"row",gap:12},
  orderRowId:{color:TEXT,fontSize:14,fontWeight:"700"},
  orderRowItems:{color:TEXT3,fontSize:12,marginTop:2},
  orderRowTime:{color:TEXT3,fontSize:11,marginTop:2},
  orderRowTotal:{color:ACCENT,fontSize:15,fontWeight:"700"},
  orderStatusBadge:{backgroundColor:"#1a3a2a",borderRadius:6,paddingHorizontal:8,paddingVertical:3,marginTop:4},
  orderStatusText:{color:ACCENT,fontSize:10,fontWeight:"700"},
});
