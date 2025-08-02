// Environment Configuration
// This file centralizes all environment variable access and validation


import Constants from 'expo-constants';

// Ensure GROQ_API_KEY is set for libraries that expect it (e.g., ai-sdk)
if (
  typeof process !== 'undefined' &&
  process.env &&
  !process.env.GROQ_API_KEY &&
  process.env.EXPO_PUBLIC_GROQ_API_KEY
) {
  process.env.GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
}

// Environment variable interface
interface EnvironmentConfig {
  // Database
  EXPO_PUBLIC_INSTANT_APP_ID: string;
  // API Keys
  EXPO_PUBLIC_GROQ_API_KEY: string;

  // Cloudflare R2 Configuration
  EXPO_PUBLIC_R2_ACCOUNT_ID: string;
  EXPO_PUBLIC_R2_ACCESS_KEY_ID: string;
  EXPO_PUBLIC_R2_SECRET_ACCESS_KEY: string;
  EXPO_PUBLIC_R2_BUCKET_NAME: string;
  EXPO_PUBLIC_R2_REGION: string;
  EXPO_PUBLIC_R2_ENDPOINT: string;

  // App Configuration
  NODE_ENV: string;
  IS_DEV: boolean;
}

// Helper function to get environment variable with fallback
function getEnvVar(key: string, fallback?: string): string {
  // For client-side code, Expo requires EXPO_PUBLIC_ prefix
  // Try multiple sources for environment variables
  let value: string | undefined;

  // Try EXPO_PUBLIC_ prefixed version first (for client-side)
  if (process.env[`EXPO_PUBLIC_${key}`]) {
    value = process.env[`EXPO_PUBLIC_${key}`];
  }
  // Try regular version (for server-side)
  else if (process.env[key]) {
    value = process.env[key];
  }
  // Try Constants as fallback
  else if (Constants.expoConfig?.extra?.[key]) {
    value = Constants.expoConfig.extra[key];
  }

  // Validate the value
  if (value && typeof value === 'string' && value.trim() !== '' && !value.includes('your_')) {
    return value;
  }

  if (!fallback) {
    console.warn(`Environment variable ${key} not found and no fallback provided`);
    return '';
  }

  return fallback;
}

// Get environment variables with validation
function createEnvironmentConfig(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    // Database configuration
    EXPO_PUBLIC_INSTANT_APP_ID: getEnvVar('INSTANT_APP_ID'),
    // API Keys
    EXPO_PUBLIC_GROQ_API_KEY: getEnvVar('GROQ_API_KEY'),

    // Cloudflare R2 Configuration
    EXPO_PUBLIC_R2_ACCOUNT_ID: getEnvVar('R2_ACCOUNT_ID'),
    EXPO_PUBLIC_R2_ACCESS_KEY_ID: getEnvVar('R2_ACCESS_KEY_ID'),
    EXPO_PUBLIC_R2_SECRET_ACCESS_KEY: getEnvVar('R2_SECRET_ACCESS_KEY'),
    EXPO_PUBLIC_R2_BUCKET_NAME: getEnvVar('R2_BUCKET_NAME'),
    EXPO_PUBLIC_R2_REGION: getEnvVar('R2_REGION', 'auto'),
    EXPO_PUBLIC_R2_ENDPOINT: getEnvVar('R2_ENDPOINT'),

    // App configuration
    NODE_ENV: getEnvVar('NODE_ENV', 'development'),
    IS_DEV: getEnvVar('NODE_ENV', 'development') === 'development',
  };

  return config;
}

// Create and export the configuration
export const ENV = createEnvironmentConfig();

