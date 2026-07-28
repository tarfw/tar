import { View, Text, StyleSheet, TextInput, Pressable, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView, Alert, Animated, Easing } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tar } from '@/lib/tar';

interface WorkspaceItem {
  subdomain: string;
  scope: string;
  type: string;
  name: string;
  description: string;
  mockProducts?: Array<{ id: string; title: string; price: number }>;
}

const VERTICAL_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  bakery: { bg: '#fff1f2', text: '#e11d48', icon: 'pizza-outline' },
  taxi: { bg: '#eff6ff', text: '#2563eb', icon: 'car-outline' },
  beauty: { bg: '#faf5ff', text: '#9333ea', icon: 'rose-outline' },
  retail: { bg: '#ecfdf5', text: '#059669', icon: 'shirt-outline' },
  restaurant: { bg: '#fef3c7', text: '#d97706', icon: 'restaurant-outline' },
};

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getVerticalEmoji(type: string): string {
  const map: Record<string, string> = {
    bakery: '🍪',
    taxi: '🚕',
    beauty: '💇',
    retail: '🛍️',
    restaurant: '🍽️',
  };
  return map[type] || '✨';
}

const MOCK_PUBLIC_WORKSPACES: WorkspaceItem[] = [
  {
    subdomain: 'croissant-bakery',
    scope: 's:croissant-bakery',
    type: 'bakery',
    name: 'Croissant & Cafe',
    description: 'Artisanal French pastries, fresh sourdough bread, and premium coffee.',
    mockProducts: [
      { id: 'p1', title: 'Almond Croissant', price: 180 },
      { id: 'p2', title: 'Sourdough Loaf', price: 240 },
      { id: 'p3', title: 'Pain au Chocolat', price: 160 },
      { id: 'p4', title: 'Flat White Coffee', price: 150 },
    ]
  },
  {
    subdomain: 'mumbai-cabs',
    scope: 's:mumbai-cabs',
    type: 'taxi',
    name: 'Mumbai Taxis',
    description: 'Reliable, instant taxi bookings and airport transfers across Mumbai.',
    mockProducts: []
  },
  {
    subdomain: 'grand-salon',
    scope: 's:grand-salon',
    type: 'beauty',
    name: 'Grand Salon & Spa',
    description: 'Premium haircuts, therapeutic spa body treatments, and luxury wellness.',
    mockProducts: []
  },
  {
    subdomain: 'streetwear-co',
    scope: 's:streetwear-co',
    type: 'retail',
    name: 'Streetwear Co.',
    description: 'Limited edition oversized tees, hoodies, and accessories.',
    mockProducts: [
      { id: 'r1', title: 'Heavyweight Black Hoodie', price: 1800 },
      { id: 'r2', title: 'Oversized Cargo Pants', price: 2200 },
      { id: 'r3', title: 'Vintage Graphic Tee', price: 950 },
    ]
  }
];

interface PromoAd {
  title: string;
  subtitle: string;
  type: string;
  cta: string;
  accent: string;
}

