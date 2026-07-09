import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useEffect, useCallback } from 'react';
import { tar } from '@/lib/tar';
import * as SecureStore from 'expo-secure-store';
import { OrderCard } from '@/components/cards/OrderCard';
import { TaskCard } from '@/components/cards/TaskCard';
import { DeliveryCard } from '@/components/cards/DeliveryCard';
import { BookingCard } from '@/components/cards/BookingCard';
import { StockCard } from '@/components/cards/StockCard';
import { ExpiryCard } from '@/components/cards/ExpiryCard';

interface MotionEvent {
  id?: string;
  type: string;
  scope: string;
  title?: string;
  form_type?: string;
  data: any;
  time: string;
}

export default function InboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [motions, setMotions] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimeline = useCallback(async () => {
    try {
      const result = await tar.timeline({ limit: 50 });
      const items = (result.motions || []).map((r: any) => {
        let parsedData = r.data;
        if (typeof r.data === 'string') {
          try { parsedData = JSON.parse(r.data); } catch {}
        }
        return { ...r, data: parsedData };
      });
      setMotions(items);
    } catch (e) {
      console.warn('[Inbox] Failed to fetch timeline:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    (async () => {
      const redirect = await SecureStore.getItemAsync('redirect_to_workspaces').catch(() => null);
      if (redirect === 'true') {
        await SecureStore.deleteItemAsync('redirect_to_workspaces').catch(() => null);
        console.log('[Inbox] Redirecting to /workspaces as requested by onboarding');
        try {
          router.replace('/(tabs)/workspaces');
        } catch (e1) {
          console.warn('[Inbox] Redirect to /(tabs)/workspaces failed, trying /workspaces:', e1);
          try {
            router.replace('/workspaces');
          } catch (e2) {
            console.warn('[Inbox] Redirect to /workspaces failed, falling back to /:', e2);
            router.replace('/');
          }
        }
      }
    })();
  }, [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTimeline();
  }, [fetchTimeline]);

  const sections = groupMotionsByType(motions);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textMuted }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: theme.text }]}>Inbox</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {motions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No activity yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Orders, tasks, and deliveries will appear here
          </Text>
        </View>
      ) : (
        <>
          {sections.order && sections.order.length > 0 && (
            <Section title="Orders" theme={theme}>
              {sections.order.map((m, i) => (
                <OrderCard key={i} data={m.data} onAction={() => {}} />
              ))}
            </Section>
          )}
          {sections.task && sections.task.length > 0 && (
            <Section title="Tasks" theme={theme}>
              {sections.task.map((m, i) => (
                <TaskCard key={i} data={m.data} onAction={() => {}} />
              ))}
            </Section>
          )}
          {sections.delivery && sections.delivery.length > 0 && (
            <Section title="Deliveries" theme={theme}>
              {sections.delivery.map((m, i) => (
                <DeliveryCard key={i} data={m.data} onAction={() => {}} />
              ))}
            </Section>
          )}
          {sections.booking && sections.booking.length > 0 && (
            <Section title="Bookings" theme={theme}>
              {sections.booking.map((m, i) => (
                <BookingCard key={i} data={m.data} onAction={() => {}} />
              ))}
            </Section>
          )}
          {sections.stock_alert && sections.stock_alert.length > 0 && (
            <Section title="Stock Alerts" theme={theme}>
              {sections.stock_alert.map((m, i) => (
                <StockCard key={i} data={m.data} onAction={() => {}} />
              ))}
            </Section>
          )}
          {sections.expiry && sections.expiry.length > 0 && (
            <Section title="Expiry Alerts" theme={theme}>
              {sections.expiry.map((m, i) => (
                <ExpiryCard key={i} data={m.data} onAction={() => {}} />
              ))}
            </Section>
          )}

          {/* Dynamic fallback for other activity types (e.g. leads, sales, expenses, workspaces) */}
          {Object.entries(sections).map(([key, list]) => {
            const knownTypes = new Set(['order', 'task', 'delivery', 'booking', 'stock_alert', 'expiry']);
            if (knownTypes.has(key) || !list || list.length === 0) return null;

            // Format section title (e.g. 'lead' -> 'Leads', 'expense' -> 'Expenses')
            const displayTitle = key.charAt(0).toUpperCase() + key.slice(1) + 's';

            return (
              <Section key={key} title={displayTitle} theme={theme}>
                {list.map((m, i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                        {m.title || m.data?.event?.replace(/_/g, ' ').toUpperCase() || m.form_type?.toUpperCase() || 'Activity'}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textMuted }}>
                        {m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, color: theme.textMuted }}>
                      {m.data?.name || m.data?.title || m.data?.text || m.data?.reason || JSON.stringify(m.data)}
                    </Text>
                  </View>
                ))}
              </Section>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, theme, children }: { title: string; theme: any; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function groupMotionsByType(motions: MotionEvent[]): Record<string, MotionEvent[]> {
  const groups: Record<string, MotionEvent[]> = {};
  for (const m of motions) {
    const type = m.data?.type || m.data?.event?.split('_')[0] || 'other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(m);
  }
  return groups;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  header: { fontSize: 32, fontWeight: '800' },
  syncButton: { fontSize: 15, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
});
