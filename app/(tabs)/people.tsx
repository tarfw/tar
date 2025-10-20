import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import db from '../../db';

export default function People() {
  const user = db.useUser();

  const handleSignOut = () => {
    db.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>People</Text>
      <View style={styles.userContainer}>
        <Text style={styles.userText}>Hello {user?.email}!</Text>
        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  userContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userText: {
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

