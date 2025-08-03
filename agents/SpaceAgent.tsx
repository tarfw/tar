import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  context: {
    title: string;
    id: string;
  };
}

export default function SpaceAgent({ context }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Space AI Assistant</Text>
        <View style={styles.context}>
          <Text style={styles.contextLabel}>Space: {context.title}</Text>
          <Text style={styles.contextId}>ID: {context.id}</Text>
        </View>
      </View>
      
      {/* Add your Space-specific AI interface here */}
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  context: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  contextId: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
});
