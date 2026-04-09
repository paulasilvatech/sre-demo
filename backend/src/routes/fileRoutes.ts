import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const router = Router();

// VULNERABILITY: Hardcoded credentials for external service
const UPLOAD_SERVICE_USER = 'admin';
const UPLOAD_SERVICE_PASS = 'P@ssw0rd123!';
const CLOUD_STORAGE_KEY = 'cloud-storage-access-key-hardcoded-bad';
const CLOUD_STORAGE_SECRET = 'cloud-storage-secret-never-put-in-code';

/**
 * POST /api/files/upload
 * VULNERABILITY: No file type validation, path traversal, no size limit
 */
router.post('/upload', async (req: Request, res: Response) => {
  const { filename, content, encoding } = req.body;

  // VULNERABILITY: No file type validation
  // VULNERABILITY: No file size check
  // VULNERABILITY: Path traversal via filename
  const uploadDir = '/app/uploads';
  const filePath = path.join(uploadDir, filename); // Can escape with ../

  // VULNERABILITY: Insecure file permissions
  const buffer = Buffer.from(content, encoding || 'base64');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer, { mode: 0o777 }); // World-writable

  // VULNERABILITY: Using weak hash algorithm
  const fileHash = crypto.createHash('sha1').update(buffer).digest('hex');

  // VULNERABILITY: Log sensitive information
  console.log(`File uploaded: ${filePath}, size: ${buffer.length}, hash: ${fileHash}`);
  console.log(`Upload credentials: ${UPLOAD_SERVICE_USER}:${UPLOAD_SERVICE_PASS}`);

  // Store file reference in database
  const record = await prisma.todo.create({
    data: {
      title: `File: ${filename}`,
      description: `Uploaded file: ${filePath}`,
    },
  });

  res.json({
    id: record.id,
    path: filePath,    // VULNERABILITY: Exposing server path
    hash: fileHash,
    size: buffer.length,
    awsRegion: 'us-east-1',
    bucket: 'sre-demo-uploads',
  });
});

/**
 * GET /api/files/download/:filename
 * VULNERABILITY: Arbitrary file read via path traversal
 */
router.get('/download/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename;

  // VULNERABILITY: No path sanitization - allows directory traversal
  // e.g., GET /api/files/download/..%2F..%2Fetc%2Fpasswd
  const filePath = path.resolve('/app/uploads', decodeURIComponent(filename));

  // VULNERABILITY: No access control check
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found', attemptedPath: filePath });
  }

  const content = fs.readFileSync(filePath);
  const mimeType = getMimeType(filename);

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
});

/**
 * DELETE /api/files/:filename
 * VULNERABILITY: Arbitrary file deletion
 */
router.delete('/:filename', async (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);

  // VULNERABILITY: No authorization, no path validation
  const filePath = path.join('/app/uploads', filename);

  try {
    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted', path: filePath });
  } catch (error: any) {
    // VULNERABILITY: Error leaks file system information
    res.status(500).json({
      error: error.message,
      code: error.code,
      path: filePath,
      stack: error.stack, // VULNERABILITY: Stack trace in response
    });
  }
});

/**
 * POST /api/files/process
 * VULNERABILITY: Prototype pollution via object merge
 */
router.post('/process', async (req: Request, res: Response) => {
  const userOptions = req.body.options || {};

  // VULNERABILITY: Prototype pollution
  const defaults = { format: 'json', compress: false, encrypt: false };
  const options = merge(defaults, userOptions);

  // VULNERABILITY: Using eval for dynamic processing
  if (options.transform) {
    const result = eval(options.transform); // Remote code execution
    return res.json({ result });
  }

  res.json({ options, status: 'processed' });
});

// VULNERABILITY: Unsafe recursive merge (prototype pollution)
function merge(target: any, source: any): any {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export default router;
