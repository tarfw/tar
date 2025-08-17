import 'dotenv/config';

export default {
  expo: {
    name: 'tar',
    slug: 'tar',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'com.tarfw.tar',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission: 'The app accesses your photos to let you share them with others.',
          cameraPermission: 'The app accesses your camera to let you take photos.',
        },
      ],
    ],
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
        projectId: "92518f31-13c3-4b86-acc3-90019ce18133"
      },
    },
  },
};
