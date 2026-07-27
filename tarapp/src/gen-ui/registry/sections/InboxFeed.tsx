import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

export interface InboxItem {
  id: string;
  type: 'order' | 'task' | 'delivery' | 'booking' | 'alert';
  title: string;
  description: string;
  time: string;
  status: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

const MOCK_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'inb_1',
    type: 'order',
    title: 'New Online Order #1042',
    description: '2x Sourdough Loaf, 1x Flat White Coffee ($390)',
    time: '2 mins ago',
    status: 'Pending Prep',
    icon: 'cart-outline',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
  },
  {
    id: 'inb_2',
    type: 'booking',
    title: 'Appointment Booked: Hair Styling',
    description: 'Client: Sarah Connor (Slot: Today 4:00 PM)',
    time: '18 mins ago',
    status: 'Confirmed',
    icon: 'calendar-outline',
    iconBg: '#faf5ff',
    iconColor: '#9333ea',
  },
  {
    id: 'inb_3',
    type: 'delivery',
    title: 'Delivery Shipment Dispatched',
    description: 'Driver: Rajesh Kumar (Order #1039 in transit)',
    time: '45 mins ago',
    status: 'In Transit',
    icon: 'car-outline',
    iconBg: '#fef3c7',
    iconColor: '#d97706',
  },
  {
    id: 'inb_4',
    type: 'alert',
    title: 'Stock Alert: Almond Croissants',
    description: 'Inventory remaining is below threshold (3 units left)',
    time: '2 hours ago',
    status: 'Low Stock',
    icon: 'warning-outline',
    iconBg: '#fff1f2',
    iconColor: '#e11d48',
  },
];

export default function InboxFeed({ props, designTokens, data }: SectionProps) {
  const listData: InboxItem[] = (data && Array.isArray(data) && data.length > 0)
    ? data.map((d, idx) => ({
        id: d.id || `inb_${idx}`,
        type: d.type || 'order',
        title: d.title || d.name || 'Notification Event',
        description: d.description || d.subtitle || '',
        time: d.time || 'Just now',
        status: d.status || 'Active',
        icon: d.icon || 'notifications-outline',
        iconBg: '#f1f5f9',
        iconColor: '#334155',
      }))
    : MOCK_INBOX_ITEMS;

  const renderItem = ({ item }: { item: InboxItem }) => (
    <Pressable style={styles.itemRow}>
      <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>Inbox & Activity Feed</Text>
        <View style={styles.badgeCount}>
          <Text style={styles.badgeText}>{listData.length} New</Text>
        </View>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  badgeCount: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
    color: '#94a3b8',
  },
  desc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
  },
});
