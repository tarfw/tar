import { View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export default function PosScreen() {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
