/**
 * OfflineBanner
 *
 * A slim banner shown at the top of the screen when the device is offline.
 *
 * Design principles:
 *   - Non-blocking: renders above content, not in place of it
 *   - Informational only: the app still works offline, so no error styling
 *   - Auto-hides when connectivity is restored (animated slide-out)
 *   - Accessible: `accessibilityLiveRegion="polite"` announces it to screen readers
 *
 * The banner animates in/out using `Animated.timing` on the height value,
 * collapsing smoothly rather than popping in/out abruptly.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useOfflineStatus } from './useOfflineStatus';

const BANNER_HEIGHT = 32;
const ANIMATION_MS  = 250;

export function OfflineBanner() {
  const theme             = useTheme();
  const { isOffline }     = useOfflineStatus();
  const heightAnim        = useRef(new Animated.Value(0)).current;
  const opacityAnim       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue:        isOffline ? BANNER_HEIGHT : 0,
        duration:       ANIMATION_MS,
        useNativeDriver: false, // height cannot use native driver
      }),
      Animated.timing(opacityAnim, {
        toValue:        isOffline ? 1 : 0,
        duration:       ANIMATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOffline, heightAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          height:          heightAnim,
          opacity:         opacityAnim,
          backgroundColor: theme.colors.warning,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={isOffline ? 'You are offline. Changes are saved locally.' : undefined}
      pointerEvents={isOffline ? 'auto' : 'none'}
    >
      <Text style={[styles.text, { color: '#fff' }]}>
        You're offline — changes saved locally
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow:       'hidden',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
  },
  text: {
    fontSize:   12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
