import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function Agents() {
  const [isAgentSelectorVisible, setIsAgentSelectorVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('Products');
  const [searchText, setSearchText] = useState('');

  const agents = [
    { id: 'orders', name: 'Orders', icon: '🛒' },
    { id: 'products', name: 'Products', icon: '🛍️' },
    { id: 'items', name: 'Items', icon: '📦' },
    { id: 'stores', name: 'Stores', icon: '🎈' },
    { id: 'files', name: 'Files', icon: '📁' },
  ];

  const handleAgentSelect = (agent: any) => {
    setSelectedAgent(agent.name);
    setIsAgentSelectorVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text>Agents Screen</Text>
      </View>

      {/* AI Chat Input Container */}
      <View style={styles.inputBarContainer}>
        {/* Agent Selector */}
        <View style={styles.agentSelectorInContainer}>
          <TouchableOpacity
          style={styles.agentSelector}
          onPress={() => setIsAgentSelectorVisible(true)}
          >
          <Text style={styles.agentText}>{agents.find(a => a.name === selectedAgent)?.icon}</Text>
          </TouchableOpacity>
        </View>

        {/* AI Chat Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.iconButton}>
            <View style={styles.attachIcon}>
              <MaterialIcons name="add" size={20} color="#6b7280" />
            </View>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Ask anything"
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="mic" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="graphic-eq" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Agent Selector Modal */}
      <Modal
        visible={isAgentSelectorVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsAgentSelectorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search agents..."
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
            />
            <MaterialIcons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          </View>

          <FlatList
            data={agents.filter(agent => agent.name.toLowerCase().includes(searchText.toLowerCase()))}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.agentItem}
                onPress={() => handleAgentSelect(item)}
              >
                <Text style={styles.emojiIcon}>{item.icon}</Text>
                <Text style={styles.agentItemText}>{item.name}</Text>
                {selectedAgent === item.name && (
                  <MaterialIcons name="check" size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb', // Light grey fill
    borderWidth: 1,
    borderColor: '#e5e7eb', // Slightly darker grey border
    borderRadius: 25, // Fully rounded for pill shape
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  attachIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 8,
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  agentSelectorInContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  agentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  agentText: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginVertical: 16,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 8,
  },
  searchIcon: {
    marginLeft: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emojiIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  agentItemText: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 16,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
  },
});
