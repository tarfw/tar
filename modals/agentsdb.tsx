import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AgentsDbProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (agentId: string) => void;
  agents: Array<{ id: string; name: string; icon: string; data: string[] }>;
  selectedAgentId: string;
}

const AgentsDb: React.FC<AgentsDbProps> = ({
  visible,
  onClose,
  onSelect,
  agents,
  selectedAgentId,
}) => {
  const handleSelect = (agentId: string) => {
    onSelect(agentId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullscreenContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Agent</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {agents.map((agent) => (
            <TouchableOpacity
              key={agent.id}
              style={styles.agentItem}
              onPress={() => handleSelect(agent.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.agentIcon}>{agent.icon}</Text>
              <Text style={styles.agentName}>{agent.name}</Text>
              {selectedAgentId === agent.id && (
                <MaterialIcons name="check-circle" size={20} color="#6366f1" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  agentIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  agentName: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
});

export default AgentsDb;
