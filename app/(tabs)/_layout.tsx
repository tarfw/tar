import React from 'react';
import { Tabs } from 'expo-router';
import { TouchableWithoutFeedback, View } from 'react-native';
import { Feather, AntDesign, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from '../../components/CustomHeader';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6b7280',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0.3,
          borderTopColor: '#f5f5f5',
          paddingBottom: insets.bottom,
          paddingTop: 8,
          height: 60 + insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarButton: (props) => (
          <TouchableWithoutFeedback onPress={props.onPress}>
            <View style={props.style}>
              {props.children}
            </View>
          </TouchableWithoutFeedback>
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        header: ({ route }) => <CustomHeader title={route.name} />,
      }}
    >
      <Tabs.Screen
        name="workspace"
        options={{
          title: 'Workspace',
          tabBarIcon: ({ focused }) => (
            <Feather
              name="circle"
              size={24}
              color={focused ? '#2563eb' : '#6b7280'}
            />
          ),
          tabBarActiveTintColor: '#2563eb',
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => (
            <AntDesign
              name="codesquareo"
              size={24}
              color={focused ? '#9333ea' : '#6b7280'}
            />
          ),
          tabBarActiveTintColor: '#9333ea',
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="play-outline"
              size={24}
              color={focused ? '#16a34a' : '#6b7280'}
            />
          ),
          tabBarActiveTintColor: '#16a34a',
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name="alternate-email"
              size={24}
              color={focused ? '#ea580c' : '#6b7280'}
            />
          ),
          tabBarActiveTintColor: '#ea580c',
        }}
      />
    </Tabs>
  );
}