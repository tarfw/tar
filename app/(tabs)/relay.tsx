import { StyleSheet, Text, View } from 'react-native';

export default function RelayScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Relay</Text>
            <Text style={styles.subtitle}>System synchronization</Text>
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
    },
});
