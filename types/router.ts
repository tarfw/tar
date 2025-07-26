// Expo Router route parameter types
export type RootStackParamList = {
  '/(tabs)/workspace': undefined;
  '/(tabs)/ai': undefined;
  '/(tabs)/tasks': undefined;
  '/(tabs)/people': undefined;
  '/(auth)/login': undefined;
  '/+not-found': undefined;
};

// Extend Expo Router's global types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Export typed navigation hooks for better TypeScript support
import { useRouter as useExpoRouter, useLocalSearchParams as useExpoLocalSearchParams } from 'expo-router';

export const useRouter = useExpoRouter;
export const useLocalSearchParams = useExpoLocalSearchParams;