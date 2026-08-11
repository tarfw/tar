import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { TarLogo } from '@/components/TarLogo';

interface TarLogoLoaderProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function TarLogoLoader({ size = 32, color = '#007AFF', style }: TarLogoLoaderProps) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.12,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.88,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulseAnim, scaleAnim]);

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        style={{
          opacity: pulseAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <TarLogo size={size} color={color} />
      </Animated.View>
    </View>
  );
}

export default TarLogoLoader;
