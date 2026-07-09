import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { getCurrentUser } from '@/lib/auth';
import { tar } from '@/lib/tar';

export default function Index() {
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
          setTarget('/inbox');
        } else {
          setTarget('/add-workspace');
        }
      } catch (e) {
        console.warn('[Index] Failed to check workspaces:', e);
        setTarget('/inbox');
      }
    });
  }, []);

  if (!target) return null;

  return <Redirect href={target as any} />;
}
