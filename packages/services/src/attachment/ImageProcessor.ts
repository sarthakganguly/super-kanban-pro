/**
 * ImageProcessor
 *
 * Compresses images and generates thumbnails.
 *
 * Platform strategy:
 *   Web    — HTML5 Canvas API (built-in, no dependencies)
 *   Native — react-native-image-resizer (native module for hardware acceleration)
 *
 * Thumbnail spec:
 *   - Max dimension: 200×200px
 *   - Format: JPEG
 *   - Quality: 70%
 *   - Used in board card preview (Phase 11 adds caching)
 *
 * Full image spec:
 *   - Max dimension: configurable (default from UserConfig.imageMaxSizeMb → ~2MB)
 *   - Format: JPEG (converted from PNG/HEIC/WEBP)
 *   - Quality: 85%
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessedImage {
  /** Full-size compressed image as Blob (web) or temp file path (native) */
  data:          Blob | string;
  /** Thumbnail as Blob (web) or temp file path (native) */
  thumbnail:     Blob | string;
  width:         number;
  height:        number;
  sizeBytes:     number;
  thumbnailSizeBytes: number;
  mimeType:      string;
}

export interface ImageProcessorOptions {
  /** Max width/height of the full-size image in pixels */
  maxDimension?:    number;
  /** JPEG quality 0–100 for full image */
  quality?:         number;
  /** Max dimension for thumbnails */
  thumbnailSize?:   number;
  /** JPEG quality for thumbnails */
  thumbnailQuality?: number;
}

const DEFAULTS: Required<ImageProcessorOptions> = {
  maxDimension:    1920,
  quality:         85,
  thumbnailSize:   200,
  thumbnailQuality: 70,
};

// ---------------------------------------------------------------------------
// Web implementation — Canvas API
// ---------------------------------------------------------------------------

async function processImageWeb(
  file: File,
  opts: Required<ImageProcessorOptions>,
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const { width: origW, height: origH } = bitmap;

  // Calculate scaled dimensions preserving aspect ratio
  const scale     = Math.min(1, opts.maxDimension / Math.max(origW, origH));
  const width     = Math.round(origW * scale);
  const height    = Math.round(origH * scale);
  const thumbScale = Math.min(1, opts.thumbnailSize / Math.max(width, height));
  const thumbW    = Math.round(width  * thumbScale);
  const thumbH    = Math.round(height * thumbScale);

  // Full-size canvas
  const canvas    = document.createElement('canvas');
  canvas.width    = width;
  canvas.height   = height;
  const ctx       = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Thumbnail canvas
  const tCanvas   = document.createElement('canvas');
  tCanvas.width   = thumbW;
  tCanvas.height  = thumbH;
  const tCtx      = tCanvas.getContext('2d')!;
  tCtx.drawImage(bitmap, 0, 0, thumbW, thumbH);

  bitmap.close();

  // Convert to blobs
  const fullBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      opts.quality / 100,
    );
  });

  const thumbBlob = await new Promise<Blob>((resolve, reject) => {
    tCanvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas thumbnail failed')),
      'image/jpeg',
      opts.thumbnailQuality / 100,
    );
  });

  return {
    data:               fullBlob,
    thumbnail:          thumbBlob,
    width,
    height,
    sizeBytes:          fullBlob.size,
    thumbnailSizeBytes: thumbBlob.size,
    mimeType:           'image/jpeg',
  };
}

// ---------------------------------------------------------------------------
// Native implementation — react-native-image-resizer
// ---------------------------------------------------------------------------

async function processImageNative(
  sourcePath: string,
  opts: Required<ImageProcessorOptions>,
): Promise<ProcessedImage> {
  // Lazy import — only resolved on native builds
  const ImageResizer = (await import('@bam.tech/react-native-image-resizer')).default;

  const full = await ImageResizer.createResizedImage(
    sourcePath,
    opts.maxDimension,
    opts.maxDimension,
    'JPEG',
    opts.quality,
    0,           // rotation
    undefined,   // output path (use temp dir)
    false,       // keep metadata
    { mode: 'contain', onlyScaleDown: true },
  );

  const thumb = await ImageResizer.createResizedImage(
    sourcePath,
    opts.thumbnailSize,
    opts.thumbnailSize,
    'JPEG',
    opts.thumbnailQuality,
    0,
    undefined,
    false,
    { mode: 'contain', onlyScaleDown: true },
  );

  return {
    data:               full.path,
    thumbnail:          thumb.path,
    width:              full.width,
    height:             full.height,
    sizeBytes:          full.size,
    thumbnailSizeBytes: thumb.size,
    mimeType:           'image/jpeg',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Processes an image: compresses it and generates a thumbnail.
 *
 * @param source - File object (web) or absolute path string (native)
 * @param opts   - Compression options
 */
export async function processImage(
  source: File | string,
  opts: ImageProcessorOptions = {},
): Promise<ProcessedImage> {
  const resolved = { ...DEFAULTS, ...opts };

  if (Platform.OS === 'web') {
    if (!(source instanceof File)) {
      throw new Error('Web platform requires a File object');
    }
    return processImageWeb(source, resolved);
  } else {
    if (typeof source !== 'string') {
      throw new Error('Native platform requires a file path string');
    }
    return processImageNative(source, resolved);
  }
}

/**
 * Determines the attachment type from a MIME type string.
 */
export function mimeToAttachmentType(
  mime: string,
): 'image' | 'pdf' | 'doc' | 'txt' | 'md' | 'audio' {
  if (mime.startsWith('image/'))       return 'image';
  if (mime === 'application/pdf')      return 'pdf';
  if (mime.startsWith('audio/'))       return 'audio';
  if (mime === 'text/plain')           return 'txt';
  if (mime === 'text/markdown')        return 'md';
  return 'doc';
}

/**
 * Returns the file extension for a MIME type.
 */
export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg':       'jpg',
    'image/png':        'png',
    'image/webp':       'webp',
    'image/gif':        'gif',
    'image/heic':       'heic',
    'application/pdf':  'pdf',
    'audio/mpeg':       'mp3',
    'audio/mp4':        'm4a',
    'audio/wav':        'wav',
    'audio/ogg':        'ogg',
    'text/plain':       'txt',
    'text/markdown':    'md',
  };
  return map[mime] ?? 'bin';
}
