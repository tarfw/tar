import React from 'react';
import { Text, View, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function Workspace() {
  const router = useRouter();

  const projects = [
    {
      id: 'food-order',
      name: 'Food Order',
      tasks: [
        { id: 1, title: 'Confirm order', status: 'completed', progress: 100 },
        { id: 2, title: 'Pick up order', status: 'in-progress', progress: 50 },
        { id: 3, title: 'Deliver order', status: 'pending', progress: 0 },
      ],
    },
    {
      id: 'website-redesign',
      name: 'Website Redesign',
      tasks: [
        { id: 4, title: 'Design homepage layout', status: 'completed', progress: 100 },
        { id: 5, title: 'User research analysis', status: 'in-progress', progress: 75 },
        { id: 6, title: 'Implement responsive design', status: 'pending', progress: 0 },
      ],
    },
    {
      id: 'marketing-campaign',
      name: 'Marketing Campaign',
      tasks: [
        { id: 7, title: 'Create campaign strategy', status: 'completed', progress: 100 },
        { id: 8, title: 'Design social media assets', status: 'in-progress', progress: 60 },
        { id: 9, title: 'Launch campaign', status: 'pending', progress: 0 },
      ],
    },
  ];

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in-progress': return '#f59e0b';
      default: return '#d1d5db';
    }
  };

  const renderTaskRow = (task: any) => (
    <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: getProgressColor(task.status), justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
      </View>
      <Text style={{ fontSize: 18, color: task.status === 'completed' ? '#9ca3af' : '#374151' }}>{task.title}</Text>
    </View>
  );

  const renderProject = (project: any) => {
    return (
      <View key={project.id} style={{ marginBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>{project.name}</Text>
        </View>
        {project.tasks.map(renderTaskRow)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workspace</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/people')}>
            <MaterialIcons name="inbox" size={24} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/agents')}>
            <Text style={{ fontSize: 24 }}>🎮</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroHeaderLeft}>
              <View style={styles.heroDot} />
              <Text style={styles.heroTagline}>CURRENT TASK</Text>
            </View>
            <Text style={styles.heroCtaText}>TRACK ORDER</Text>
          </View>

          <View style={styles.heroIllustration}>
            <View style={styles.heroIcon}>
              <View style={styles.heroWheelLeft} />
              <View style={styles.heroWheelRight} />
              <View style={styles.heroBikeFrame} />
              <View style={styles.heroHandlebar} />
            </View>
          </View>

          <View style={styles.heroSpacer} />

          <View style={styles.heroContent}>
            <Text style={styles.heroHeadline}>Deliver order #4832 to 52 Market Street.</Text>
            <Text style={styles.heroSupportText}>Rider Ava Chen is 0.8 mi away • ETA 12:42 PM</Text>
            <TouchableOpacity activeOpacity={0.8} style={styles.heroButton}>
              <Text style={styles.heroButtonText}>START DELIVERY →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Task Projects */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {projects.map(renderProject)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  heroCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 28,
    paddingHorizontal: 32,
    height: Dimensions.get('window').height * 0.65,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
  },
  heroTagline: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#6b7280',
    fontWeight: '600',
  },
  heroCtaText: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#1f2937',
    fontWeight: '600',
  },
  heroIllustration: {
    marginTop: 28,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroWheelLeft: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },
  heroWheelRight: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },
  heroBikeFrame: {
    position: 'absolute',
    width: 36,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
    bottom: 24,
  },
  heroHandlebar: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 18,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f97316',
  },
  heroSpacer: {
    flex: 1,
    minHeight: 80,
  },
  heroContent: {
    alignItems: 'flex-start',
  },
  heroHeadline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  heroSupportText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 20,
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
