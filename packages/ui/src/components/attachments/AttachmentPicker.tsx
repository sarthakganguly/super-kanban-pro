/**
 * AttachmentPicker
 *
 * Triggers the file/image picker and calls back with the selected file.
 *
 * Web:  uses an <input type="file"> element hidden behind a styled button.
 *       Accept string controls which types the OS file browser shows.
 *
 * Native: uses react-native-document-picker for files and
 *         react-native-image-picker for images.
 *         Both are dynamically imported so web bundle is unaffected.
 *
 * The picker is intentionally separate from AttachmentList so it can be
 * placed anywhere in the layout (e.g. in a toolbar or FAB).
 */

import React, { useCallback, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PickedFile {
  /** data: URI string for web, or absolute file path for native */
  uri:      string;
  /** The file itself (web only, null on native) */
  file:     File | null;
  filename: string;
  mimeType: string;
  size:     number;
  isImage:  boolean;
}

export interface AttachmentPickerProps {
  onPick:   (file: PickedFile) => void;
  onError?: (err: Error) => void;
  /** If true, only image types are shown (default: false = all types) */
  imagesOnly?: boolean;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Web picker — hidden <input type="file">
// ---------------------------------------------------------------------------

function WebPicker({ onPick, onError, imagesOnly, disabled }: AttachmentPickerProps) {
  const theme      = useTheme();
  const inputRef   = useRef<HTMLInputElement>(null);
  const accept     = imagesOnly ? 'image/*' : 'image/*,application/pdf,audio/*,text/plain,text/markdown';

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be picked again
      e.target.value = '';

      const isImage = file.type.startsWith('image/');

      onPick({
        uri:      URL.createObjectURL(file),
        file,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size:     file.size,
        isImage,
      });
    },
    [onPick],
  );

  return (
    <Pressable
      onPress={() => inputRef.current?.click()}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.bgSecondary,
          borderColor:     theme.colors.borderDefault,
          opacity:         disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add attachment"
    >
      <Text style={[styles.icon, { color: theme.colors.textSecondary }]}>📎</Text>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {imagesOnly ? 'Add image' : 'Attach file'}
      </Text>
      {/* Hidden native file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Native picker — react-native-document-picker / image-picker
// ---------------------------------------------------------------------------

function NativePicker({ onPick, onError, imagesOnly, disabled }: AttachmentPickerProps) {
  const theme = useTheme();

  const handlePress = useCallback(async () => {
    try {
      if (imagesOnly) {
        const { launchImageLibrary } = await import('react-native-image-picker');
        const result = await launchImageLibrary({
          mediaType:    'photo',
          includeBase64: false,
          quality:      1,
        });

        if (result.didCancel || !result.assets?.length) return;
        const asset = result.assets[0]!;

        onPick({
          uri:      asset.uri!,
          file:     null,
          filename: asset.fileName ?? 'image.jpg',
          mimeType: asset.type ?? 'image/jpeg',
          size:     asset.fileSize ?? 0,
          isImage:  true,
        });
      } else {
        const DocumentPicker = await import('react-native-document-picker');
        const result = await DocumentPicker.default.pickSingle({
          type: [
            DocumentPicker.types.images,
            DocumentPicker.types.pdf,
            DocumentPicker.types.audio,
            DocumentPicker.types.plainText,
          ],
          copyTo: 'cachesDirectory',
        });

        const isImage = (result.type ?? '').startsWith('image/');

        onPick({
          uri:      result.fileCopyUri ?? result.uri,
          file:     null,
          filename: result.name ?? 'file',
          mimeType: result.type ?? 'application/octet-stream',
          size:     result.size ?? 0,
          isImage,
        });
      }
    } catch (err) {
      // User cancelled — not an error worth surfacing
      const isCancel =
        typeof err === 'object' && err !== null && 'code' in err &&
        (err as { code: string }).code === 'DOCUMENT_PICKER_CANCELED';
      if (!isCancel) onError?.(err as Error);
    }
  }, [onPick, onError, imagesOnly]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.bgSecondary,
          borderColor:     theme.colors.borderDefault,
          opacity:         disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add attachment"
    >
      <Text style={[styles.icon, { color: theme.colors.textSecondary }]}>📎</Text>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {imagesOnly ? 'Add image' : 'Attach file'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Public component — routes to platform implementation
// ---------------------------------------------------------------------------

export function AttachmentPicker(props: AttachmentPickerProps) {
  return Platform.OS === 'web'
    ? <WebPicker {...props} />
    : <NativePicker {...props} />;
}

const styles = StyleSheet.create({
  button: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    borderWidth:    1,
    borderRadius:   8,
    paddingHorizontal: 12,
    paddingVertical:   8,
    alignSelf: 'flex-start',
  },
  icon:  { fontSize: 16 },
  label: { fontSize: 13, fontWeight: '500' },
});
