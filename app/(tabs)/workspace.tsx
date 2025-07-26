import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { useModule } from '../../context/ModuleContext';
import { Feather } from '@expo/vector-icons';
import { id } from '@instantdb/react-native';
import { db } from '../../lib/db';
import { router, useLocalSearchParams } from 'expo-router';

import { parseDeepLinkParams, generateDeepLink } from '../../utils/deepLinking';

interface Space {
  id: string;
  title?: string;
}

interface Sale {
  id: string;
  title?: string;
}

interface Product {
  id: string;
  title?: string;
}

interface Item {
  id: string;
  titles?: string;
}

export default function Workspace() {
  const { selectedModule, setPageProp, setSelectedModule } = useModule();
  const searchParams = useLocalSearchParams();
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSaleTitle, setNewSaleTitle] = useState('');
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');

  // Handle deep link parameters
  useEffect(() => {
    const deepLinkParams = parseDeepLinkParams(searchParams);
    
    if (deepLinkParams.module && deepLinkParams.module !== selectedModule) {
      setSelectedModule(deepLinkParams.module);
    }
    
    if (deepLinkParams.item && deepLinkParams.id) {
      setPageProp({ title: deepLinkParams.item, id: deepLinkParams.id });
    }
  }, [searchParams, selectedModule, setSelectedModule, setPageProp]);

  // Query all data from InstantDB
  const { data, isLoading, error } = db.useQuery({
    spaces: {},
    sales: {},
    products: {},
    items: {},
  });

  const spaces = data?.spaces || [];
  const sales = data?.sales || [];
  const products = data?.products || [];
  const items = data?.items || [];

  const handleItemPress = (title: string, id: string) => {
    setPageProp({ title, id });
    router.push('/ai');
  };



  const addSpace = async () => {
    if (!newSpaceTitle.trim()) {
      Alert.alert('Error', 'Please enter a space title');
      return;
    }

    try {
      await db.transact([
        db.tx.spaces[id()].update({
          title: newSpaceTitle.trim(),
        }),
      ]);
      setNewSpaceTitle('');
    } catch (err) {
      Alert.alert('Error', 'Failed to add space');
      console.error('Error adding space:', err);
    }
  };

  // Sales functions
  const addSale = async () => {
    if (!newSaleTitle.trim()) {
      Alert.alert('Error', 'Please enter a sale title');
      return;
    }

    try {
      await db.transact([
        db.tx.sales[id()].update({
          title: newSaleTitle.trim(),
        }),
      ]);
      setNewSaleTitle('');
    } catch (err) {
      Alert.alert('Error', 'Failed to add sale');
      console.error('Error adding sale:', err);
    }
  };

  // Products functions
  const addProduct = async () => {
    if (!newProductTitle.trim()) {
      Alert.alert('Error', 'Please enter a product title');
      return;
    }

    try {
      await db.transact([
        db.tx.products[id()].update({
          title: newProductTitle.trim(),
        }),
      ]);
      setNewProductTitle('');
    } catch (err) {
      Alert.alert('Error', 'Failed to add product');
      console.error('Error adding product:', err);
    }
  };

  // Items functions
  const addItem = async () => {
    if (!newItemTitle.trim()) {
      Alert.alert('Error', 'Please enter an item title');
      return;
    }

    try {
      await db.transact([
        db.tx.items[id()].update({
          titles: newItemTitle.trim(),
        }),
      ]);
      setNewItemTitle('');
    } catch (err) {
      Alert.alert('Error', 'Failed to add item');
      console.error('Error adding item:', err);
    }
  };

  const renderSpace = ({ item }: { item: Space }) => (
    <View style={styles.listItem}>
      <View style={styles.itemContent}>
        <Feather name="home" size={20} color="#2563eb" />
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
      </View>
      <TouchableOpacity
        style={styles.arrowButton}
        onPress={() => handleItemPress(item.title || 'Untitled', item.id)}
      >
        <Feather name="chevron-right" size={16} color="#999" />
      </TouchableOpacity>
    </View>
  );

  const renderSale = ({ item }: { item: Sale }) => (
    <View style={styles.listItem}>
      <View style={styles.itemContent}>
        <Feather name="tag" size={20} color="#dc2626" />
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
      </View>
      <TouchableOpacity
        style={styles.arrowButton}
        onPress={() => handleItemPress(item.title || 'Untitled', item.id)}
      >
        <Feather name="chevron-right" size={16} color="#999" />
      </TouchableOpacity>
    </View>
  );

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.listItem}>
      <View style={styles.itemContent}>
        <Feather name="package" size={20} color="#16a34a" />
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
      </View>
      <TouchableOpacity
        style={styles.arrowButton}
        onPress={() => handleItemPress(item.title || 'Untitled', item.id)}
      >
        <Feather name="chevron-right" size={16} color="#999" />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.listItem}>
      <View style={styles.itemContent}>
        <Feather name="grid" size={20} color="#7c3aed" />
        <Text style={styles.itemTitle}>{item.titles || 'Untitled'}</Text>
      </View>
      <TouchableOpacity
        style={styles.arrowButton}
        onPress={() => handleItemPress(item.titles || 'Untitled', item.id)}
      >
        <Feather name="chevron-right" size={16} color="#999" />
      </TouchableOpacity>
    </View>
  );

  if (!selectedModule) {
    return (
      <View style={styles.container}>
        <Feather name="layers" size={48} color="#cbd5e1" />
        <Text style={styles.title}>Select a Module</Text>
        <Text style={styles.subtitle}>Tap "Space" in the header to choose a module</Text>
      </View>
    );
  }

  // Handle loading and error states
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading data</Text>
      </View>
    );
  }

  // Show spaces list when space module is selected
  if (selectedModule === 'space') {
    return (
      <View style={styles.moduleContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add space..."
            value={newSpaceTitle}
            onChangeText={setNewSpaceTitle}
            onSubmitEditing={addSpace}
          />
        </View>

        <FlatList
          data={spaces}
          renderItem={renderSpace}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No spaces</Text>
          }
        />
      </View>
    );
  }

  // Show sales list when sale module is selected
  if (selectedModule === 'sale') {
    return (
      <View style={styles.moduleContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add sale..."
            value={newSaleTitle}
            onChangeText={setNewSaleTitle}
            onSubmitEditing={addSale}
          />
        </View>

        <FlatList
          data={sales}
          renderItem={renderSale}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No sales</Text>
          }
        />
      </View>
    );
  }

  // Show products list when products module is selected
  if (selectedModule === 'products') {
    return (
      <View style={styles.moduleContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add product..."
            value={newProductTitle}
            onChangeText={setNewProductTitle}
            onSubmitEditing={addProduct}
          />
        </View>

        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No products</Text>
          }
        />
      </View>
    );
  }

  // Show items list when items module is selected
  if (selectedModule === 'items') {
    return (
      <View style={styles.moduleContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add item..."
            value={newItemTitle}
            onChangeText={setNewItemTitle}
            onSubmitEditing={addItem}
          />
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items</Text>
          }
        />
      </View>
    );
  }

  // Show settings when settings module is selected
  if (selectedModule === 'settings') {
    return (
      <View style={styles.settingsContainer}>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsTitle}>Account</Text>
          
          <View style={styles.settingsItem}>
            <View style={styles.settingsItemLeft}>
              <Feather name="info" size={20} color="#6B7280" />
              <Text style={styles.settingsItemText}>App Version</Text>
            </View>
            <Text style={styles.settingsItemValue}>1.0.0</Text>
          </View>
        </View>
      </View>
    );
  }

  // Fallback for unknown modules
  return (
    <View style={styles.container}>
      <Feather name="layers" size={48} color="#cbd5e1" />
      <Text style={styles.title}>Module Not Found</Text>
      <Text style={styles.subtitle}>The selected module is not available</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  moduleContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 18,
    color: '#000',
  },
  listItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  arrowButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 50,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 50,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 50,
  },
  settingsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  settingsSection: {
    backgroundColor: '#ffffff',
    marginTop: 20,
    marginHorizontal: 16,
  },
  settingsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsItemText: {
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
  },
  settingsItemValue: {
    fontSize: 14,
    color: '#6b7280',
  },
});