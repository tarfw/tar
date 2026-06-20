import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { getCurrentUser } from '@/lib/auth';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      setTarget(user ? '/actions' : '/auth');
    });
  }, []);

  if (!target) return null;

  return <Redirect href={target} />;
}
