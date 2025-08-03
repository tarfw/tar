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
import ProductsAgent from '../../agents/ProductsAgent';

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

interface WorkspaceService {
  id: string;
  title?: string;
  icon?: string;
  category?: string;
}

export default function Workspace() {
  const { selectedModule, setPageProp, setSelectedModule } = useModule();
  const searchParams = useLocalSearchParams();
  const [saleSearchQuery, setSaleSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [newServiceTitle, setNewServiceTitle] = useState('');

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

  // Query data from InstantDB (excluding workspaceServices which are static)
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

  // Search query for filtering services
  const [searchQuery, setSearchQuery] = useState('');

  const handleItemPress = (title: string, id: string) => {
    setPageProp({ title, id });
    router.push('/ai');
  };

  // Predefined workspace services
  const predefinedServices = [
    { title: 'Book Taxi', icon: 'navigation', category: 'Transportation' },
    { title: 'Book Auto', icon: 'truck', category: 'Transportation' },
    { title: 'Order Food', icon: 'coffee', category: 'Food & Dining' },
    { title: 'Book Bus', icon: 'navigation-2', category: 'Transportation' },
    { title: 'Book Cinema', icon: 'film', category: 'Entertainment' },
    { title: 'Book Hotel', icon: 'home', category: 'Travel' },
    { title: 'Book Flight', icon: 'send', category: 'Travel' },
    { title: 'Order Grocery', icon: 'shopping-bag', category: 'Shopping' },
    { title: 'Book Doctor', icon: 'heart', category: 'Healthcare' },
    { title: 'Book Salon', icon: 'scissors', category: 'Personal Care' },
    { title: 'Laundry Service', icon: 'droplet', category: 'Services' },
    { title: 'House Cleaning', icon: 'home', category: 'Services' },
  ];

  // Filter services based on search query
  const filteredServices = predefinedServices.filter(service =>
    service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );



  // Filter functions for search
  const filteredSales = sales.filter(sale =>
    (sale.title || '').toLowerCase().includes(saleSearchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    (product.title || '').toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const filteredItems = items.filter(item =>
    (item.titles || '').toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  const renderSpace = ({ item }: { item: Space }) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleItemPress(item.title || 'Untitled', item.id)}
    >
      <View style={styles.itemContent}>
        <Feather name="home" size={20} color="#2563eb" />
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSale = ({ item }: { item: Sale }) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleItemPress(item.title || 'Untitled', item.id)}
    >
      <View style={styles.itemContent}>
        <Feather name="tag" size={20} color="#dc2626" />
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleItemPress(item.title || 'Untitled', item.id)}
    >
      <View style={styles.itemContent}>
        <Feather name="package" size={20} color="#16a34a" />
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleItemPress(item.titles || 'Untitled', item.id)}
    >
      <View style={styles.itemContent}>
        <Feather name="grid" size={20} color="#7c3aed" />
        <Text style={styles.itemTitle}>{item.titles || 'Untitled'}</Text>
      </View>
    </TouchableOpacity>
  );



  const renderPredefinedService = (service: { title: string; icon: string; category: string }, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.serviceListItem}
      onPress={() => handleItemPress(service.title, `predefined-${index}`)}
    >
      <View style={styles.itemContent}>
        <Feather name={service.icon as any} size={20} color="#000000" />
        <Text style={styles.serviceTitle}>{service.title}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="#999" />
    </TouchableOpacity>
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

  // Show workspace services when space module is selected
  if (selectedModule === 'space') {
    return (
      <View style={styles.moduleContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search services..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* All Services */}
          <View style={styles.servicesContainer}>
            {filteredServices.map((service, index) =>
              renderPredefinedService(service, index)
            )}
            {filteredServices.length === 0 && searchQuery.length > 0 && (
              <Text style={styles.noResultsText}>No services found for "{searchQuery}"</Text>
            )}
          </View>
        </ScrollView>
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
            placeholder="Search sales..."
            value={saleSearchQuery}
            onChangeText={setSaleSearchQuery}
          />
        </View>

        <FlatList
          data={filteredSales}
          renderItem={renderSale}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {saleSearchQuery.length > 0 
                ? `No sales found for "${saleSearchQuery}"`
                : 'No sales'}
            </Text>
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
            placeholder="Search products..."
            value={productSearchQuery}
            onChangeText={setProductSearchQuery}
          />
        </View>

        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {productSearchQuery.length > 0 
                ? `No products found for "${productSearchQuery}"`
                : 'No products'}
            </Text>
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
            placeholder="Search items..."
            value={itemSearchQuery}
            onChangeText={setItemSearchQuery}
          />
        </View>

        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {itemSearchQuery.length > 0 
                ? `No items found for "${itemSearchQuery}"`
                : 'No items'}
            </Text>
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
  section: {
    marginBottom: 24,
  },
  serviceTitle: {
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
    flex: 1,
  },
  servicesContainer: {
    backgroundColor: '#ffffff',
  },
  serviceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  noResultsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginTop: 32,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
});