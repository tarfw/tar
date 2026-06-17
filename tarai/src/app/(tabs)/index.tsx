import { View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
