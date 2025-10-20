import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Delay navigation to ensure navigator is ready
    const timer = setTimeout(() => {
      router.replace('/workspace');
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
