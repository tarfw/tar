import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function AgentsScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            {/* Content for Agents screen */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 8,
        marginBottom: 30,
    },
});
