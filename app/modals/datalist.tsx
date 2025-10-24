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
  selectedAgent: { id: string; name: string; icon: string; data: string[]; fullData?: any[] };
  onItemSelect?: (item: any) => void;
}

const DataList: React.FC<DataListProps> = ({
  visible,
  onClose,
  selectedAgent,
  onItemSelect,
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
          {selectedAgent.id === 'products' ? (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.titleColumn]}>Title</Text>
                <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
                <Text style={[styles.tableHeaderText, styles.typeColumn]}>Type</Text>
                <Text style={[styles.tableHeaderText, styles.vendorColumn]}>Vendor</Text>
              </View>
              {selectedAgent.fullData?.map((product, index) => (
                <TouchableOpacity
                  key={product.id || index}
                  style={styles.tableRow}
                  onPress={() => {
                    onItemSelect?.(product);
                    onClose();
                  }}
                >
                  <Text style={[styles.tableCellText, styles.titleColumn]}>{product.title || 'Unnamed'}</Text>
                  <Text style={[styles.tableCellText, styles.statusColumn]}>{product.status || '-'}</Text>
                  <Text style={[styles.tableCellText, styles.typeColumn]}>{product.type || '-'}</Text>
                  <Text style={[styles.tableCellText, styles.vendorColumn]}>{product.vendor || '-'}</Text>
                </TouchableOpacity>
              )) || <Text style={styles.noDataText}>No products found</Text>}
            </View>
          ) : (
            selectedAgent.data.map((item, index) => (
              <TouchableOpacity key={index} style={styles.dataItem} onPress={() => onItemSelect?.(item)}>
                <Text style={styles.dataText}>{item}</Text>
              </TouchableOpacity>
            ))
          )}
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
  tableContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: 'white',
  },
  tableCellText: {
    fontSize: 14,
    color: '#1f2937',
  },
  titleColumn: {
    flex: 2,
  },
  statusColumn: {
    flex: 1,
  },
  typeColumn: {
    flex: 1,
  },
  vendorColumn: {
    flex: 1,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    paddingVertical: 20,
  },
});

export default DataList;
