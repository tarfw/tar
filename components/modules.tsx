import React from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ModulesModalProps {
  visible: boolean;
  onClose: () => void;
  onModuleSelect: (moduleId: string) => void;
}

const modules = [
  { id: 'space', title: 'Space', icon: 'home', emoji: '🌌' },
  { id: 'sale', title: 'Sale', icon: 'tag' },
  { id: 'items', title: 'Items', icon: 'grid' },
  { id: 'settings', title: 'Settings', icon: 'settings' },
];

export default function ModulesModal({ visible, onClose, onModuleSelect }: ModulesModalProps) {
  const handleModulePress = (moduleId: string) => {
    onModuleSelect(moduleId);
    onClose();
  };

  const renderItem = ({ item }: { item: typeof modules[0] }) => (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => handleModulePress(item.id)}
    >
      {item.emoji ? (
        <Text style={styles.emojiIcon}>{item.emoji}</Text>
      ) : (
        <Feather name={item.icon as any} size={24} color="#6b7280" />
      )}
      <Text style={styles.itemText}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Modules</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={modules}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    marginLeft: 12,
  },
  emojiIcon: {
    fontSize: 24,
  },
});