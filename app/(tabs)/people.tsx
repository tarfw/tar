import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import db from '../../db';

type Task = {
  id: string;
  title: string;
  subtitle: string;
  isUnread: boolean;
  avatarInitial: string;
};

const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Optimize model loading',
    subtitle: 'Kristin assigned to you · 2h ago',
    isUnread: true,
    avatarInitial: 'K',
  },
  {
    id: '2',
    title: 'Update user interface',
    subtitle: 'Alex commented · 4h ago',
    isUnread: true,
    avatarInitial: 'A',
  },
  {
    id: '3',
    title: 'Fix authentication bug',
    subtitle: 'Jordan assigned to you · 1d ago',
    isUnread: false,
    avatarInitial: 'J',
  },
  {
    id: '4',
    title: 'Add new feature',
    subtitle: 'Sam assigned to you · 2d ago',
    isUnread: false,
    avatarInitial: 'S',
  },
];

const tabs = ['Unread', 'All', 'Archived'];

export default function People() {
  const [activeTab, setActiveTab] = useState('Unread');
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  const user = db.useUser();

  const handleSignOut = () => {
    db.auth.signOut();
    setIsDrawerVisible(false);
  };

  const filteredTasks = sampleTasks.filter((task) => {
    if (activeTab === 'Unread') return task.isUnread;
    if (activeTab === 'Archived') return !task.isUnread;
    return true;
  });

  const renderTask = ({ item }: { item: Task }) => (
    <View style={styles.taskItem}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.avatarInitial}</Text>
        </View>
        {item.isUnread && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.taskContent}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <Text style={styles.taskSubtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  const renderTab = (tab: string) => (
    <TouchableOpacity
      key={tab}
      style={styles.tab}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {tab}
      </Text>
      {activeTab === tab && <View style={styles.tabUnderline} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
        <TouchableOpacity onPress={() => setIsDrawerVisible(true)}>
          <MaterialIcons name="more-vert" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        {tabs.map(renderTab)}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={isDrawerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsDrawerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDrawerVisible(false)}
        >
          <View style={styles.drawer}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Signout</Text>
            </TouchableOpacity>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tab: {
    marginRight: 24,
    paddingBottom: 8,
  },
  tabText: {
    fontSize: 16,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  tabUnderline: {
    height: 2,
    backgroundColor: '#6366f1',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  taskSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 52, // Align with task content
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    backgroundColor: '#ffffff',
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingTop: 60, // Extra top padding for status bar
    alignItems: 'flex-end',
  },
  signOutButton: {
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  emailText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
