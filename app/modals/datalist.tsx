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

interface DataListProps {
  visible: boolean;
  onClose: () => void;
  selectedAgent: { id: string; name: string; icon: string; data: string[] };
}

const DataList: React.FC<DataListProps> = ({
  visible,
  onClose,
  selectedAgent,
}) => {
  return (
    <Modal visible={visible} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={onClose}>
      <View style={styles.fullscreenContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{selectedAgent.name} Data</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {selectedAgent.data.map((item, index) => (
            <View key={index} style={styles.dataItem}>
              <Text style={styles.dataText}>{item}</Text>
            </View>
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
    top: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
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
  dataItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dataText: {
    fontSize: 16,
    color: '#1f2937',
  },
});

export default DataList;
