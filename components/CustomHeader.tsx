import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import ModulesModal from './modules';
import { useModule } from '../context/ModuleContext';

interface CustomHeaderProps {
  title: string;
}

const modules = {
  spaces: { title: 'Spaces', icon: '🌟' },
  space: { title: 'Space', icon: 'home' },
  sale: { title: 'Sale', icon: 'tag' },
  products: { title: 'Products', icon: 'package' },
  items: { title: 'Items', icon: 'grid' },
  settings: { title: 'Settings', icon: 'settings' },
};

export default function CustomHeader({ title }: CustomHeaderProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { selectedModule, setSelectedModule, pageProp, setPageProp } = useModule();

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId);
    setPageProp(null); // Clear any selected item when switching modules
    router.push('/workspace');
  };

  const currentModule = selectedModule ? modules[selectedModule as keyof typeof modules] : null;

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.leftContent}>
          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            style={styles.moduleButton}
          >
            {currentModule ? (
              currentModule.icon === '🌟' ? (
                <Text style={styles.emojiIcon}>🌟</Text>
              ) : currentModule.icon === 'home' ? (
                <Text style={styles.emojiIcon}>🌌</Text>
              ) : (
                <Feather name={currentModule.icon as any} size={20} color="#1e293b" />
              )
            ) : (
              <Text style={styles.emojiIcon}>🌟</Text>
            )}
          </TouchableOpacity>
          
          {pageProp && (
            <View style={styles.pagePropContainer}>
              <Text style={styles.pagePropTitle}>{pageProp.title}</Text>
              <Text style={styles.pagePropId}>{pageProp.id}</Text>
            </View>
          )}
        </View>
      </View>
      
      <ModulesModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        onModuleSelect={handleModuleSelect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emojiIcon: {
    fontSize: 20,
  },
  pagePropContainer: {
    marginLeft: 16,
    alignItems: 'flex-start',
  },
  pagePropTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  pagePropId: {
    fontSize: 10,
    fontWeight: '400',
    color: '#6b7280',
  },
});