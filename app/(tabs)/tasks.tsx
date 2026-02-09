import { StyleSheet, Text, View } from 'react-native';

export default function TasksScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Tasks</Text>
            <Text style={styles.subtitle}>Manage your workflow</Text>
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
