import React, { useState, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getUserDb, getGlobalDb } from "../lib/db";

interface CatalogItem {
  mass_id: string;
  matter_id: string;
  stock: number;
  price: number;
  title: string;
  code: string;
}

interface CartItem extends CatalogItem {
  qty: number;
}

export default function SpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadCatalog() {
        try {
          const db = getGlobalDb();
          // Join mass and matter to get physical limits (price/stock) and abstract concepts (title)
          const rows = await db.all(`
            SELECT m.id as mass_id, m.matter as matter_id, m.qty as stock, m.value as price, t.title as title, t.code as code 
            FROM mass m 
            INNER JOIN matter t ON m.matter = t.id 
            WHERE m.active = 1 OR m.active IS NULL
          `);
          if (Array.isArray(rows)) {
            setCatalog(rows as unknown as CatalogItem[]);
          }
        } catch (e) {
          console.error("Failed to load catalog:", e);
        }
      }
      loadCatalog();
    }, [])
  );

  const handleAddToCart = (item: CatalogItem) => {
    setCart(prev => {
      const existing = prev[item.mass_id];
      return {
        ...prev,
        [item.mass_id]: {
          ...item,
          qty: existing ? existing.qty + 1 : 1
        }
      };
    });
  };

  const handleClearCart = () => setCart({});

  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setIsCheckingOut(true);
    try {
      const db = getUserDb();
      const globalDb = getGlobalDb();
      const streamId = `ord_${Date.now()}`; // Unique order stream
      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);

      const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // 1. Insert order Sale header motion (Opcode 201) in Tenant DB with status 'PENDING'
      await db.run(
        "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          motionId,
          streamId,
          1, // Sequence 1 for the Sale header
          201, // Opcode 201 for SALE
          "PENDING",
          totalAmount,
          "p", // scope
          JSON.stringify({ items_count: totalItems })
        ]
      );
      
      // 2. Insert each item sold as an individual motion record (Opcode 101) under the same stream.
      // This represents the movement of the specific items and tracks their lifecycle (status).
      let index = 0;
      for (const item of cartItems) {
        const itemMotionId = `mot_item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db.run(
          "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            itemMotionId,
            streamId,
            2 + index, // Sequence starting from 2
            101, // Opcode 101 for SOLD (inventory movement)
            "PENDING",
            -item.qty, // Negative delta representing movement out of stock
            "p", // scope
            JSON.stringify({ mass_id: item.mass_id, matter_id: item.matter_id, title: item.title, price: item.price })
          ]
        );
        index++;
      }

      // 3. Deduct physical presence (stock) from the mass table in Global DB
      for (const item of cartItems) {
        if (item.mass_id) {
          await globalDb.run(
            "UPDATE mass SET qty = COALESCE(qty, 0) - ? WHERE id = ?",
            [item.qty, item.mass_id]
          );
        }
      }

      setCart({});
      router.back(); // Return to home timeline immediately
    } catch (e) {
      console.error("Checkout failed:", e);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Pastel colors for empty catalog placeholder testing
  const colorPalette = ["#FFD1F5", "#FFE054", "#A8A5FF", "#1dd1a1", "#FF822E"];

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Space</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerActionBtn}>
          <Ionicons name="close" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* POS Grid Block */}
        <View style={styles.posBlock}>
          <Text style={styles.sectionHeader}>Catalog Items</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.grid}>
              {catalog.length === 0 ? (
                <Text style={styles.emptyText}>No active items found. Ask the AI to create products and inventory!</Text>
              ) : (
                catalog.map((item, index) => (
                  <TouchableOpacity 
                    key={item.mass_id} 
                    style={[styles.productCard, { backgroundColor: colorPalette[index % colorPalette.length] + '20' }]}
                    onPress={() => handleAddToCart(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.productIconWrapper}>
                      <Ionicons name="fast-food-outline" size={28} color="#333" />
                    </View>
                    <Text style={styles.productTitle} numberOfLines={2}>{item.title || "Unnamed Item"}</Text>
                    <Text style={styles.productPrice}>₹{item.price || 0}</Text>
                    
                    {/* Badge showing if it's in cart */}
                    {cart[item.mass_id] && (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{cart[item.mass_id].qty}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Floating Checkout Block */}
      {totalItems > 0 && (
        <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.checkoutInfo}>
            <Text style={styles.checkoutTotal}>₹{totalPrice}</Text>
            <Text style={styles.checkoutCount}>{totalItems} items</Text>
          </View>
          
          <View style={styles.checkoutActions}>
            <TouchableOpacity 
              style={styles.checkoutBtn} 
              onPress={handleCheckout}
              disabled={isCheckingOut}
            >
              <Text style={styles.checkoutBtnText}>
                {isCheckingOut ? "Processing..." : "Checkout"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerActionBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  posBlock: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 15,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 15,
  },
  productCard: {
    width: '47%',
    padding: 15,
    borderRadius: 16,
    marginBottom: 15,
    position: 'relative',
  },
  productIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#000',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 40,
    width: '100%',
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 20,
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  checkoutInfo: {
    flex: 1,
  },
  checkoutTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  checkoutCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  checkoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkoutBtn: {
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 25,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  }
});
