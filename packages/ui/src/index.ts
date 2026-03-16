/**
 * @kanban/ui
 *
 * Shared React Native components used across mobile and web.
 */

// Theme
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export type { Theme } from './theme/tokens';

// Shared components
export { Button }      from './components/Button';
export { EmptyState }  from './components/EmptyState';
export { IconButton }  from './components/IconButton';
export { Modal }       from './components/Modal';
export { TextInput }   from './components/TextInput';
export type { ButtonProps }    from './components/Button';
export type { EmptyStateProps } from './components/EmptyState';
export type { IconButtonProps } from './components/IconButton';
export type { ModalProps }      from './components/Modal';
export type { TextInputProps }  from './components/TextInput';

// Navigation
export { AppNavigator } from './screens/AppNavigator';

// Auth screens
export { AuthGate }       from './screens/AuthGate';
export { LoginScreen }    from './screens/auth/LoginScreen';
export { RegisterScreen } from './screens/auth/RegisterScreen';
export type { LoginScreenProps }    from './screens/auth/LoginScreen';
export type { RegisterScreenProps } from './screens/auth/RegisterScreen';

// Project screens
export { ProjectListScreen } from './screens/projects/ProjectListScreen';
export type { ProjectListScreenProps } from './screens/projects/ProjectListScreen';

// Board screens
export { BoardScreen }      from './screens/board/BoardScreen';
export { CardDetailScreen } from './screens/board/CardDetailScreen';
export { SwimlaneColumn }   from './screens/board/components/SwimlaneColumn';
export { CardItem }         from './screens/board/components/CardItem';
export type { BoardScreenProps }      from './screens/board/BoardScreen';
export type { CardDetailScreenProps } from './screens/board/CardDetailScreen';
export type { SwimlaneColumnProps }   from './screens/board/components/SwimlaneColumn';
export type { CardItemProps }         from './screens/board/components/CardItem';

// Drag and drop
export { DragProvider, useDragContext } from './screens/board/drag/DragContext';
export { DragGhost }                    from './screens/board/drag/DragGhost';
export { DropZone }                     from './screens/board/drag/DropZone';
export { DraggableCardItem }            from './screens/board/drag/DraggableCardItem';
export { useDragDrop }                  from './screens/board/drag/useDragDrop';
export type { DragContextValue, DragState } from './screens/board/drag/DragContext';
export type { DropZoneProps }              from './screens/board/drag/DropZone';
export type { DraggableCardItemProps }     from './screens/board/drag/DraggableCardItem';
export type { UseDragDropReturn }          from './screens/board/drag/useDragDrop';

// Markdown components
export { MarkdownRenderer }  from './components/markdown/MarkdownRenderer';
export { MarkdownEditor }    from './components/markdown/MarkdownEditor';
export { MarkdownToolbar, applyToolbarAction, TOOLBAR_ACTIONS } from './components/markdown/MarkdownToolbar';
export type { MarkdownRendererProps } from './components/markdown/MarkdownRenderer';
export type { MarkdownEditorProps }   from './components/markdown/MarkdownEditor';
export type { MarkdownToolbarProps, ToolbarAction } from './components/markdown/MarkdownToolbar';

// Tag components
export { TagInput } from './components/tags/TagInput';
export type { TagInputProps } from './components/tags/TagInput';

// Attachment components
export { AttachmentList }   from './components/attachments/AttachmentList';
export { AttachmentPicker } from './components/attachments/AttachmentPicker';
export { AttachmentViewer } from './components/attachments/AttachmentViewer';
export type { AttachmentListProps }   from './components/attachments/AttachmentList';
export type { AttachmentPickerProps, PickedFile } from './components/attachments/AttachmentPicker';
export type { AttachmentViewerProps } from './components/attachments/AttachmentViewer';

// Settings components
export { SegmentedControl }   from './components/settings/SegmentedControl';
export { ColorPicker }        from './components/settings/ColorPicker';
export { SettingsRow, SettingsSection } from './components/settings/SettingsRow';
export type { SegmentOption, SegmentedControlProps } from './components/settings/SegmentedControl';
export type { ColorPickerProps }  from './components/settings/ColorPicker';
export type { SettingsRowProps, SettingsSectionProps } from './components/settings/SettingsRow';

// Settings screen
export { SettingsScreen } from './screens/settings/SettingsScreen';
export type { SettingsScreenProps } from './screens/settings/SettingsScreen';

// CachedThumbnail
export { CachedThumbnail } from './components/attachments/CachedThumbnail';
export type { CachedThumbnailProps } from './components/attachments/CachedThumbnail';

// PWA components
export { OfflineBanner }    from './components/pwa/OfflineBanner';
export { UpdatePrompt }     from './components/pwa/UpdatePrompt';
export { useOfflineStatus } from './components/pwa/useOfflineStatus';
export type { UpdatePromptProps } from './components/pwa/UpdatePrompt';
