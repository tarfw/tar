import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator, Modal, ScrollView, Platform, Alert } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tar } from '@/lib/tar';

interface WorkspaceItem {
  subdomain: string;
  scope: string;
  vertical: string;
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

const MOCK_PUBLIC_WORKSPACES: WorkspaceItem[] = [
  {
    subdomain: 'croissant-bakery',
    scope: 's:croissant-bakery',
    vertical: 'bakery',
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
    vertical: 'taxi',
    name: 'Mumbai Taxis',
    description: 'Reliable, instant taxi bookings and airport transfers across Mumbai.',
    mockProducts: []
  },
  {
    subdomain: 'grand-salon',
    scope: 's:grand-salon',
    vertical: 'beauty',
    name: 'Grand Salon & Spa',
    description: 'Premium haircuts, therapeutic spa body treatments, and luxury wellness.',
    mockProducts: []
  },
  {
    subdomain: 'streetwear-co',
    scope: 's:streetwear-co',
    vertical: 'retail',
    name: 'Streetwear Co.',
    description: 'Limited edition oversized tees, hoodies, and accessories.',
    mockProducts: [
      { id: 'r1', title: 'Heavyweight Black Hoodie', price: 1800 },
      { id: 'r2', title: 'Oversized Cargo Pants', price: 2200 },
      { id: 'r3', title: 'Vintage Graphic Tee', price: 950 },
    ]
  }
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [workspacesList, setWorkspacesList] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);

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
          vertical: w.vertical || 'restaurant',
          name: w.name || w.subdomain,
          description: `${w.vertical || 'Business'} services and storefront.`,
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
    setBookingService(item.vertical === 'beauty' ? 'Hair Cut' : 'General Service');
    setTaxiPickup('');
    setTaxiDropoff('');

    if (item.vertical === 'bakery' || item.vertical === 'retail' || item.vertical === 'restaurant') {
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

  const filteredWorkspaces = workspacesList.filter((w) => {
    const q = query.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.vertical.toLowerCase().includes(q)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.header, { color: theme.text }]}>Space</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Order, book, and request services from public workspaces
        </Text>
      </View>

      {/* Search Wrap */}
      <View style={[styles.searchWrap, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search bakeries, cabs, salons, apparel..."
          placeholderTextColor={theme.textMuted}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Ionicons
            name="close-circle"
            size={18}
            color={theme.textMuted}
            onPress={() => setQuery('')}
          />
        )}
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredWorkspaces}
          keyExtractor={(item) => item.subdomain}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => {
            const colors = VERTICAL_COLORS[item.vertical] || { bg: '#f4f4f5', text: '#71717a', icon: 'business-outline' };
            return (
              <Pressable
                onPress={() => handleOpenStorefront(item)}
                style={({ pressed }) => [
                  styles.workspaceCard,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.cardSubdomain, { color: theme.primary }]}>
                      {item.subdomain}.tarai.space
                    </Text>
                  </View>
                  <View style={[styles.verticalBadge, { backgroundColor: colors.bg }]}>
                    <Ionicons name={colors.icon as any} size={12} color={colors.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.verticalBadgeText, { color: colors.text }]}>
                      {item.vertical.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardDesc, { color: theme.textMuted }]} numberOfLines={2}>
                  {item.description}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="compass-outline" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted, marginTop: 8 }]}>
                No workspaces matching query
              </Text>
            </View>
          }
        />
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
                      {(selectedWorkspace.vertical === 'bakery' ||
                        selectedWorkspace.vertical === 'retail' ||
                        selectedWorkspace.vertical === 'restaurant') && (
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
                      {selectedWorkspace.vertical === 'beauty' && (
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
                      {selectedWorkspace.vertical === 'taxi' && (
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
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  header: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 13 },
  workspaceCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubdomain: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  verticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verticalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
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
