import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useModule } from '../../context/ModuleContext';
import { parseDeepLinkParams } from '../../utils/deepLinking';

// Import all agents
import ProductsAgent from '../../agents/ProductsAgent';
import SalesAgent from '../../agents/SalesAgent';
import SpaceAgent from '../../agents/SpaceAgent';
import ItemsAgent from '../../agents/ItemsAgent';

export default function AI() {
  const { pageProp, setPageProp, selectedModule } = useModule();
  const searchParams = useLocalSearchParams();

  // Handle deep link parameters
  useEffect(() => {
    const deepLinkParams = parseDeepLinkParams(searchParams);

    if (deepLinkParams.item && deepLinkParams.id) {
      setPageProp({ title: deepLinkParams.item, id: deepLinkParams.id });
    }
  }, [searchParams, setPageProp]);

  // Render the appropriate agent based on the selected module
  const renderAgent = () => {
    if (!selectedModule || !pageProp) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Select an item from workspace to start</Text>
        </View>
      );
    }

    switch (selectedModule) {
      case 'products':
        return <ProductsAgent context={pageProp} />;
      case 'sale':
        return <SalesAgent context={pageProp} />;
      case 'space':
        return <SpaceAgent context={pageProp} />;
      case 'items':
        return <ItemsAgent context={pageProp} />;
      default:
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No agent available for this module</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderAgent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});
