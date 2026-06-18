import { View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export default function ExploreScreen() {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
