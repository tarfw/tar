import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import * as Linking from 'expo-linking';

export function TextCard({ text, isUser = false }: { text: string; isUser?: boolean }) {
  const theme = useTheme();
  
  if (isUser) {
    return (
      <View style={styles.userTextContainer}>
        <View style={[styles.userTextCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.assistantTextContainer}>
      <View style={[styles.assistantIconContainer, { backgroundColor: theme.primary + '15' }]}>
        <Ionicons name="sparkles" size={14} color={theme.primary} />
      </View>
      <View style={styles.assistantContentContainer}>
        <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
      </View>
    </View>
  );
}

export function ErrorCard({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: '#ff4d4f', backgroundColor: theme.background }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="alert-circle" size={20} color="#ff4d4f" />
        <Text style={[styles.cardTitle, { color: '#ff4d4f', marginLeft: 6 }]}>Error</Text>
      </View>
      <Text style={[styles.bodyText, { color: theme.text, marginTop: 4 }]}>{message}</Text>
    </View>
  );
}

export function ProductListCard({ products }: { products: any[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="cube-outline" size={20} color={theme.primary} />
        <Text style={[styles.cardTitle, { color: theme.text, marginLeft: 6 }]}>Inventory ({products.length})</Text>
      </View>
      <View style={{ marginTop: 8, gap: 8 }}>
        {products.length === 0 ? (
          <Text style={[styles.metaText, { color: theme.textMuted, textAlign: 'center', paddingVertical: 12 }]}>
            No products in inventory. Try adding one with the prompt below!
          </Text>
        ) : (
          products.map((p) => {
            let cat = 'General';
            try {
              if (p.data) {
                const parsed = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
                cat = parsed.category || cat;
              }
            } catch {}
            return (
              <View key={p.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nameText, { color: theme.text }]}>{p.title}</Text>
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>{cat}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.priceText, { color: theme.primary }]}>₹{Number(p.value ?? 0).toFixed(0)}</Text>
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>Qty: {p.qty ?? 0}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

export function ProductCreatedCard({ product }: { product: any }) {
  const theme = useTheme();
  let cat = 'General';
  try {
    if (product.data) {
      const parsed = typeof product.data === 'string' ? JSON.parse(product.data) : product.data;
      cat = parsed.category || cat;
    }
  } catch {}
  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: '#52c41a' }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="checkmark-circle" size={20} color="#52c41a" />
        <Text style={[styles.cardTitle, { color: theme.text, marginLeft: 6 }]}>Product Created</Text>
      </View>
      <View style={{ marginTop: 8 }}>
        <Text style={[styles.nameText, { color: theme.text, fontSize: 16 }]}>{product?.title || ''}</Text>
        <Text style={[styles.metaText, { color: theme.textMuted }]}>Category: {cat}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={[styles.priceText, { color: theme.primary, fontSize: 18 }]}>₹{Number(product?.value ?? 0).toFixed(0)}</Text>
          <Text style={[styles.nameText, { color: theme.text }]}>Stock Qty: {product?.qty ?? 0}</Text>
        </View>
      </View>
    </View>
  );
}

export function OrderListCard({ orders }: { orders: any[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="cart-outline" size={20} color={theme.primary} />
        <Text style={[styles.cardTitle, { color: theme.text, marginLeft: 6 }]}>Orders ({orders.length})</Text>
      </View>
      <View style={{ marginTop: 8, gap: 8 }}>
        {orders.length === 0 ? (
          <Text style={[styles.metaText, { color: theme.textMuted, textAlign: 'center', paddingVertical: 12 }]}>
            No orders recorded yet.
          </Text>
        ) : (
          orders.map((o) => {
            const status = o.status || 'pending';
            const total = o.value ?? 0;
            return (
              <View key={o.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nameText, { color: theme.text }]}>Order #{o.id?.slice(-6)}</Text>
                  <Text style={[styles.metaText, { color: status === 'completed' ? '#52c41a' : theme.primary }]}>
                    {status.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.priceText, { color: theme.text }]}>₹{Number(total).toFixed(0)}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

export function StatsCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border, padding: 20 }]}>
      <Text style={[styles.metaText, { color: theme.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
        {title}
      </Text>
      <Text style={[styles.priceText, { color: theme.text, fontSize: 32, fontWeight: '800', marginTop: 6 }]}>
        {value}
      </Text>
      {subtitle ? (
        <Text style={[styles.metaText, { color: theme.textMuted, marginTop: 4 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function SiteCard({
  storeName,
  subdomain,
  layout,
  onPublish,
  isDirty,
}: {
  storeName: string;
  subdomain: string;
  layout: any;
  onPublish?: () => void;
  isDirty?: boolean;
}) {
  const theme = useTheme();
  const editorUrl = `${subdomain}.tarai.space/edit`;

  const handleOpenEditor = () => {
    Linking.openURL(`https://${editorUrl}`);
  };

  const sections = layout?.sections || [];

  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="desktop-outline" size={20} color={theme.primary} />
        <Text style={[styles.cardTitle, { color: theme.text, marginLeft: 6 }]}>Live Site Status</Text>
      </View>

      <Text style={[styles.nameText, { color: theme.text, marginTop: 12 }]}>{storeName}</Text>
      <Text selectable style={[styles.metaText, { color: theme.primary, fontSize: 14, marginVertical: 4 }]}>
        {subdomain}.tarai.space
      </Text>

      <View style={[styles.infoSection, { borderTopColor: theme.border }]}>
        <Text style={[styles.metaText, { color: theme.textMuted, marginBottom: 8 }]}>
          Active Template: {layout?.template || 'streetwear-dark'}
        </Text>
        <Text style={[styles.metaText, { color: theme.textMuted, marginBottom: 8 }]}>
          Sections ({sections.length}):
        </Text>
        {sections.map((s: any, idx: number) => (
          <View key={s.id || idx} style={styles.sectionBadge}>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.metaText, { color: theme.text }]}>
              {s.type}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Pressable style={[styles.actionButton, { backgroundColor: theme.text }]} onPress={handleOpenEditor}>
          <Ionicons name="open-outline" size={16} color={theme.background} />
          <Text style={[styles.actionButtonText, { color: theme.background }]}>Open Editor</Text>
        </Pressable>
        
        {onPublish && (
          <Pressable
            style={[styles.actionButton, { backgroundColor: isDirty ? theme.primary : theme.border }]}
            onPress={onPublish}
            disabled={!isDirty}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={isDirty ? '#ffffff' : theme.textMuted} />
            <Text style={[styles.actionButtonText, { color: isDirty ? '#ffffff' : theme.textMuted }]}>
              {isDirty ? 'Publish' : 'Published'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    marginTop: 2,
  },
  userTextContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userTextCard: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    borderWidth: 1,
  },
  assistantTextContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
    paddingRight: 24,
  },
  assistantIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  assistantContentContainer: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  infoSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