// Validation function
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required environment variables
  if (!ENV.EXPO_PUBLIC_INSTANT_APP_ID || ENV.EXPO_PUBLIC_INSTANT_APP_ID.includes('your-app-id')) {
    errors.push('EXPO_PUBLIC_INSTANT_APP_ID is missing or invalid');
  }
  if (!ENV.EXPO_PUBLIC_GROQ_API_KEY || ENV.EXPO_PUBLIC_GROQ_API_KEY.includes('your_groq_') || ENV.EXPO_PUBLIC_GROQ_API_KEY.length < 20) {
    errors.push('EXPO_PUBLIC_GROQ_API_KEY is missing or invalid');
  }

  // Check R2 configuration
  if (!ENV.EXPO_PUBLIC_R2_ACCOUNT_ID || ENV.EXPO_PUBLIC_R2_ACCOUNT_ID.length < 10) {
    errors.push('EXPO_PUBLIC_R2_ACCOUNT_ID is missing or invalid');
  }
  if (!ENV.EXPO_PUBLIC_R2_ACCESS_KEY_ID || ENV.EXPO_PUBLIC_R2_ACCESS_KEY_ID.length < 10) {
    errors.push('EXPO_PUBLIC_R2_ACCESS_KEY_ID is missing or invalid');
  }
  if (!ENV.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY || ENV.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY.length < 20) {
    errors.push('EXPO_PUBLIC_R2_SECRET_ACCESS_KEY is missing or invalid');
  }
  if (!ENV.EXPO_PUBLIC_R2_BUCKET_NAME || ENV.EXPO_PUBLIC_R2_BUCKET_NAME.length < 3) {
    errors.push('EXPO_PUBLIC_R2_BUCKET_NAME is missing or invalid');
  }
  if (!ENV.EXPO_PUBLIC_R2_ENDPOINT || !ENV.EXPO_PUBLIC_R2_ENDPOINT.startsWith('https://')) {
    errors.push('EXPO_PUBLIC_R2_ENDPOINT is missing or invalid');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Debug function to log environment status
export function logEnvironmentStatus(): void {
  console.log('Environment Configuration Status:', {
    NODE_ENV: ENV.NODE_ENV,
    IS_DEV: ENV.IS_DEV,
    hasInstantAppId: !!ENV.EXPO_PUBLIC_INSTANT_APP_ID,
    hasGroqApiKey: !!ENV.EXPO_PUBLIC_GROQ_API_KEY,
    groqKeyLength: ENV.EXPO_PUBLIC_GROQ_API_KEY?.length || 0,
    groqKeyStart: ENV.EXPO_PUBLIC_GROQ_API_KEY?.substring(0, 10) || 'undefined',

    // R2 Configuration Status
    r2Config: {
      hasAccountId: !!ENV.EXPO_PUBLIC_R2_ACCOUNT_ID,
      hasAccessKey: !!ENV.EXPO_PUBLIC_R2_ACCESS_KEY_ID,
      hasSecretKey: !!ENV.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY,
      hasBucketName: !!ENV.EXPO_PUBLIC_R2_BUCKET_NAME,
      hasEndpoint: !!ENV.EXPO_PUBLIC_R2_ENDPOINT,
      bucketName: ENV.EXPO_PUBLIC_R2_BUCKET_NAME,
      region: ENV.EXPO_PUBLIC_R2_REGION,
    },

    // Debug: Show what's available in different sources
    processEnv: {
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasExpoPublicGroqKey: !!process.env.EXPO_PUBLIC_GROQ_API_KEY,
      hasInstantAppId: !!process.env.EXPO_PUBLIC_INSTANT_APP_ID,
      hasR2Config: !!process.env.EXPO_PUBLIC_R2_ACCOUNT_ID,
    },
    constants: {
      hasExpoConfig: !!Constants.expoConfig,
      hasManifest2: !!Constants.manifest2,
    }
  });
  
  const validation = validateEnvironment();
  if (!validation.isValid) {
    console.error('Environment validation failed:', validation.errors);
  } else {
    console.log('✅ Environment validation passed');
  }
}

// Export individual getters for convenience
export const getGroqApiKey = (): string => {
  if (!ENV.EXPO_PUBLIC_GROQ_API_KEY || ENV.EXPO_PUBLIC_GROQ_API_KEY.includes('your_groq_') || ENV.EXPO_PUBLIC_GROQ_API_KEY.length < 20) {
    throw new Error('Valid Groq API key not found. Please check your environment configuration.');
  }
  return ENV.EXPO_PUBLIC_GROQ_API_KEY;
};

export const getInstantAppId = (): string => {
  if (!ENV.EXPO_PUBLIC_INSTANT_APP_ID || ENV.EXPO_PUBLIC_INSTANT_APP_ID.includes('your-app-id')) {
    throw new Error('Valid Instant App ID not found. Please check your environment configuration.');
  }
  return ENV.EXPO_PUBLIC_INSTANT_APP_ID;
};

// R2 Configuration getters
export const getR2Config = () => {
  const validation = validateEnvironment();
  if (!validation.isValid) {
    throw new Error(`R2 configuration invalid: ${validation.errors.join(', ')}`);
  }

  return {
    accountId: ENV.EXPO_PUBLIC_R2_ACCOUNT_ID,
    accessKeyId: ENV.EXPO_PUBLIC_R2_ACCESS_KEY_ID,
    secretAccessKey: ENV.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY,
    bucketName: ENV.EXPO_PUBLIC_R2_BUCKET_NAME,
    region: ENV.EXPO_PUBLIC_R2_REGION,
    endpoint: ENV.EXPO_PUBLIC_R2_ENDPOINT,
  };
};
