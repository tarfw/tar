import { Redirect, useLocalSearchParams } from 'expo-router';

export default function WorkspaceRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(tabs)/workspaces', params }} />;
}
