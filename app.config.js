import 'dotenv/config';

export default {
  expo: {
    name: 'tar',
    slug: 'tar',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.tarfw.tar',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      EXPO_PUBLIC_GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY,
      EXPO_PUBLIC_INSTANT_APP_ID: process.env.EXPO_PUBLIC_INSTANT_APP_ID,
      eas: {
        projectId: "60c861b1-14f0-497a-b4d5-b1e162f7c0e7"
      },
    },
  },
};
