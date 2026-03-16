/**
 * AttachmentList
 *
 * Displays all attachments for a card:
 *   Images → thumbnail grid (2 per row)
 *   Other  → file rows with icon, name, and size
 *
 * Tapping an attachment opens the full-screen AttachmentViewer.
 * Long-pressing shows a delete confirmation.
 *
 * The list is split into two sections rendered inline (not in a FlatList)
 * because it's nested inside the CardDetailScreen ScrollView — FlatList
 * cannot be nested inside ScrollView on native.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Attachment } from '@kanban/types';
import { useThumbnail } from '../../../../services/src/thumbnail/useThumbnail';
import { useTheme } from '../../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentListProps {
  attachments:      Attachment[];
  isLoading:        boolean;
  isUploading:      boolean;
  onDelete:         (id: string) => Promise<void>;
  onOpen:           (attachment: Attachment) => void;
  /** Loads a data: URI for an attachment — may cache results */
  loadDataURL:      (storageRef: string, mimeType: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentList({
  attachments,
  isLoading,
  isUploading,
  onDelete,
  onOpen,
  loadDataURL,
}: AttachmentListProps) {
  const theme = useTheme();

  const images = attachments.filter((a) => a.type === 'image');
  const files  = attachments.filter((a) => a.type !== 'image');

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading attachments…
        </Text>
      </View>
    );
  }

  if (attachments.length === 0 && !isUploading) return null;

  return (
    <View style={styles.root}>
      {/* Upload progress indicator */}
      {isUploading && (
        <View style={[styles.uploadingRow, { backgroundColor: theme.colors.bgTertiary }]}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.uploadingText, { color: theme.colors.textSecondary }]}>
            Uploading…
          </Text>
        </View>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <View style={styles.imageGrid}>
          {images.map((img) => (
            <ImageThumbnail
              key={img.id}
              attachment={img}
              onOpen={onOpen}
              onDelete={onDelete}
              loadDataURL={loadDataURL}
            />
          ))}
        </View>
      )}

      {/* File list */}
      {files.map((file) => (
        <FileRow
          key={file.id}
          attachment={file}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ImageThumbnail
// ---------------------------------------------------------------------------

function ImageThumbnail({
  attachment,
  onOpen,
  onDelete,
  loadDataURL,
}: {
  attachment:  Attachment;
  onOpen:      (a: Attachment) => void;
  onDelete:    (id: string) => Promise<void>;
  loadDataURL: (ref: string, mime: string) => Promise<string | null>;
}) {
  const theme = useTheme();
  // useThumbnail checks the LRU cache before fetching from blob storage.
  // Cache hits are synchronous — no flicker on scroll-back.
  const ref = attachment.thumbnailRef ?? attachment.storageRef;
  const { uri, isLoading: busy } = useThumbnail(ref, attachment.mimeType, loadDataURL);

  const handleLongPress = useCallback(() => {
    Alert.alert(
      'Delete attachment',
      `Remove "${attachment.filename}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => void onDelete(attachment.id),
        },
      ],
    );
  }, [attachment, onDelete]);

  return (
    <Pressable
      onPress={() => onOpen(attachment)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.thumbnail,
        { backgroundColor: theme.colors.bgTertiary, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`View image: ${attachment.filename}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      ) : uri ? (
        <Image source={{ uri }} style={styles.thumbnailImg} resizeMode="cover" />
      ) : (
        <Text style={[styles.thumbFallback, { color: theme.colors.textDisabled }]}>🖼</Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FileRow
// ---------------------------------------------------------------------------

const FILE_ICONS: Record<string, string> = {
  pdf:   '📄',
  doc:   '📝',
  txt:   '📃',
  md:    '📋',
  audio: '🎵',
};

function FileRow({
  attachment,
  onOpen,
  onDelete,
}: {
  attachment: Attachment;
  onOpen:     (a: Attachment) => void;
  onDelete:   (id: string) => Promise<void>;
}) {
  const theme = useTheme();
  const icon  = FILE_ICONS[attachment.type] ?? '📎';
  const sizeKb = Math.round(attachment.sizeBytes / 1024);
  const sizeStr = sizeKb < 1024
    ? `${sizeKb} KB`
    : `${(sizeKb / 1024).toFixed(1)} MB`;

  const handleLongPress = useCallback(() => {
    Alert.alert(
      'Delete attachment',
      `Remove "${attachment.filename}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => void onDelete(attachment.id),
        },
      ],
    );
  }, [attachment, onDelete]);

  return (
    <Pressable
      onPress={() => onOpen(attachment)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.fileRow,
        {
          backgroundColor: theme.colors.bgSecondary,
          borderColor:     theme.colors.borderDefault,
          opacity:         pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open file: ${attachment.filename}`}
    >
      <Text style={styles.fileIcon}>{icon}</Text>
      <View style={styles.fileMeta}>
        <Text
          style={[styles.fileName, { color: theme.colors.textPrimary }]}
          numberOfLines={1}
        >
          {attachment.filename}
        </Text>
        <Text style={[styles.fileSize, { color: theme.colors.textSecondary }]}>
          {sizeStr}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const THUMB_SIZE = 88;

const styles = StyleSheet.create({
  root:          { gap: 10 },
  loadingRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  loadingText:   { fontSize: 13 },
  uploadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8 },
  uploadingText: { fontSize: 13, fontWeight: '500' },
  imageGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnail:     {
    width:        THUMB_SIZE,
    height:       THUMB_SIZE,
    borderRadius: 8,
    overflow:     'hidden',
    alignItems:   'center',
    justifyContent: 'center',
  },
  thumbnailImg:  { width: '100%', height: '100%' },
  thumbFallback: { fontSize: 28 },
  fileRow:       {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    borderWidth:    1,
    borderRadius:   8,
    padding:        10,
  },
  fileIcon:      { fontSize: 20 },
  fileMeta:      { flex: 1, gap: 2 },
  fileName:      { fontSize: 13, fontWeight: '500' },
  fileSize:      { fontSize: 11 },
});