const PROMO_ADS: PromoAd[] = [
  {
    title: 'Fresh Almond Croissants',
    subtitle: 'Baked this morning at Croissant & Cafe — free delivery over ₹500',
    type: 'bakery',
    cta: 'Order Now',
    accent: '#e11d48',
  },
  {
    title: 'Ride anywhere in Mumbai',
    subtitle: 'Mumbai Taxis — airport transfers from ₹380. Tap to book instantly.',
    type: 'taxi',
    cta: 'Book Cab',
    accent: '#2563eb',
  },
  {
    title: 'Spa Day Escape',
    subtitle: 'Grand Salon & Spa — 20% off Facials this week. Pamper yourself.',
    type: 'beauty',
    cta: 'Book Slot',
    accent: '#9333ea',
  },
  {
    title: 'Drop the new fit',
    subtitle: 'Streetwear Co. — limited oversized hoodies back in stock. Shop now.',
    type: 'retail',
    cta: 'Shop',
    accent: '#059669',
  },
  {
    title: 'AI-curated for you',
    subtitle: 'Discover services personalized to your taste across the marketplace.',
    type: 'restaurant',
    cta: 'Explore',
    accent: '#d97706',
  },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [workspacesList, setWorkspacesList] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'bakery', label: 'Bakery' },
    { id: 'retail', label: 'Retail' },
    { id: 'beauty', label: 'Beauty & Spa' },
    { id: 'taxi', label: 'Transport' },
  ];

  // Modal storefront interaction states
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceItem | null>(null);
  const [workspaceProducts, setWorkspaceProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Cart state for ordering vertical
  const [cart, setCart] = useState<Record<string, number>>({});

  // Booking states
  const [bookingService, setBookingService] = useState('Hair Cut');
  const [bookingDate, setBookingDate] = useState('2026-07-09');
  const [bookingTime, setBookingTime] = useState('11:00 AM');

  // Taxi states
  const [taxiPickup, setTaxiPickup] = useState('');
  const [taxiDropoff, setTaxiDropoff] = useState('');
  const [taxiCarType, setTaxiCarType] = useState('Classic Sedan');

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tar.listWorkspaces().catch(() => ({ workspaces: [] }));
      const userSubdomains = new Set(res.workspaces?.map((w: any) => w.subdomain) || []);

      // Filter out user's own workspaces, then merge with mock public ones
      const systemWorkspaces: WorkspaceItem[] = (res.workspaces || [])
        .filter((w: any) => !userSubdomains.has(w.subdomain))
        .map((w: any) => ({
          subdomain: w.subdomain,
          scope: w.scope,
          type: w.type || 'business',
          name: w.name || w.subdomain,
          description: `${w.type || 'Business'} services and storefront.`,
        }));

      // Combine and filter duplicates
      const merged = [...systemWorkspaces];
      MOCK_PUBLIC_WORKSPACES.forEach((mock) => {
        if (!userSubdomains.has(mock.subdomain)) {
          merged.push(mock);
        }
      });

      setWorkspacesList(merged);
    } catch (e) {
      console.warn('[Explore] Failed to load workspaces:', e);
      setWorkspacesList(MOCK_PUBLIC_WORKSPACES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleOpenStorefront = async (item: WorkspaceItem) => {
    setSelectedWorkspace(item);
    setCart({});
    setActionSuccessMessage(null);
    setBookingService(item.type === 'beauty' ? 'Hair Cut' : 'General Service');
    setTaxiPickup('');
    setTaxiDropoff('');

    if (item.type === 'bakery' || item.type === 'retail' || item.type === 'restaurant') {
      setLoadingProducts(true);
      try {
        const dbRes = await tar.tool('read', { table: 'matter', type: 'product', active: 1, scope: item.scope });
        if (dbRes?.rows && dbRes.rows.length > 0) {
          setWorkspaceProducts(dbRes.rows);
        } else {
          setWorkspaceProducts(item.mockProducts || []);
        }
      } catch (e) {
        setWorkspaceProducts(item.mockProducts || []);
      } finally {
        setLoadingProducts(false);
      }
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  // Place Order Mutation
  const handlePlaceOrder = async () => {
    if (!selectedWorkspace) return;
    const itemsToOrder = workspaceProducts
      .filter((p) => cart[p.id] > 0)
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: p.value || p.price || 0,
        quantity: cart[p.id],
      }));

    if (itemsToOrder.length === 0) {
      Alert.alert('Empty Cart', 'Please select at least one item to order.');
      return;
    }

    setSubmittingAction(true);
    try {
      const orderId = 'order_' + Date.now();
      const total = itemsToOrder.reduce((acc, item) => acc + item.price * item.quantity, 0);

      await tar.tool('create', {
        table: 'matter',
        scope: selectedWorkspace.scope,
        type: 'order',
        id: orderId,
        value: total,
        status: 'pending',
        data: {
          items: itemsToOrder,
          orderedAt: new Date().toISOString(),
          notes: 'Ordered via global explore marketplace',
        },
      });

      setActionSuccessMessage(`Order placed successfully!\nID: #${orderId.slice(-6)}\nTotal: ₹${total}`);
      setCart({});
    } catch (e: any) {
      Alert.alert('Order Failed', e.message || 'Could not place order.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Place Booking Mutation
  const handlePlaceBooking = async () => {
    if (!selectedWorkspace) return;
    setSubmittingAction(true);
    try {
      const bookingId = 'booking_' + Date.now();
      await tar.tool('create', {
        table: 'matter',
        scope: selectedWorkspace.scope,
        type: 'booking',
        id: bookingId,
        value: 1200,
        data: {
          service: bookingService,
          date: bookingDate,
          time: bookingTime,
          customerName: 'Marketplace Guest',
          status: 'confirmed',
        },
      });

      setActionSuccessMessage(`Booking confirmed!\nService: ${bookingService}\nDate: ${bookingDate} at ${bookingTime}`);
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'Could not schedule appointment.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Place Taxi Request Mutation
  const handleRequestTaxi = async () => {
    if (!selectedWorkspace) return;
    if (!taxiPickup.trim() || !taxiDropoff.trim()) {
      Alert.alert('Missing Details', 'Please fill in pickup and dropoff locations.');
      return;
    }

    setSubmittingAction(true);
    try {
      const rideId = 'ride_' + Date.now();
      await tar.tool('create', {
        table: 'matter',
        scope: selectedWorkspace.scope,
        type: 'taxi_ride',
        id: rideId,
        value: 380,
        data: {
          pickup: taxiPickup,
          destination: taxiDropoff,
          carType: taxiCarType,
          status: 'dispatched',
          driverName: 'Ramesh Kumar',
          etaMinutes: 5,
        },
      });

      setActionSuccessMessage(`Taxi Dispatched!\nDriver: Ramesh Kumar is arriving at ${taxiPickup} in 5 mins.`);
    } catch (e: any) {
      Alert.alert('Request Failed', e.message || 'Could not request ride.');
    } finally {
      setSubmittingAction(false);
    }
  };



  const filteredWorkspaces = workspacesList.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.type === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={{ paddingTop: Math.max(insets.top + 8, 16), paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>
          Explore Marketplace
        </Text>
      </View>

      {/* Full-width Search Bar matching Workspace Input Bar UI */}
      <View style={{
        minHeight: 48,
        backgroundColor: theme.background,
        borderColor: theme.border,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <Ionicons name="search-outline" size={17} color={theme.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: theme.text, paddingVertical: 12 }}
          placeholder="Search storefronts or services..."
          placeholderTextColor={theme.textMuted + '80'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills */}
      <View style={{ paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? theme.text : theme.border + '60',
                  backgroundColor: active ? theme.text : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 12.5,
                  fontWeight: active ? '600' : '400',
                  color: active ? theme.background : theme.textSecondary,
                }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* High-Performance Minimal FlatList */}
      {!loading ? (
        <FlatList
          data={filteredWorkspaces}
          keyExtractor={(item) => item.subdomain}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom + 24, 32) }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleOpenStorefront(item)}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.primary + '15',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Text style={{ fontSize: 20 }}>{getVerticalEmoji(item.type)}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 2 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textMuted }} numberOfLines={1}>
                  {item.description || `${item.type.toUpperCase()} • ${item.subdomain}`}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="compass-outline" size={36} color={theme.textMuted} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14, color: theme.textMuted, fontWeight: '500' }}>
                No storefronts match your search
              </Text>
            </View>
          }
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )}

      {/* Interactive Service Drawer / Modal */}
      <Modal
        visible={selectedWorkspace !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedWorkspace(null)}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedWorkspace(null)} />
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {selectedWorkspace && (
              <>
                {/* Modal Header */}
                <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedWorkspace.name}</Text>
                    <Text style={{ fontSize: 13, color: theme.primary }}>
                      {selectedWorkspace.subdomain}.tarai.space
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedWorkspace(null)} hitSlop={12}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </Pressable>
                </View>

                {/* Main Action Content Area */}
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
                  {actionSuccessMessage ? (
                    <View style={styles.successContainer}>
                      <Ionicons name="checkmark-circle" size={48} color="#52c41a" />
                      <Text style={[styles.successTitle, { color: theme.text }]}>Success!</Text>
                      <Text style={[styles.successText, { color: theme.textSecondary }]}>
                        {actionSuccessMessage}
                      </Text>
                      <Pressable
                        style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: 24 }]}
                        onPress={() => setSelectedWorkspace(null)}
                      >
                        <Text style={styles.primaryButtonText}>Done</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {/* 1. ORDERING / RETAIL FLOW */}
                      {(selectedWorkspace.type === 'bakery' ||
                        selectedWorkspace.type === 'retail' ||
                        selectedWorkspace.type === 'restaurant') && (
                        <View>
                          <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Delicacies & Items</Text>
                          {loadingProducts ? (
                            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
                          ) : (
                            workspaceProducts.map((p) => {
                              const qty = cart[p.id] || 0;
                              const price = p.value || p.price || 0;
                              return (
                                <View key={p.id} style={[styles.menuItemRow, { borderBottomColor: theme.border }]}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.menuItemTitle, { color: theme.text }]}>{p.title}</Text>
                                    <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
                                      ₹{Number(price).toFixed(0)}
                                    </Text>
                                  </View>
                                  <View style={styles.qtyControl}>
                                    <Pressable
                                      style={[styles.qtyBtn, { borderColor: theme.border }]}
                                      onPress={() => updateCartQty(p.id, -1)}
                                    >
                                      <Ionicons name="remove" size={14} color={theme.text} />
                                    </Pressable>
                                    <Text style={[styles.qtyText, { color: theme.text }]}>{qty}</Text>
                                    <Pressable
                                      style={[styles.qtyBtn, { borderColor: theme.border }]}
                                      onPress={() => updateCartQty(p.id, 1)}
                                    >
                                      <Ionicons name="add" size={14} color={theme.text} />
                                    </Pressable>
                                  </View>
                                </View>
                              );
                            })
                          )}

                          <Pressable
                            style={[
                              styles.primaryButton,
                              {
                                backgroundColor: theme.primary,
                                marginTop: 24,
                                opacity: submittingAction ? 0.7 : 1,
                              },
                            ]}
                            onPress={handlePlaceOrder}
                            disabled={submittingAction}
                          >
                            {submittingAction ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={styles.primaryButtonText}>Place Storefront Order</Text>
                            )}
                          </Pressable>
                        </View>
                      )}

                      {/* 2. BOOKING / BEAUTY FLOW */}
                      {selectedWorkspace.type === 'beauty' && (
                        <View>
                          <Text style={[styles.sectionTitle, { color: theme.text }]}>Schedule Service Appointment</Text>
                          
                          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Select Service</Text>
                          <View style={styles.selectorRow}>
                            {['Hair Cut', 'Facial Spa', 'Massage'].map((s) => {
                              const active = bookingService === s;
                              return (
                                <Pressable
                                  key={s}
                                  onPress={() => setBookingService(s)}
                                  style={[
                                    styles.selectorChip,
                                    {
                                      borderColor: active ? theme.primary : theme.border,
                                      backgroundColor: active ? theme.primary + '10' : 'transparent',
                                    },
                                  ]}
                                >
                                  <Text style={{ color: active ? theme.primary : theme.text, fontSize: 13, fontWeight: '600' }}>
                                    {s}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 16 }]}>Booking Date</Text>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
                            value={bookingDate}
                            onChangeText={setBookingDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={theme.textMuted}
                          />

                          <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 16 }]}>Time Slot</Text>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
                            value={bookingTime}
                            onChangeText={setBookingTime}
                            placeholder="e.g. 11:00 AM"
                            placeholderTextColor={theme.textMuted}
                          />

                          <Pressable
                            style={[
                              styles.primaryButton,
                              {
                                backgroundColor: theme.primary,
                                marginTop: 24,
                                opacity: submittingAction ? 0.7 : 1,
                              },
                            ]}
                            onPress={handlePlaceBooking}
                            disabled={submittingAction}
                          >
                            {submittingAction ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={styles.primaryButtonText}>Confirm Appointment Booking</Text>
                            )}
                          </Pressable>
                        </View>
                      )}

                      {/* 3. TAXI FLOW */}
                      {selectedWorkspace.type === 'taxi' && (
                        <View>
                          <Text style={[styles.sectionTitle, { color: theme.text }]}>Request Cab Pick-up</Text>

                          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Pickup Location</Text>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
                            value={taxiPickup}
                            onChangeText={setTaxiPickup}
                            placeholder="e.g. Mumbai Airport Terminal 2"
                            placeholderTextColor={theme.textMuted}
                          />

                          <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 16 }]}>Dropoff Destination</Text>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
                            value={taxiDropoff}
                            onChangeText={setTaxiDropoff}
                            placeholder="e.g. Gateway of India"
                            placeholderTextColor={theme.textMuted}
                          />

                          <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 16 }]}>Ride Category</Text>
                          <View style={styles.selectorRow}>
                            {['Classic Sedan', 'Prime SUV', 'Lux Ride'].map((c) => {
                              const active = taxiCarType === c;
                              return (
                                <Pressable
                                  key={c}
                                  onPress={() => setTaxiCarType(c)}
                                  style={[
                                    styles.selectorChip,
                                    {
                                      borderColor: active ? theme.primary : theme.border,
                                      backgroundColor: active ? theme.primary + '10' : 'transparent',
                                    },
                                  ]}
                                >
                                  <Text style={{ color: active ? theme.primary : theme.text, fontSize: 12, fontWeight: '600' }}>
                                    {c}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <Pressable
                            style={[
                              styles.primaryButton,
                              {
                                backgroundColor: theme.primary,
                                marginTop: 28,
                                opacity: submittingAction ? 0.7 : 1,
                              },
                            ]}
                            onPress={handleRequestTaxi}
                            disabled={submittingAction}
                          >
                            {submittingAction ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={styles.primaryButtonText}>Book Ride Now</Text>
                            )}
                          </Pressable>
                        </View>
                      )}
                    </>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  adBarWrap: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  adBar: {
    width: '100%',
  },
  adBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    overflow: 'hidden',
  },
  adSpark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  adTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 1,
  },
  adSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  adCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  adCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  greetingText: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  heroTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.7, lineHeight: 34 },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    width: '47.5%',
    gap: 8,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    flex: 1,
  },
  emptyText: { fontSize: 13 },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
