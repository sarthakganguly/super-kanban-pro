import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useDatabase } from '@kanban/database';
import type { Attachment, Card } from '@kanban/types';
import { extractHashtags, formatDate, isOverdue } from '@kanban/utils';
import { TagService, useAttachments, type TagSummary } from '@kanban/services';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { TagInput } from '../../components/tags/TagInput';
import { AttachmentList } from '../../components/attachments/AttachmentList';
import { AttachmentPicker } from '../../components/attachments/AttachmentPicker';
import { AttachmentViewer } from '../../components/attachments/AttachmentViewer';
 
// ---------------------------------------------------------------------------
// Status color palette
// ---------------------------------------------------------------------------
 
const STATUS_COLORS = [
  null, '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6',
];
 
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
 
export interface CardDetailScreenProps {
  card: Card;
  onClose:  () => void;
  onUpdate: (cardId: string, updates: {
    title?:               string;
    descriptionMarkdown?: string;
    statusColor?:         string | null;
    dueDate?:             string | null;
  }) => Promise<Card | null>;
  onDelete: (cardId: string) => Promise<void>;
}
 
type UpdatePayload = Parameters<CardDetailScreenProps['onUpdate']>[1];
 
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
 
export function CardDetailScreen({
  card,
  onClose,
  onUpdate,
  onDelete,
}: CardDetailScreenProps) {
  const theme = useTheme();
  const db    = useDatabase();
 
  const [title,       setTitle]       = useState(card.title);
  const [description, setDescription] = useState(card.descriptionMarkdown);
  const [statusColor, setStatusColor] = useState<string | null>(card.statusColor);
  const [tags,        setTags]        = useState<TagSummary[]>([]);
  const [isSaving,    setIsSaving]    = useState(false);
  const [isDirty,     setIsDirty]     = useState(false);
  // Brief "✓ Saved" flash for tag operations (they auto-save, no Save button needed)
  const [tagSavedFlash, setTagSavedFlash] = useState(false);
 
  const pendingUpdatesRef  = useRef<UpdatePayload>({});
  const saveDebounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate debounce for hashtag sync — prevents rapid keystrokes from racing
  const tagSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagFlashTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagSvc             = useRef(new TagService(db.db));
 
  // Load initial tags
  useEffect(() => {
    tagSvc.current.getTagsForCard(card.id)
      .then(setTags)
      .catch((e) => console.warn('[CardDetail] failed to load tags:', e));
  }, [card.id]);
 
  // Cleanup all timers on unmount
  useEffect(() => () => {
    if (saveDebounceRef.current)    clearTimeout(saveDebounceRef.current);
    if (tagSyncDebounceRef.current) clearTimeout(tagSyncDebounceRef.current);
    if (tagFlashTimerRef.current)   clearTimeout(tagFlashTimerRef.current);
  }, []);
 
  // ---------------------------------------------------------------------------
  // Attachments
  // ---------------------------------------------------------------------------
 
  const {
    attachments,
    isLoading:   attachmentsLoading,
    isUploading,
    error:       attachmentError,
    addImage,
    addFile,
    deleteAttachment,
    loadDataURL,
  } = useAttachments(card.id);
 
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
 
  const handleFilePicked = useCallback(
    async (picked: import('../../components/attachments/AttachmentPicker').PickedFile) => {
      if (picked.isImage) {
        await addImage(picked.file ?? picked.uri, picked.filename);
      } else {
        await addFile(picked.file ?? picked.uri, picked.filename, picked.mimeType);
      }
    },
    [addImage, addFile],
  );
 
  // ---------------------------------------------------------------------------
  // Save helpers
  // ---------------------------------------------------------------------------
 
  const flushSave = useCallback(async () => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    if (Object.keys(pendingUpdatesRef.current).length === 0) return;
 
    const updates = { ...pendingUpdatesRef.current };
    pendingUpdatesRef.current = {};
 
    setIsSaving(true);
    await onUpdate(card.id, updates);
    setIsSaving(false);
    setIsDirty(false);
  }, [card.id, onUpdate]);
 
  const triggerSave = useCallback(
    (patch: UpdatePayload) => {
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...patch };
      setIsDirty(true);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => void flushSave(), 800);
    },
    [flushSave],
  );
 
  const handleClose = useCallback(async () => {
    // Cancel any pending tag sync before closing
    if (tagSyncDebounceRef.current) {
      clearTimeout(tagSyncDebounceRef.current);
      tagSyncDebounceRef.current = null;
    }
    await flushSave();
    onClose();
  }, [flushSave, onClose]);
 
  // ---------------------------------------------------------------------------
  // Field handlers
  // ---------------------------------------------------------------------------
 
  const handleTitleChange = useCallback(
    (text: string) => { setTitle(text); triggerSave({ title: text }); },
    [triggerSave],
  );
 
  const handleDescriptionChange = useCallback(
    (text: string) => {
      setDescription(text);
      triggerSave({ descriptionMarkdown: text });
 
      // Debounce the hashtag sync separately to prevent race conditions.
      // The description itself is saved via triggerSave above.
      // Tag sync runs 600ms after the user stops typing.
      if (tagSyncDebounceRef.current) clearTimeout(tagSyncDebounceRef.current);
      tagSyncDebounceRef.current = setTimeout(async () => {
        const hashtags = extractHashtags(text);
        try {
          await tagSvc.current.syncCardTags(card.id, hashtags);
          const updated = await tagSvc.current.getTagsForCard(card.id);
          setTags(updated);
        } catch (e) {
          console.warn('[CardDetail] tag sync error:', e);
        }
      }, 600);
    },
    [triggerSave, card.id],
  );
 
  const handleStatusColor = useCallback(
    (color: string | null) => {
      setStatusColor(color);
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, statusColor: color };
      void flushSave();
    },
    [flushSave],
  );
 
  // ---------------------------------------------------------------------------
  // Tag handlers — write directly to DB, show brief confirmation
  // ---------------------------------------------------------------------------
 
  const showTagSaved = useCallback(() => {
    setTagSavedFlash(true);
    if (tagFlashTimerRef.current) clearTimeout(tagFlashTimerRef.current);
    tagFlashTimerRef.current = setTimeout(() => setTagSavedFlash(false), 1500);
  }, []);
 
  const handleAddTag = useCallback(async (name: string) => {
    const tag = await tagSvc.current.attachTag(card.id, name);
    setTags((prev) => prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]);
    showTagSaved();
  }, [card.id, showTagSaved]);
 
  const handleRemoveTag = useCallback(async (tagId: string) => {
    await tagSvc.current.detachTag(card.id, tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    showTagSaved();
  }, [card.id, showTagSaved]);
 
  const handleAutocomplete = useCallback(
    (prefix: string) => tagSvc.current.autocomplete(prefix),
    [],
  );
 
  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
 
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete card',
      `"${title}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (saveDebounceRef.current)    clearTimeout(saveDebounceRef.current);
            if (tagSyncDebounceRef.current) clearTimeout(tagSyncDebounceRef.current);
            await onDelete(card.id);
            onClose();
          },
        },
      ],
    );
  }, [card.id, title, onDelete, onClose]);
 
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
 
  const overdue = card.dueDate ? isOverdue(card.dueDate) : false;
 
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.borderDefault }]}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={[styles.closeBtnText, { color: theme.colors.accent }]}>
            ← Back
          </Text>
        </Pressable>
 
        <View style={styles.headerRight}>
          {tagSavedFlash && (
            <Text style={[styles.tagSavedText, { color: theme.colors.success }]}>
              ✓ Tag saved
            </Text>
          )}
          {isSaving && (
            <Text style={[styles.savingText, { color: theme.colors.textDisabled }]}>
              Saving…
            </Text>
          )}
          {isDirty && !isSaving && (
            <Pressable
              onPress={flushSave}
              style={[styles.saveBtn, { backgroundColor: theme.colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          )}
        </View>
      </View>
 
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <RNTextInput
          style={[
            styles.titleInput,
            { color: theme.colors.textPrimary, fontSize: theme.typography.fontSizeXl },
          ]}
          value={title}
          onChangeText={handleTitleChange}
          multiline
          placeholder="Card title"
          placeholderTextColor={theme.colors.textDisabled}
          accessibilityLabel="Card title"
        />
 
        {/* Due date */}
        {card.dueDate && (
          <View style={[
            styles.dueBadge,
            { backgroundColor: overdue ? theme.colors.error : theme.colors.bgTertiary },
          ]}>
            <Text style={[styles.dueText, { color: overdue ? '#fff' : theme.colors.textSecondary }]}>
              {overdue ? '⚠ Overdue · ' : '📅 '}{formatDate(card.dueDate)}
            </Text>
          </View>
        )}
 
        {/* Status color */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Status
          </Text>
          <View style={styles.colorRow}>
            {STATUS_COLORS.map((color) => (
              <Pressable
                key={color ?? 'none'}
                onPress={() => handleStatusColor(color)}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color ?? theme.colors.bgTertiary,
                    borderColor:     statusColor === color
                      ? theme.colors.accent
                      : theme.colors.borderDefault,
                    borderWidth: statusColor === color ? 2 : 1,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityLabel={color ?? 'No status'}
                accessibilityState={{ checked: statusColor === color }}
              >
                {color === null && (
                  <Text style={{ color: theme.colors.textDisabled, fontSize: 12 }}>✕</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
 
        {/* Tags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Tags
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.textDisabled }]}>
              auto-saved · use # in description to tag
            </Text>
          </View>
          <TagInput
            tags={tags}
            onAdd={handleAddTag}
            onRemove={handleRemoveTag}
            onAutocomplete={handleAutocomplete}
          />
        </View>
 
        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Description
          </Text>
          <View style={[styles.editorWrapper, { borderColor: theme.colors.borderDefault }]}>
            <MarkdownEditor
              value={description}
              onChange={handleDescriptionChange}
              minHeight={200}
            />
          </View>
        </View>
 
        {/* Metadata */}
        <View style={styles.metaSection}>
          <Text style={[styles.metaItem, { color: theme.colors.textDisabled }]}>
            Created {formatDate(card.createdAt)}
          </Text>
          <Text style={[styles.metaItem, { color: theme.colors.textDisabled }]}>
            ID: {card.id.slice(0, 8)}…
          </Text>
        </View>
 
        {/* Attachments */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Attachments
          </Text>
          {attachmentError && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {attachmentError}
            </Text>
          )}
          <AttachmentList
            attachments={attachments}
            isLoading={attachmentsLoading}
            isUploading={isUploading}
            onDelete={deleteAttachment}
            onOpen={setViewingAttachment}
            loadDataURL={loadDataURL}
          />
          <AttachmentPicker onPick={handleFilePicked} disabled={isUploading} />
        </View>
 
        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <Button
            label="Save"
            onPress={flushSave}
            isLoading={isSaving}
            disabled={!isDirty}
            style={styles.bottomSaveBtn}
          />
          <Button
            label="Delete card"
            variant="destructive"
            onPress={handleDelete}
          />
        </View>
 
        <AttachmentViewer
          attachment={viewingAttachment}
          onClose={() => setViewingAttachment(null)}
          loadDataURL={loadDataURL}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
 
const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
  },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tagSavedText: { fontSize: 12, fontWeight: '500' },
  savingText:   { fontSize: 12 },
  saveBtn:      { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveBtnText:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  scroll:       { padding: 20, gap: 20, paddingBottom: 60 },
  titleInput:   { fontWeight: '700', letterSpacing: -0.5, lineHeight: 32, minHeight: 40 },
  dueBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  dueText:      { fontSize: 13, fontWeight: '500' },
  section:      { gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionHint:  { fontSize: 11 },
  colorRow:     { flexDirection: 'row', gap: 10 },
  colorSwatch:  { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  editorWrapper:{ borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  metaSection:  { paddingTop: 8, gap: 4 },
  metaItem:     { fontSize: 11 },
  bottomActions:{ gap: 10, paddingTop: 8 },
  bottomSaveBtn:{},
  errorText:    { fontSize: 12, marginBottom: 4 },
});