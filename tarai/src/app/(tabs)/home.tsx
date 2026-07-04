import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useCallback } from 'react';
import { tarflue } from '@/lib/tarflue';
import { OrderCard } from '@/components/cards/OrderCard';
import { TaskCard } from '@/components/cards/TaskCard';
import { DeliveryCard } from '@/components/cards/DeliveryCard';
import { BookingCard } from '@/components/cards/BookingCard';
import { StockCard } from '@/components/cards/StockCard';
import { ExpiryCard } from '@/components/cards/ExpiryCard';

interface MotionEvent {
  id?: string;
  stream: string;
  seq: number;
  action: number;
  data: any;
  time: string;
}

export default function HomeScreen() {
  const theme = useTheme();
  const [motions, setMotions] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimeline = useCallback(async () => {
    try {
      // Try timeline API first (user's Inbox)
      const result = await tarflue.timeline.get({ limit: 50 });
      if (result.rows && result.rows.length > 0) {
        setMotions(result.rows);
      } else {
        // Fallback to local motion table
        const localResult = await tarflue.tools.read({
          table: 'motion',
          limit: 50,
        });
        setMotions(localResult.rows || []);
      }
    } catch (e) {
      // Fallback to local motion table
      try {
        const localResult = await tarflue.tools.read({
          table: 'motion',
          limit: 50,
        });
        setMotions(localResult.rows || []);
      } catch (e2) {
        console.warn('[Home] Failed to fetch timeline:', e2);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTimeline();
  }, [fetchTimeline]);

  const handleCardAction = async (type: string, action: string, data: any) => {
    try {
      await tarflue.agents.chat(`${action} ${type}: ${JSON.stringify(data)}`);
      fetchTimeline(); // Refresh after action
    } catch (e) {
      console.warn('[Home] Action failed:', e);
    }
  };

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
      <Text style={[styles.header, { color: theme.text }]}>Home</Text>

      {motions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No activity yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Create a workspace in Chat to get started
          </Text>
        </View>
      ) : (
        <>
          {sections.order && sections.order.length > 0 && (
            <Section title="Orders" theme={theme}>
              {sections.order.map((m, i) => (
                <OrderCard
                  key={i}
                  data={m.data}
                  onAction={(action) => handleCardAction('order', action, m.data)}
                />
              ))}
            </Section>
          )}
          {sections.task && sections.task.length > 0 && (
            <Section title="Tasks" theme={theme}>
              {sections.task.map((m, i) => (
                <TaskCard
                  key={i}
                  data={m.data}
                  onAction={(action) => handleCardAction('task', action, m.data)}
                />
              ))}
            </Section>
          )}
          {sections.delivery && sections.delivery.length > 0 && (
            <Section title="Deliveries" theme={theme}>
              {sections.delivery.map((m, i) => (
                <DeliveryCard
                  key={i}
                  data={m.data}
                  onAction={(action) => handleCardAction('delivery', action, m.data)}
                />
              ))}
            </Section>
          )}
          {sections.booking && sections.booking.length > 0 && (
            <Section title="Bookings" theme={theme}>
              {sections.booking.map((m, i) => (
                <BookingCard
                  key={i}
                  data={m.data}
                  onAction={(action) => handleCardAction('booking', action, m.data)}
                />
              ))}
            </Section>
          )}
          {sections.stock_alert && sections.stock_alert.length > 0 && (
            <Section title="Stock Alerts" theme={theme}>
              {sections.stock_alert.map((m, i) => (
                <StockCard
                  key={i}
                  data={m.data}
                  onAction={(action) => handleCardAction('stock', action, m.data)}
                />
              ))}
            </Section>
          )}
          {sections.expiry && sections.expiry.length > 0 && (
            <Section title="Expiry Alerts" theme={theme}>
              {sections.expiry.map((m, i) => (
                <ExpiryCard
                  key={i}
                  data={m.data}
                  onAction={(action) => handleCardAction('expiry', action, m.data)}
                />
              ))}
            </Section>
          )}
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
  header: { fontSize: 32, fontWeight: '800', marginBottom: 24 },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
});
