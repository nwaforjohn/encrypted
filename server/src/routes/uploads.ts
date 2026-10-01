import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { requireAuth } from '../auth/middleware';
import { env } from '../env';

/**
 * Image & video upload via multipart/form-data (field name: "file").
 *
 * Files are written to a local uploads directory and served statically (see
 * index.ts). This keeps the app self-contained for the MVP. On an ephemeral
 * host (e.g. Render's default disk) uploads don't survive a redeploy — for
 * production, stream the file to S3 / Cloudinary / R2 and return that URL
 * instead. The client and the rest of the pipeline only care about the
 * returned { url, mediaType }.
 */

export const uploadsDir = env.uploadsDir || join(__dirname, '..', '..', 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// mime type -> file extension, and whether it's a video.
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB (short videos).

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = EXT[file.mimetype] ?? 'bin';
    cb(null, `${Date.now()}_${randomBytes(8).toString('hex')}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype in EXT);
  },
});

/** Resolve the public base URL for building absolute file URLs. */
function baseUrl(req: { headers: Record<string, unknown>; protocol: string }): string {
  if (env.publicUrl) return env.publicUrl.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http');
  const host = String(req.headers['host'] ?? 'localhost');
  return `${proto}://${host}`;
}

export const uploadsRouter = Router();

uploadsRouter.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const message =
        (err as { code?: string }).code === 'LIMIT_FILE_SIZE'
          ? 'file too large (max 100 MB)'
          : 'upload failed';
      res.status(400).json({ error: message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'no file (use multipart field "file")' });
      return;
    }
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.json({ url: `${baseUrl(req)}/uploads/${req.file.filename}`, mediaType });
  });
});
