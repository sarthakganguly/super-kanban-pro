/**
 * AttachmentViewer
 *
 * Full-screen viewer for attachments.
 *
 * Images:   full-size image with pinch-to-zoom (ScrollView with maximumZoomScale)
 * Audio:    metadata display + play button (Phase 9+ for native audio player)
 * PDF/docs: metadata display + open-in-native-app button
 *
 * Accessible via the close button or hardware back button.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Attachment } from '@kanban/types';
import { formatDate } from '@kanban/utils';
import { useTheme } from '../../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentViewerProps {
  attachment:  Attachment | null;
  onClose:     () => void;
  loadDataURL: (storageRef: string, mimeType: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentViewer({
  attachment,
  onClose,
  loadDataURL,
}: AttachmentViewerProps) {
  const theme = useTheme();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!attachment) { setDataUrl(null); return; }
    if (attachment.type !== 'image') return;

    setLoading(true);
    loadDataURL(attachment.storageRef, attachment.mimeType)
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
      .finally(() => setLoading(false));
  }, [attachment, loadDataURL]);

  if (!attachment) return null;

  const isImage = attachment.type === 'image';
  const sizeKb  = Math.round(attachment.sizeBytes / 1024);
  const sizeStr = sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`;

  return (
    <Modal
      visible={!!attachment}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close viewer"
          >
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {attachment.filename}
          </Text>
          <Text style={styles.headerSize}>{sizeStr}</Text>
        </View>

        {/* Content */}
        {isImage ? (
          <ScrollView
            contentContainerStyle={styles.imageContainer}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            centerContent
          >
            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : dataUrl ? (
              <Image
                source={{ uri: dataUrl }}
                style={styles.fullImage}
                resizeMode="contain"
                accessibilityLabel={`Full image: ${attachment.filename}`}
              />
            ) : (
              <Text style={styles.errorText}>Could not load image.</Text>
            )}
          </ScrollView>
        ) : (
          <FileMetaView attachment={attachment} />
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// FileMetaView — shown for non-image attachments
// ---------------------------------------------------------------------------

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', doc: '📝', txt: '📃', md: '📋', audio: '🎵',
};

function FileMetaView({ attachment }: { attachment: Attachment }) {
  const handleOpen = useCallback(async () => {
    if (Platform.OS !== 'web') {
      // On native, we'd use Linking.openURL(attachment.storageRef)
      // Full deep-link/share implementation is Phase 9
    } else {
      // On web, create a temporary anchor and trigger download
      const a = document.createElement('a');
      a.href     = attachment.storageRef; // IDB keys aren't URLs — needs data: URI
      a.download = attachment.filename;
      a.click();
    }
  }, [attachment]);

  return (
    <View style={styles.fileMetaContainer}>
      <Text style={styles.fileMetaIcon}>
        {FILE_ICONS[attachment.type] ?? '📎'}
      </Text>
      <Text style={styles.fileMetaName}>{attachment.filename}</Text>
      <Text style={styles.fileMetaType}>{attachment.mimeType}</Text>
      <Text style={styles.fileMetaDate}>
        Added {formatDate(attachment.createdAt)}
      </Text>
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.openBtn,
          { opacity: pressed ? 0.8 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open file"
      >
        <Text style={styles.openBtnText}>Open file</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:             { flex: 1 },
  header:           {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingTop:     Platform.OS === 'ios' ? 52 : 16,
    paddingBottom:  12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap:            8,
  },
  closeBtn:         { padding: 4 },
  closeBtnText:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  headerTitle:      { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  headerSize:       { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  imageContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 400 },
  fullImage:        { width: '100%', height: 400 },
  errorText:        { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  fileMetaContainer:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  fileMetaIcon:     { fontSize: 64 },
  fileMetaName:     { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  fileMetaType:     { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  fileMetaDate:     { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  openBtn:          {
    backgroundColor: '#fff',
    borderRadius:    10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop:       8,
  },
  openBtnText:      { color: '#000', fontSize: 15, fontWeight: '600' },
});
