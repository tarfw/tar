import { useColorScheme } from 'nativewind';

export const Colors = {
    light: {
        background: '#FFFFFF',
        secondaryBackground: '#F2F2F7',
        text: '#1C1C1E',
        secondaryText: '#8E8E93',
        border: 'rgba(0,0,0,0.05)',
        accent: '#006AFF',
        tabBarBackground: 'rgba(255, 255, 255, 0.9)',
        card: '#FFFFFF',
        searchBar: '#F2F2F7',
        timelineTitle: '#0F172A',
        statusText: '#64748B',
        timeLabel: '#94A3B8',
        dropdownBackground: '#FFFFFF',
        dropdownText: '#1C1C1E',
    },
    dark: {
        background: '#000000',
        secondaryBackground: '#1C1C1E',
        text: '#FFFFFF',
        secondaryText: '#8E8E93',
        border: 'rgba(255,255,255,0.1)',
        accent: '#0A84FF',
        tabBarBackground: 'rgba(28, 28, 30, 0.9)',
        card: '#1C1C1E',
        searchBar: '#1C1C1E',
        timelineTitle: '#F8FAFC',
        statusText: '#94A3B8',
        timeLabel: '#64748B',
        dropdownBackground: '#1F2023',
        dropdownText: '#E8E9EB',
    }
};

export function useThemeColors() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    return isDark ? Colors.dark : Colors.light;
}
