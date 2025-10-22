import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SpaceTerminal() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
});
