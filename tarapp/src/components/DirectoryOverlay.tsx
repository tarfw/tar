import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DirectorySection from '@/components/DirectorySection';

interface DirectoryOverlayProps {
  visible: boolean;
  onClose: () => void;
  entities: any[];
  theme: any;
  onSelectEntity: (entity: any) => void;
  onAddNewEntity: (category: 'people' | 'companies' | 'items') => void;
}

export default function DirectoryOverlay({
  visible,
  onClose,
  entities,
  theme,
  onSelectEntity,
  onAddNewEntity,
}: DirectoryOverlayProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.panel, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]} onPress={() => {}}>
        <DirectorySection
          entities={entities}
          theme={theme}
          onSelectEntity={onSelectEntity}
          onAddNewEntity={onAddNewEntity}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
