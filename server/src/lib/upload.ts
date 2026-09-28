import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { env } from '../config/env';
import { shortCode } from '../utils/nano';

const UPLOAD_ROOT = path.resolve(process.cwd(), env.upload.dir);

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Local disk storage organised as uploads/<category>/<yyyy>/<mm>/<random>.<ext>.
 * No cloud services — everything lives under /uploads and is served statically.
 */
const storage: StorageEngine = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const category = (req as any).uploadCategory ?? 'misc';
    const now = new Date();
    const dir = path.join(UPLOAD_ROOT, category, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req: Request, file: Express.Multer.File, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '') || 'bin';
    cb(null, `${Date.now()}-${shortCode(10)}.${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const isMedia = ALLOWED.has(file.mimetype);
  const isCsv = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
  if (isMedia || isCsv) return cb(null, true);
  cb(new Error('Unsupported file type. Allowed: jpg, png, webp, gif, pdf, csv'));
}

export function uploader(fields = 10) {
  return multer({
    storage,
    fileFilter,
    limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024, files: fields },
  });
}

/** Sets the sub-folder used by the storage engine for this request. */
export function withCategory(category: string) {
  return (req: Request, _res: unknown, next: () => void) => {
    (req as any).uploadCategory = category;
    next();
  };
}

/** Returns a web-accessible URL (/uploads/...) from an absolute file path. */
export function toPublicUrl(absolutePath: string): string {
  const rel = path.relative(UPLOAD_ROOT, absolutePath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

export { UPLOAD_ROOT };
