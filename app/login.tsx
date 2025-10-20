import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import db from '../db';

export default function Login() {
  const [sentEmail, setSentEmail] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {!sentEmail ? (
          <EmailStep onSendEmail={setSentEmail} />
        ) : (
          <CodeStep sentEmail={sentEmail} onReset={() => setSentEmail('')} />
        )}
      </View>
    </View>
  );
}

function EmailStep({ onSendEmail }: { onSendEmail: (email: string) => void }) {
  const inputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');

  const handleSendCode = () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    onSendEmail(email);
    db.auth.sendMagicCode({ email }).catch((err) => {
      Alert.alert('Error', 'Uh oh: ' + (err.body?.message || err.message));
      onSendEmail('');
    });
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Let's log you in</Text>
      <Text style={styles.description}>
        Enter your email, and we'll send you a verification code. We'll create
        an account for you too if you don't already have one.
      </Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleSendCode}>
        <Text style={styles.buttonText}>Send Code</Text>
      </TouchableOpacity>
    </View>
  );
}

function CodeStep({ sentEmail, onReset }: { sentEmail: string; onReset: () => void }) {
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');

  const handleVerifyCode = () => {
    if (!code) {
      Alert.alert('Error', 'Please enter the code');
      return;
    }
    db.auth.signInWithMagicCode({ email: sentEmail, code }).catch((err) => {
      setCode('');
      Alert.alert('Error', 'Uh oh: ' + (err.body?.message || err.message));
    });
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Enter your code</Text>
      <Text style={styles.description}>
        We sent an email to <Text style={styles.bold}>{sentEmail}</Text>. Check your email, and
        paste the code you see.
      </Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="123456..."
        value={code}
        onChangeText={setCode}
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleVerifyCode}>
        <Text style={styles.buttonText}>Verify Code</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.resetButton} onPress={onReset}>
        <Text style={styles.resetText}>Back to email</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'white',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 400,
  },
  stepContainer: {
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  resetButton: {
    alignItems: 'center',
  },
  resetText: {
    color: '#007AFF',
    fontSize: 16,
  },
  bold: {
    fontWeight: 'bold',
  },
});
