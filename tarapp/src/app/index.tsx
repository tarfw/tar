import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '@/lib/auth';
import { tar } from '@/lib/tar';

export default function Index() {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(async (user) => {
      if (!user) {
        setTarget('/auth');
        return;
      }
      try {
        const data = await tar.listWorkspaces();
        const list = data.workspaces || [];
        if (list.length > 0) {
          setTarget('/(tabs)/workspaces');
        } else {
          setTarget('/(tabs)/workspaces?action=new');
        }
      } catch (e) {
        console.warn('[Index] Failed to check workspaces:', e);
        setTarget('/(tabs)/workspaces');
      }
    });
  }, []);

  useEffect(() => {
    if (target) {
      router.replace(target as any);
    }
  }, [target, router]);

  return null;
}
