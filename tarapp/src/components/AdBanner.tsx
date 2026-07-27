import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const NEON_LOGO_URI = 'https://neon.tech/favicon/favicon.png';

function NeonLogo() {
  const [imageError, setImageError] = useState(false);

  if (!imageError) {
    return (
      <Image
        source={{ uri: NEON_LOGO_URI }}
        style={styles.logoImage}
        onError={() => setImageError(true)}
        resizeMode="contain"
      />
    );
  }

  // Pixel-perfect vector representation of the Neon logo (Neon Green Square + N symbol)
  return (
    <View style={styles.neonVectorBox}>
      <View style={styles.neonInnerBorder}>
        <Text style={styles.neonNText}>N</Text>
      </View>
    </View>
  );
}

export default function AdBanner() {
  const adUrl = 'https://neon.tech';
  const adTitle = 'Neon · Serverless Postgres in seconds';

  const handleOpen = async () => {
    try {
      const supported = await Linking.canOpenURL(adUrl);
      if (supported) {
        await Linking.openURL(adUrl);
      } else {
        Alert.alert('Neon Postgres', adTitle);
      }
    } catch {
      Alert.alert('Neon Postgres', adTitle);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.bannerContainer, pressed && { opacity: 0.95 }]}
      onPress={handleOpen}
    >
      {/* Official Neon Postgres Logo */}
      <View style={styles.logoWrapper}>
        <NeonLogo />
      </View>

      {/* Middle Headline Title */}
      <View style={styles.textContent}>
        <Text style={styles.headlineText} numberOfLines={1}>
          {adTitle}
        </Text>
      </View>

      {/* External Link Arrow Icon */}
      <View style={styles.actionsRow}>
        <Ionicons name="open-outline" size={15} color="#64748b" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logoWrapper: {
    width: 34,
    height: 34,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  neonVectorBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#00e599',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  neonInnerBorder: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: '#0f172a',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neonNText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: -1,
  },
  textContent: {
    flex: 1,
    marginRight: 8,
  },
  headlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionsRow: {
    paddingLeft: 4,
  },
});
