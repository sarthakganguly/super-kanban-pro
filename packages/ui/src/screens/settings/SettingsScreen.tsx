/**
 * SettingsScreen
 *
 * Full settings page with sections:
 *
 *   APPEARANCE
 *     Theme         — Light / Dark / System (SegmentedControl)
 *     Font family   — picker from AVAILABLE_FONTS
 *     Font size     — SegmentedControl of preset sizes
 *
 *   BOARD DEFAULTS
 *     Default lanes — editable list; add/remove/reorder
 *                     each lane has an inline name + color picker
 *
 *   ATTACHMENTS
 *     Image size limit — SegmentedControl of presets (1 / 2 / 5 / 10 MB)
 *     Markdown default — toggle to open cards in Preview vs Edit mode
 *
 *   ACCOUNT
 *     Username (read-only display)
 *     Sign out button
 *
 *   FUTURE — SYNC (rendered but disabled)
 *     Enable sync  — toggle
 *     Sync endpoint — text input
 *
 *   DANGER ZONE
 *     Reset settings to defaults
 *
 * Props:
 *   onBack   — called when the user taps ← to return to the board list
 *   onLogout — called after sign-out confirmation
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSettings } from '@kanban/services';
import { useCurrentUser } from '@kanban/store';
import {
  AVAILABLE_FONTS,
  FONT_SIZE_OPTIONS,
  IMAGE_SIZE_PRESETS,
  LANE_COLOR_PALETTE,
} from '@kanban/services';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { ColorPicker } from '../../components/settings/ColorPicker';
import { SegmentedControl } from '../../components/settings/SegmentedControl';
import { SettingsRow, SettingsSection } from '../../components/settings/SettingsRow';
import type { ThemeMode } from '@kanban/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsScreenProps {
  onBack:   () => void;
  onLogout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsScreen({ onBack, onLogout }: SettingsScreenProps) {
  const theme       = useTheme();
  const currentUser = useCurrentUser();

  const {
    settings,
    isLoading,
    isSaving,
    error,
    clearError,
    setThemeMode,
    setFontFamily,
    setFontSize,
    setDefaultLanes,
    setImageMaxSize,
    setMarkdownDefault,
    setSyncEndpoint,
    setEnableSync,
    resetToDefaults,
  } = useSettings();

  // Local lane editor state (mirrors settings.defaultSwimlanes)
  const [laneNames,  setLaneNames]  = useState<string[]>([]);
  const [laneColors, setLaneColors] = useState<string[]>([]);
  const [lanesEdited, setLanesEdited] = useState(false);

  // Initialise lane editor when settings load
  React.useEffect(() => {
    if (settings && !lanesEdited) {
      setLaneNames(settings.defaultSwimlanes);
      setLaneColors(settings.defaultLaneColors);
    }
  }, [settings, lanesEdited]);

  // Sync endpoint local state (debounced save)
  const [syncUrl,       setSyncUrl]       = useState(settings?.syncEndpoint ?? '');
  const syncDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSyncUrlChange = useCallback(
    (text: string) => {
      setSyncUrl(text);
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        void setSyncEndpoint(text.trim() || null);
      }, 800);
    },
    [setSyncEndpoint],
  );

  // ---------------------------------------------------------------------------
  // Lane editor helpers
  // ---------------------------------------------------------------------------

  const handleLaneNameChange = useCallback((idx: number, name: string) => {
    setLaneNames((prev) => {
      const next = [...prev];
      next[idx]  = name;
      return next;
    });
    setLanesEdited(true);
  }, []);

  const handleLaneColorChange = useCallback((idx: number, color: string) => {
    setLaneColors((prev) => {
      const next = [...prev];
      next[idx]  = color;
      return next;
    });
    setLanesEdited(true);
  }, []);

  const handleAddLane = useCallback(() => {
    setLaneNames((prev) => [...prev, 'New lane']);
    setLaneColors((prev) => [...prev, LANE_COLOR_PALETTE[prev.length % LANE_COLOR_PALETTE.length]!]);
    setLanesEdited(true);
  }, []);

  const handleRemoveLane = useCallback((idx: number) => {
    setLaneNames((prev) => prev.filter((_, i) => i !== idx));
    setLaneColors((prev) => prev.filter((_, i) => i !== idx));
    setLanesEdited(true);
  }, []);

  const handleSaveLanes = useCallback(async () => {
    await setDefaultLanes(laneNames, laneColors);
    setLanesEdited(false);
  }, [laneNames, laneColors, setDefaultLanes]);

  // ---------------------------------------------------------------------------
  // Account actions
  // ---------------------------------------------------------------------------

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign out',
      'You will be returned to the login screen. Your data stays on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Sign out',
          style: 'destructive',
          onPress: () => void onLogout(),
        },
      ],
    );
  }, [onLogout]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset settings',
      'All settings will return to their defaults. Your boards and cards are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Reset',
          style: 'destructive',
          onPress: () => void resetToDefaults(),
        },
      ],
    );
  }, [resetToDefaults]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  if (isLoading || !settings) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bgTertiary }]}>
        <SettingsHeader title="Settings" onBack={onBack} isSaving={false} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  const themeOptions: Array<{ label: string; value: ThemeMode }> = [
    { label: 'Light',  value: 'light' },
    { label: 'Dark',   value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  const fontSizeOptions = FONT_SIZE_OPTIONS.map((s) => ({
    label: String(s),
    value: String(s),
  }));

  const imageSizeOptions = IMAGE_SIZE_PRESETS.map((mb) => ({
    label: `${mb} MB`,
    value: String(mb),
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bgTertiary }]}>
      <SettingsHeader title="Settings" onBack={onBack} isSaving={isSaving} />

      {/* Error banner */}
      {error && (
        <Pressable
          style={[styles.errorBanner, { backgroundColor: theme.colors.error }]}
          onPress={clearError}
        >
          <Text style={styles.errorText}>{error} (tap to dismiss)</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── APPEARANCE ─────────────────────────────────────────────── */}
          <SettingsSection title="Appearance">
            <SettingsRow
              label="Theme"
              sublabel="Affects the whole app"
            >
              <SegmentedControl
                options={themeOptions}
                value={settings.themeMode}
                onChange={(mode) => void setThemeMode(mode)}
              />
            </SettingsRow>

            <SettingsRow label="Font family">
              <View style={styles.pickerGroup}>
                {AVAILABLE_FONTS.map((font) => (
                  <Pressable
                    key={font.value}
                    onPress={() => void setFontFamily(font.value)}
                    style={[
                      styles.fontOption,
                      {
                        backgroundColor: settings.fontFamily === font.value
                          ? theme.colors.accent
                          : theme.colors.bgTertiary,
                        borderColor: settings.fontFamily === font.value
                          ? theme.colors.accent
                          : theme.colors.borderDefault,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={font.label}
                    accessibilityState={{ checked: settings.fontFamily === font.value }}
                  >
                    <Text
                      style={[
                        styles.fontOptionText,
                        {
                          color: settings.fontFamily === font.value
                            ? '#fff'
                            : theme.colors.textSecondary,
                          fontFamily: font.value === 'System' ? undefined : font.value,
                        },
                      ]}
                    >
                      {font.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SettingsRow>

            <SettingsRow label="Font size" sublabel="Base text size in px">
              <SegmentedControl
                options={fontSizeOptions}
                value={String(settings.fontSize)}
                onChange={(v) => void setFontSize(Number(v))}
              />
            </SettingsRow>
          </SettingsSection>

          {/* ── BOARD DEFAULTS ─────────────────────────────────────────── */}
          <SettingsSection title="Board defaults">
            <SettingsRow
              label="Default lanes"
              sublabel="Applied to every new board"
              variant="stacked"
            >
              <View style={styles.lanesEditor}>
                {laneNames.map((name, idx) => (
                  <View key={idx} style={styles.laneRow}>
                    <TextInput
                      value={name}
                      onChangeText={(t) => handleLaneNameChange(idx, t)}
                      style={[
                        styles.laneNameInput,
                        {
                          color:           theme.colors.textPrimary,
                          backgroundColor: theme.colors.bgSecondary,
                          borderColor:     theme.colors.borderDefault,
                          fontSize:        theme.typography.fontSizeSm,
                        },
                      ]}
                      placeholder="Lane name"
                      placeholderTextColor={theme.colors.textDisabled}
                      accessibilityLabel={`Lane ${idx + 1} name`}
                    />
                    <ColorPicker
                      value={laneColors[idx] ?? '#6B7280'}
                      onChange={(color) => handleLaneColorChange(idx, color)}
                    />
                    {laneNames.length > 1 && (
                      <Pressable
                        onPress={() => handleRemoveLane(idx)}
                        style={styles.removeLaneBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove lane ${name}`}
                      >
                        <Text style={[styles.removeLaneBtnText, { color: theme.colors.error }]}>
                          ✕
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}

                <View style={styles.laneActions}>
                  <Button
                    label="+ Add lane"
                    variant="secondary"
                    size="sm"
                    onPress={handleAddLane}
                    disabled={laneNames.length >= 10}
                  />
                  {lanesEdited && (
                    <Button
                      label="Save lanes"
                      size="sm"
                      onPress={handleSaveLanes}
                      isLoading={isSaving}
                    />
                  )}
                </View>
              </View>
            </SettingsRow>
          </SettingsSection>

          {/* ── ATTACHMENTS ────────────────────────────────────────────── */}
          <SettingsSection title="Attachments">
            <SettingsRow
              label="Image size limit"
              sublabel="Images are compressed before saving"
            >
              <SegmentedControl
                options={imageSizeOptions}
                value={String(settings.imageMaxSizeMb)}
                onChange={(v) => void setImageMaxSize(Number(v))}
              />
            </SettingsRow>

            <SettingsRow
              label="Markdown preview"
              sublabel="Open cards in preview mode by default"
            >
              <Switch
                value={!settings.markdownDefault}
                onValueChange={(v) => void setMarkdownDefault(!v)}
                trackColor={{ false: theme.colors.borderDefault, true: theme.colors.accent }}
                thumbColor="#fff"
                accessibilityRole="switch"
                accessibilityLabel="Markdown preview default"
              />
            </SettingsRow>
          </SettingsSection>

          {/* ── ACCOUNT ────────────────────────────────────────────────── */}
          <SettingsSection title="Account">
            <SettingsRow label="Username">
              <Text style={[styles.readonlyValue, { color: theme.colors.textSecondary }]}>
                {currentUser?.username ?? '—'}
              </Text>
            </SettingsRow>

            <SettingsRow
              label="Sign out"
              variant="pressable"
              onPress={handleLogout}
              destructive
              showChevron
            />
          </SettingsSection>

          {/* ── SYNC (future) ──────────────────────────────────────────── */}
          <SettingsSection title="Sync (coming soon)">
            <SettingsRow
              label="Enable cloud sync"
              sublabel="Requires a Kanban sync server"
            >
              <Switch
                value={settings.enableSync}
                onValueChange={(v) => void setEnableSync(v)}
                trackColor={{ false: theme.colors.borderDefault, true: theme.colors.accent }}
                thumbColor="#fff"
                disabled
                accessibilityRole="switch"
                accessibilityLabel="Enable sync"
                accessibilityState={{ disabled: true }}
              />
            </SettingsRow>

            <SettingsRow
              label="Sync endpoint"
              sublabel="URL of your sync server"
              variant="stacked"
            >
              <TextInput
                value={syncUrl}
                onChangeText={handleSyncUrlChange}
                placeholder="https://your-sync-server.com"
                placeholderTextColor={theme.colors.textDisabled}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={false}
                style={[
                  styles.syncInput,
                  {
                    color:           theme.colors.textDisabled,
                    backgroundColor: theme.colors.bgTertiary,
                    borderColor:     theme.colors.borderDefault,
                    fontSize:        theme.typography.fontSizeSm,
                  },
                ]}
                accessibilityLabel="Sync server URL"
              />
            </SettingsRow>
          </SettingsSection>

          {/* ── DANGER ZONE ────────────────────────────────────────────── */}
          <SettingsSection title="Danger zone">
            <SettingsRow
              label="Reset all settings"
              sublabel="Boards and cards are not affected"
              variant="pressable"
              onPress={handleReset}
              destructive
              showChevron
            />
          </SettingsSection>

          {/* App version */}
          <Text style={[styles.version, { color: theme.colors.textDisabled }]}>
            Kanban · Phase 9 build
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SettingsHeader
// ---------------------------------------------------------------------------

function SettingsHeader({
  title,
  onBack,
  isSaving,
}: {
  title:    string;
  onBack:   () => void;
  isSaving: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: theme.colors.bgPrimary, borderBottomColor: theme.colors.borderDefault }]}>
      <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={[styles.backBtnText, { color: theme.colors.accent }]}>← Back</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      <View style={styles.headerRight}>
        {isSaving && <ActivityIndicator size="small" color={theme.colors.textDisabled} />}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:          { flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:      { minWidth: 70 },
  backBtnText:  { fontSize: 14, fontWeight: '600' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  headerRight:  { minWidth: 70, alignItems: 'flex-end' },

  errorBanner:  { padding: 10, alignItems: 'center' },
  errorText:    { color: '#fff', fontSize: 13, fontWeight: '500' },

  scroll: { padding: 16, gap: 24, paddingBottom: 60 },

  pickerGroup:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fontOption:     { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  fontOptionText: { fontSize: 12, fontWeight: '500' },

  lanesEditor:   { gap: 12 },
  laneRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  laneNameInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 120, flex: 1 },
  removeLaneBtn: { padding: 4 },
  removeLaneBtnText: { fontSize: 16, fontWeight: '600' },
  laneActions:   { flexDirection: 'row', gap: 10, marginTop: 4 },

  syncInput:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, width: '100%' },

  readonlyValue: { fontSize: 14 },
  version:       { textAlign: 'center', fontSize: 11, paddingVertical: 8 },
});
