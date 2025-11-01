import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
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
  <Modal visible={visible} transparent={true} animationType="none" statusBarTranslucent={false} onRequestClose={onClose}>
  <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
  <View style={styles.fullscreenContainer}>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 40,
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  agentIcon: {
    fontSize: 32,
    marginRight: 15,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  agentName: {
    flex: 1,
    fontSize: 28,
    color: '#1f2937',
    fontWeight: '600',
    lineHeight: 36,
  },
});

export default AgentsDb;
