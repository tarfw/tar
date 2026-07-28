import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const ADS = [
  {
    title: 'Neon · Serverless Postgres in seconds',
    url: 'https://neon.tech',
    logoUri: 'https://neon.tech/favicon/favicon.png',
    accentColor: '#00e599',
    fallbackLetter: 'N',
  },
  {
    title: 'Vercel · Deploy frontend apps instantly',
    url: 'https://vercel.com',
    logoUri: 'https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico',
    accentColor: '#000000',
    fallbackLetter: '▲',
  },
  {
    title: 'Railway · Ship apps faster with ease',
    url: 'https://railway.com',
    logoUri: 'https://railway.com/favicon.ico',
    accentColor: '#a855f7',
    fallbackLetter: 'R',
  },
];

function AdLogo({ logoUri, accentColor, fallbackLetter, onError }: { logoUri: string; accentColor: string; fallbackLetter: string; onError: () => void }) {
  return (
    <Image
      source={{ uri: logoUri }}
      style={styles.logoImage}
      onError={onError}
      resizeMode="contain"
    />
  );
}

function AdFallback({ accentColor, fallbackLetter }: { accentColor: string; fallbackLetter: string }) {
  return (
    <View style={[styles.vectorBox, { backgroundColor: accentColor }]}>
      <View style={styles.innerBorder}>
        <Text style={styles.fallbackText}>{fallbackLetter}</Text>
      </View>
    </View>
  );
}

export default function AdBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const ad = ADS[currentIndex];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ADS.length);
      setImageError(false);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(ad.url);
      if (supported) {
        await Linking.openURL(ad.url);
      } else {
        Alert.alert(ad.title, ad.url);
      }
    } catch {
      Alert.alert(ad.title, ad.url);
    }
  }, [ad.url, ad.title]);

  return (
    <Pressable
      style={({ pressed }) => [styles.bannerContainer, pressed && { opacity: 0.95 }]}
      onPress={handleOpen}
    >
      {/* Official Logo */}
      <View style={styles.logoWrapper}>
        {imageError ? (
          <AdFallback accentColor={ad.accentColor} fallbackLetter={ad.fallbackLetter} />
        ) : (
          <AdLogo
            logoUri={ad.logoUri}
            accentColor={ad.accentColor}
            fallbackLetter={ad.fallbackLetter}
            onError={() => setImageError(true)}
          />
        )}
      </View>

      {/* Middle Headline Title */}
      <View style={styles.textContent}>
        <Text style={styles.headlineText} numberOfLines={1}>
          {ad.title}
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
  vectorBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#00e599',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  innerBorder: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: '#0f172a',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
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
