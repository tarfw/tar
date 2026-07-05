import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { getCurrentUser } from '@/lib/auth';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(async (user) => {
      if (!user) {
        setTarget('/auth');
        return;
      }
      const done = await SecureStore.getItemAsync(`onb_${user.id}`);
      setTarget(done ? '/(tabs)/inbox' : '/onboarding');
    });
  }, []);

  if (!target) return null;

  return <Redirect href={target as any} />;
}
