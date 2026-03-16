/**
 * useAttachments hook
 *
 * Manages attachment state for a single card.
 * Exposes add/delete/load operations backed by AttachmentService.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useDatabase } from '@kanban/database';
import { useCurrentUser } from '@kanban/store';
import type { Attachment } from '@kanban/types';
import { AttachmentError, AttachmentService } from './AttachmentService';

export interface UseAttachmentsReturn {
  attachments: Attachment[];
  isLoading:   boolean;
  isUploading: boolean;
  error:       string | null;
  clearError:  () => void;

  /** Add an image (File on web, path string on native) */
  addImage:  (source: File | string, filename: string) => Promise<void>;
  /** Add any non-image file */
  addFile:   (data: Blob | string, filename: string, mimeType: string) => Promise<void>;
  /** Delete an attachment by id */
  deleteAttachment: (id: string) => Promise<void>;
  /** Get a data: URI for an attachment's stored data */
  loadDataURL: (storageRef: string, mimeType: string) => Promise<string | null>;
}

export function useAttachments(cardId: string): UseAttachmentsReturn {
  const db          = useDatabase();
  const currentUser = useCurrentUser();

  const [attachments,  setAttachments]  = useState<Attachment[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isUploading,  setIsUploading]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Derive image max size from user config (default 2MB)
  const [imageMaxSizeMb, setImageMaxSizeMb] = useState(2);

  const svc = useRef<AttachmentService | null>(null);

  // Initialise service with user's image size preference
  useEffect(() => {
    if (!currentUser) return;
    db.users.findConfigByUserId(currentUser.id)
      .then((config) => {
        const maxMb = config?.imageMaxSizeMb ?? 2;
        setImageMaxSizeMb(maxMb);
        svc.current = new AttachmentService(db, {
          maxDimension: Math.round(Math.sqrt(maxMb * 1024 * 1024 * 3)), // rough px limit
          quality:      85,
        });
      })
      .catch(() => {
        svc.current = new AttachmentService(db);
      });
  }, [db, currentUser]);

  const getService = useCallback(() => {
    if (!svc.current) svc.current = new AttachmentService(db);
    return svc.current;
  }, [db]);

  const clearError = useCallback(() => setError(null), []);

  // Load attachments on mount
  useEffect(() => {
    setIsLoading(true);
    getService()
      .getAttachments(cardId)
      .then(setAttachments)
      .catch(() => setError('Failed to load attachments.'))
      .finally(() => setIsLoading(false));
  }, [cardId, getService]);

  const addImage = useCallback(
    async (source: File | string, filename: string) => {
      setIsUploading(true);
      setError(null);
      try {
        const attachment = await getService().addImage(cardId, source, filename);
        setAttachments((prev) => [...prev, attachment]);
      } catch (err) {
        setError(
          err instanceof AttachmentError
            ? err.message
            : 'Failed to add image.',
        );
      } finally {
        setIsUploading(false);
      }
    },
    [cardId, getService],
  );

  const addFile = useCallback(
    async (data: Blob | string, filename: string, mimeType: string) => {
      setIsUploading(true);
      setError(null);
      try {
        const attachment = await getService().addFile(cardId, data, filename, mimeType);
        setAttachments((prev) => [...prev, attachment]);
      } catch (err) {
        setError(
          err instanceof AttachmentError
            ? err.message
            : 'Failed to add file.',
        );
      } finally {
        setIsUploading(false);
      }
    },
    [cardId, getService],
  );

  const deleteAttachment = useCallback(
    async (id: string) => {
      setError(null);
      // Optimistic remove
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      try {
        await getService().deleteAttachment(id);
      } catch (err) {
        // Re-fetch on failure
        const fresh = await getService().getAttachments(cardId);
        setAttachments(fresh);
        setError('Failed to delete attachment.');
      }
    },
    [cardId, getService],
  );

  const loadDataURL = useCallback(
    (storageRef: string, mimeType: string) =>
      getService().loadAsDataURL(storageRef, mimeType),
    [getService],
  );

  return {
    attachments,
    isLoading,
    isUploading,
    error,
    clearError,
    addImage,
    addFile,
    deleteAttachment,
    loadDataURL,
  };
}
