import { useEffect, useState } from 'react';

// Simple singleton store for memory selection
let currentMemory = 'Memory';
const listeners = new Set<(val: string) => void>();

export const memoryStore = {
    get: () => currentMemory,
    set: (val: string) => {
        currentMemory = val;
        listeners.forEach((l) => l(val));
    },
    subscribe: (listener: (val: string) => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useMemoryStore() {
    const [memory, setMemory] = useState(memoryStore.get());

    useEffect(() => {
        const unsubscribe = memoryStore.subscribe(setMemory);
        return () => {
            unsubscribe();
        };
    }, []);

    return {
        memory,
        setMemory: memoryStore.set,
    };
}
