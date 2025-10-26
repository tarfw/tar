import Constants from 'expo-constants';

export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL environment variable is not defined',
    );
  }

  return process.env.EXPO_PUBLIC_API_BASE_URL.concat(path);
};
