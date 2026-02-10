import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AgentsScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Agents</Text>
            <Text style={styles.subtitle}>Primary Interface</Text>

            <TouchableOpacity
                style={styles.searchButton}
                onPress={() => router.push('/search')}
            >
                <Text style={styles.searchButtonText}>Try Semantic Search</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.searchButton, styles.addButton]}
                onPress={() => router.push('/add-node')}
            >
                <Text style={styles.searchButtonText}>Add New Node Data</Text>
            </TouchableOpacity>
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
    searchButton: {
        backgroundColor: '#006AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        marginBottom: 12,
        width: '80%',
        alignItems: 'center',
    },
    addButton: {
        backgroundColor: '#34C759', // Green for adding
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
