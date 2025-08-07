import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface Props {
  context: {
    title: string;
    id: string;
  };
}

export default function SpaceAgent({ context }: Props) {
  // Space services with colorful illustrated icons
  const spaceServices = [
    { title: 'Book Taxi', icon: '🚕', category: 'Transportation', color: '#3b82f6', bgColor: '#dbeafe' },
    { title: 'Book Auto', icon: '🚗', category: 'Transportation', color: '#1d4ed8', bgColor: '#d1d5db' },
    { title: 'Order Food', icon: '🍕', category: 'Food & Dining', color: '#f59e0b', bgColor: '#fef3c7' },
    { title: 'Book Bus', icon: '🚌', category: 'Transportation', color: '#059669', bgColor: '#d1fae5' },
    { title: 'Book Cinema', icon: '🎬', category: 'Entertainment', color: '#7c3aed', bgColor: '#ede9fe' },
    { title: 'Book Hotel', icon: '🏨', category: 'Travel', color: '#dc2626', bgColor: '#fee2e2' },
    { title: 'Order Grocery', icon: '🛒', category: 'Shopping', color: '#16a34a', bgColor: '#dcfce7' },
    { title: 'Book Doctor', icon: '👨‍⚕️', category: 'Healthcare', color: '#ef4444', bgColor: '#fecaca' },
    { title: 'Book Salon', icon: '💇‍♀️', category: 'Personal Care', color: '#8b5cf6', bgColor: '#e9d5ff' },
    { title: 'Laundry Service', icon: '👕', category: 'Services', color: '#0ea5e9', bgColor: '#e0f2fe' },
    { title: 'House Cleaning', icon: '🧹', category: 'Services', color: '#10b981', bgColor: '#d1fae5' },
  ];

  const handleServicePress = (service: any) => {
    // Handle service selection
    console.log('Selected service:', service.title);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Space AI Assistant</Text>
        <View style={styles.context}>
          <Text style={styles.contextLabel}>Space: {context.title}</Text>
          <Text style={styles.contextId}>ID: {context.id}</Text>
        </View>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Available Services</Text>
        
        <View style={styles.servicesGrid}>
          {spaceServices.map((service, index) => (
            <TouchableOpacity
              key={index}
              style={styles.serviceCard}
              onPress={() => handleServicePress(service)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: service.bgColor }]}>
                <Text style={styles.emojiIcon}>{service.icon}</Text>
              </View>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceCategory}>{service.category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  context: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  contextId: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emojiIcon: {
    fontSize: 28,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  serviceCategory: {
    fontSize: 12,
    color: '#64748b',
  },
});
