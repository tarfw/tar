import { useColorScheme } from 'nativewind';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../hooks/use-theme-colors';

export default function RelayScreen() {
    const colors = useThemeColors();
    const { colorScheme } = useColorScheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>Relay</Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>System synchronization</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        marginTop: 8,
    },
});
