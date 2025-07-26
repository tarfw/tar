import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { ModuleProvider } from '../context/ModuleContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ModuleProvider>
        <Slot />
        <StatusBar style="auto" />
      </ModuleProvider>
    </SafeAreaProvider>
  );
}