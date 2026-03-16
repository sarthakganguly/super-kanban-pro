/**
 * ImageProcessor tests
 *
 * Tests the pure helper functions: mimeToAttachmentType, mimeToExt.
 * processImage itself requires native modules (Canvas or image-resizer)
 * and is tested via manual QA.
 */

import { mimeToAttachmentType, mimeToExt } from '../attachment/ImageProcessor';

describe('mimeToAttachmentType', () => {
  it('classifies image types', () => {
    expect(mimeToAttachmentType('image/jpeg')).toBe('image');
    expect(mimeToAttachmentType('image/png')).toBe('image');
    expect(mimeToAttachmentType('image/webp')).toBe('image');
    expect(mimeToAttachmentType('image/heic')).toBe('image');
  });

  it('classifies pdf', () => {
    expect(mimeToAttachmentType('application/pdf')).toBe('pdf');
  });

  it('classifies audio types', () => {
    expect(mimeToAttachmentType('audio/mpeg')).toBe('audio');
    expect(mimeToAttachmentType('audio/mp4')).toBe('audio');
    expect(mimeToAttachmentType('audio/wav')).toBe('audio');
  });

  it('classifies plain text', () => {
    expect(mimeToAttachmentType('text/plain')).toBe('txt');
  });

  it('classifies markdown', () => {
    expect(mimeToAttachmentType('text/markdown')).toBe('md');
  });

  it('falls back to doc for unknown types', () => {
    expect(mimeToAttachmentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc');
    expect(mimeToAttachmentType('application/octet-stream')).toBe('doc');
  });
});

describe('mimeToExt', () => {
  const cases: [string, string][] = [
    ['image/jpeg',      'jpg'],
    ['image/png',       'png'],
    ['image/webp',      'webp'],
    ['image/gif',       'gif'],
    ['image/heic',      'heic'],
    ['application/pdf', 'pdf'],
    ['audio/mpeg',      'mp3'],
    ['audio/mp4',       'm4a'],
    ['audio/wav',       'wav'],
    ['audio/ogg',       'ogg'],
    ['text/plain',      'txt'],
    ['text/markdown',   'md'],
  ];

  it.each(cases)('maps %s → %s', (mime, ext) => {
    expect(mimeToExt(mime)).toBe(ext);
  });

  it('returns "bin" for unknown mime types', () => {
    expect(mimeToExt('application/octet-stream')).toBe('bin');
    expect(mimeToExt('application/x-custom')).toBe('bin');
  });
});
