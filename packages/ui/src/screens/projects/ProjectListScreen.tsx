/**
 * ProjectListScreen
 *
 * The main screen after login. Shows all the user's projects.
 *
 * Features:
 *   - FlatList of project cards (name + creation date)
 *   - FAB (floating action button) to create a new project
 *   - Long-press or "⋯" button on each row opens ProjectMenuModal
 *   - Inline rename via an editing modal
 *   - Delete with a confirmation prompt
 *   - Header shows username + logout button
 *   - Empty state when the user has no projects yet
 *
 * Navigation:
 *   Tapping a project calls `onOpenProject(id)`.
 *   The parent navigator (AppNavigator) handles the actual screen push.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useProjects } from '@kanban/services';
import { useCurrentUser } from '@kanban/store';
import type { Project } from '@kanban/types';
import { formatDate } from '@kanban/utils';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { Modal } from '../components/Modal';
import { TextInput } from '../components/TextInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectListScreenProps {
  onOpenProject:  (projectId: string, projectName: string) => void;
  onLogout:       () => void;
  onOpenSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectListScreen({
  onOpenProject,
  onLogout,
  onOpenSettings,
}: ProjectListScreenProps) {
  const theme       = useTheme();
  const currentUser = useCurrentUser();

  const {
    projects,
    isLoading,
    error,
    clearError,
    createProject,
    renameProject,
    deleteProject,
    openProject,
  } = useProjects();

  // ---------------------------------------------------------------------------
  // Create modal state
  // ---------------------------------------------------------------------------
  const [showCreate, setShowCreate]     = useState(false);
  const [createName, setCreateName]     = useState('');
  const [createError, setCreateError]   = useState<string | null>(null);
  const [isCreating, setIsCreating]     = useState(false);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) {
      setCreateError('Please enter a project name.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    const project = await createProject(createName.trim());
    setIsCreating(false);
    if (project) {
      setShowCreate(false);
      setCreateName('');
    }
  }, [createName, createProject]);

  // ---------------------------------------------------------------------------
  // Rename modal state
  // ---------------------------------------------------------------------------
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [renameValue, setRenameValue]         = useState('');
  const [renameError, setRenameError]         = useState<string | null>(null);
  const [isRenaming, setIsRenaming]           = useState(false);

  const openRenameModal = useCallback((project: Project) => {
    setRenamingProject(project);
    setRenameValue(project.name);
    setRenameError(null);
  }, []);

  const handleRename = useCallback(async () => {
    if (!renamingProject || !renameValue.trim()) return;
    setIsRenaming(true);
    setRenameError(null);
    try {
      await renameProject(renamingProject.id, renameValue.trim());
      setRenamingProject(null);
    } catch {
      setRenameError('Failed to rename. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  }, [renamingProject, renameValue, renameProject]);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const handleDelete = useCallback(
    (project: Project) => {
      Alert.alert(
        'Delete project',
        `"${project.name}" and all its cards will be deleted. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteProject(project.id);
            },
          },
        ],
      );
    },
    [deleteProject],
  );

  // ---------------------------------------------------------------------------
  // Open project
  // ---------------------------------------------------------------------------
  const handleOpen = useCallback(
    (project: Project) => {
      openProject(project.id);
      onOpenProject(project.id, project.name);
    },
    [openProject, onOpenProject],
  );

  // ---------------------------------------------------------------------------
  // List row renderer
  // ---------------------------------------------------------------------------
  const renderProject: ListRenderItem<Project> = useCallback(
    ({ item }) => (
      <ProjectRow
        project={item}
        onOpen={() => handleOpen(item)}
        onRename={() => openRenameModal(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [handleOpen, openRenameModal, handleDelete],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bgTertiary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.bgPrimary, borderBottomColor: theme.colors.borderDefault }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            My boards
          </Text>
          {currentUser && (
            <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
              {currentUser.username}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onOpenSettings && (
            <Button label="⚙" variant="secondary" size="sm" onPress={onOpenSettings} />
          )}
          <Button label="Sign out" variant="secondary" size="sm" onPress={onLogout} />
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <Pressable
          style={[styles.errorBanner, { backgroundColor: theme.colors.error }]}
          onPress={clearError}
          accessibilityRole="alert"
        >
          <Text style={styles.errorBannerText}>{error} (tap to dismiss)</Text>
        </Pressable>
      )}

      {/* List */}
      {isLoading && projects.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProject}
          contentContainerStyle={[
            styles.listContent,
            projects.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No boards yet"
              subtitle="Create your first Kanban board to get started."
              actionLabel="New board"
              onAction={() => setShowCreate(true)}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      {projects.length > 0 && (
        <Pressable
          style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Create new board"
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}

      {/* Create modal */}
      <Modal
        visible={showCreate}
        onClose={() => { setShowCreate(false); setCreateName(''); setCreateError(null); }}
        title="New board"
      >
        <TextInput
          label="Board name"
          value={createName}
          onChangeText={(t) => { setCreateName(t); setCreateError(null); }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
          error={createError}
          containerStyle={styles.modalInput}
        />
        <Button
          label="Create"
          onPress={handleCreate}
          isLoading={isCreating}
          disabled={!createName.trim()}
          style={styles.modalButton}
        />
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={!!renamingProject}
        onClose={() => setRenamingProject(null)}
        title="Rename board"
      >
        <TextInput
          label="Board name"
          value={renameValue}
          onChangeText={(t) => { setRenameValue(t); setRenameError(null); }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleRename}
          error={renameError}
          containerStyle={styles.modalInput}
        />
        <Button
          label="Save"
          onPress={handleRename}
          isLoading={isRenaming}
          disabled={!renameValue.trim()}
          style={styles.modalButton}
        />
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ProjectRow sub-component
// ---------------------------------------------------------------------------

interface ProjectRowProps {
  project: Project;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ProjectRow({ project, onOpen, onRename, onDelete }: ProjectRowProps) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderDefault,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={onOpen}
        onLongPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Open board: ${project.name}`}
      >
        <View style={styles.rowLeft}>
          {/* Color accent stripe */}
          <View style={[styles.rowAccent, { backgroundColor: theme.colors.accent }]} />
          <View style={styles.rowText}>
            <Text
              style={[
                styles.rowTitle,
                { color: theme.colors.textPrimary, fontSize: theme.typography.fontSizeMd },
              ]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
            <Text
              style={[
                styles.rowDate,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSizeXs },
              ]}
            >
              Created {formatDate(project.createdAt)}
            </Text>
          </View>
        </View>
        <IconButton
          icon="⋯"
          accessibilityLabel={`Options for ${project.name}`}
          onPress={() => setMenuOpen(true)}
          size={20}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {/* Context menu */}
      <Modal
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={project.name}
      >
        <View style={styles.menuActions}>
          <Button
            label="Open board"
            variant="secondary"
            onPress={() => { setMenuOpen(false); onOpen(); }}
            style={styles.menuButton}
          />
          <Button
            label="Rename"
            variant="secondary"
            onPress={() => { setMenuOpen(false); onRename(); }}
            style={styles.menuButton}
          />
          <Button
            label="Delete"
            variant="destructive"
            onPress={() => { setMenuOpen(false); onDelete(); }}
            style={styles.menuButton}
          />
        </View>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, fontWeight: '400', marginTop: 2 },

  errorBanner:     { padding: 12, alignItems: 'center' },
  errorBannerText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listContent:      { padding: 16, gap: 12 },
  listContentEmpty: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 72,
    paddingRight: 12,
  },
  rowLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowText:   { flex: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 4 },
  rowTitle:  { fontWeight: '600', letterSpacing: -0.2 },
  rowDate:   { fontWeight: '400' },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 28, color: '#fff', lineHeight: 32 },

  modalInput:  { marginBottom: 16 },
  modalButton: { marginTop: 4 },

  menuActions: { gap: 10, paddingBottom: 8 },
  menuButton:  {},
});
