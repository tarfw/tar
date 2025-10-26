import Constants from 'expo-constants';

export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  // Use Cloudflare API
  return 'https://chat-api-worker.tar-54d.workers.dev'.concat(path);
};
