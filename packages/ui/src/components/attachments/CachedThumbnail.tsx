/**
 * CachedThumbnail
 *
 * Renders a small thumbnail image for use in the board card preview.
 * Uses the shared ThumbnailCache — if the full card detail screen already
 * loaded this thumbnail, the board view shows it instantly.
 *
 * Falls back to a colored placeholder if:
 *   - No thumbnail is stored (non-image attachments)
 *   - The blob is missing or corrupt
 *   - The load is still in progress
 *
 * Props:
 *   storageRef  — the thumbnail's blob key / filesystem path
 *   mimeType    — MIME type string (e.g. "image/jpeg")
 *   loadDataURL — blob-to-data-URI function from useAttachments
 *   size        — square size in pixels (default 48)
 *   style       — additional styles for the outer container
 */

import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useThumbnail } from '../../../../services/src/thumbnail/useThumbnail';
import { useTheme } from '../../theme/ThemeProvider';

export interface CachedThumbnailProps {
  storageRef:  string | null;
  mimeType:    string;
  loadDataURL: (ref: string, mime: string) => Promise<string | null>;
  size?:       number;
  borderRadius?: number;
  style?:      StyleProp<ViewStyle>;
}

export function CachedThumbnail({
  storageRef,
  mimeType,
  loadDataURL,
  size         = 48,
  borderRadius = 6,
  style,
}: CachedThumbnailProps) {
  const theme = useTheme();
  const { uri, isLoading } = useThumbnail(storageRef, mimeType, loadDataURL);

  const containerStyle = [
    styles.container,
    { width: size, height: size, borderRadius, backgroundColor: theme.colors.bgTertiary },
    style,
  ];

  return (
    <View style={containerStyle}>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={theme.colors.textDisabled}
          style={styles.indicator}
        />
      ) : uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { borderRadius }]}
          resizeMode="cover"
          accessibilityLabel="Card thumbnail"
        />
      ) : (
        // Placeholder shown when no image / load failed
        <View style={[styles.placeholder, { borderRadius }]}>
          <View
            style={[
              styles.placeholderDot,
              { backgroundColor: theme.colors.textDisabled },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image:          { width: '100%', height: '100%' },
  indicator:      { position: 'absolute' },
  placeholder:    { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  placeholderDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.4 },
});