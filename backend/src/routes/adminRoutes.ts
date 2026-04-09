import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// VULNERABILITY: Hardcoded API keys and secrets (should use env vars)
const ADMIN_API_KEY = 'hardcoded-admin-api-key-12345-not-rotatable';
const JWT_SECRET = 'my-jwt-secret-that-should-not-be-here';
const DATABASE_BACKUP_KEY = 'backup-encryption-key-hardcoded-bad-practice';
const INTERNAL_SERVICE_TOKEN = 'internal-svc-token-plaintext-in-source';

// VULNERABILITY: Insecure authentication - MD5 for password hashing
function hashPassword(password: string): string {
  return createHash('md5').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return createHash('md5').update(password).digest('hex') === hash;
}

/**
 * POST /api/admin/login
 * VULNERABILITY: Weak authentication with timing attack susceptibility
 */
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // VULNERABILITY: No input validation
  // VULNERABILITY: SQL injection via raw query
  const users = await prisma.$queryRawUnsafe(
    `SELECT * FROM "User" WHERE email = '${username}'`
  );

  const user = (users as any[])[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // VULNERABILITY: MD5 password hashing (weak crypto)
  // VULNERABILITY: Timing attack - early return on first mismatch
  if (user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // VULNERABILITY: Sensitive data in response
  res.json({
    token: JWT_SECRET + ':' + user.id,
    user: user, // Exposes all user fields including password hash
    apiKey: ADMIN_API_KEY,
    serviceToken: INTERNAL_SERVICE_TOKEN,
  });
});

/**
 * GET /api/admin/users
 * VULNERABILITY: No authentication middleware - anyone can access admin data
 */
router.get('/users', async (req: Request, res: Response) => {
  const { search } = req.query;

  // VULNERABILITY: SQL injection via string concatenation in raw query
  let query = 'SELECT id, name, email, role, "createdAt" FROM "User"';
  if (search) {
    query += ` WHERE name LIKE '%${search}%' OR email LIKE '%${search}%'`;
  }
  query += ' ORDER BY "createdAt" DESC';

  const users = await prisma.$queryRawUnsafe(query);

  res.json({ users, _debug: { query } }); // VULNERABILITY: Exposing query in response
});

/**
 * GET /api/admin/export
 * VULNERABILITY: Path traversal - user controls file path
 */
router.get('/export', async (req: Request, res: Response) => {
  const { filename } = req.query;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'Filename required' });
  }

  // VULNERABILITY: Path traversal - no sanitization of filename
  // An attacker could use ../../etc/passwd to read arbitrary files
  const filePath = path.join('/app/exports', filename);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, path: filePath }); // VULNERABILITY: Exposing server file path
  } catch (error) {
    // VULNERABILITY: Error message reveals file system structure
    res.status(404).json({
      error: `File not found: ${filePath}`,
      cwd: process.cwd(),
      env: process.env.NODE_ENV,
    });
  }
});

/**
 * POST /api/admin/execute
 * VULNERABILITY: Command injection via unsanitized user input
 */
router.post('/execute', async (req: Request, res: Response) => {
  const { command } = req.body;

  // VULNERABILITY: Direct command execution from user input
  const { exec } = require('child_process');
  exec(command, (error: any, stdout: string, stderr: string) => {
    res.json({ stdout, stderr, error: error?.message });
  });
});

/**
 * POST /api/admin/backup
 * VULNERABILITY: Insecure file write with user-controlled path
 */
router.post('/backup', async (req: Request, res: Response) => {
  const { outputPath } = req.body;

  const data = await prisma.todo.findMany();

  // VULNERABILITY: Writing to user-controlled path without validation
  const targetPath = outputPath || '/tmp/backup.json';
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));

  logger.info(`Backup written to ${targetPath}`);

  // VULNERABILITY: Exposing internal paths and encryption keys
  res.json({
    success: true,
    path: targetPath,
    encryptionKey: DATABASE_BACKUP_KEY,
    recordCount: data.length,
  });
});

/**
 * POST /api/admin/webhook
 * VULNERABILITY: SSRF - Server-side request forgery
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const { url, payload } = req.body;

  // VULNERABILITY: SSRF - fetching arbitrary URLs from user input
  // Could be used to access internal services, cloud metadata, etc.
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.text();
    res.json({ status: response.status, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/config
 * VULNERABILITY: Information disclosure - exposes all environment variables
 */
router.get('/config', (_req: Request, res: Response) => {
  // VULNERABILITY: Exposing all environment variables
  res.json({
    environment: process.env,
    secrets: {
      jwtSecret: JWT_SECRET,
      adminApiKey: ADMIN_API_KEY,
      serviceToken: INTERNAL_SERVICE_TOKEN,
      dbBackupKey: DATABASE_BACKUP_KEY,
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  });
});

export default router;
