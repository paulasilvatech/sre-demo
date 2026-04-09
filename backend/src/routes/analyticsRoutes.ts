import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { trackEvent, trackMetric } from '../config/appInsights';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const router = Router();

/**
 * GET /api/analytics/process
 * PERFORMANCE: Synchronous file I/O blocking the event loop
 */
router.get('/process', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // PERFORMANCE: Synchronous file read blocks the event loop
  // This prevents Node.js from handling other requests during I/O
  const configPath = path.join(process.cwd(), 'config', 'analytics.json');
  let config: any = {};
  try {
    const rawConfig = fs.readFileSync(configPath, 'utf-8'); // BLOCKING!
    config = JSON.parse(rawConfig);
  } catch (e) {
    config = { defaultPeriod: 30, maxResults: 10000 };
  }

  // PERFORMANCE: Loading entire dataset without pagination
  const allTodos = await prisma.todo.findMany({
    include: {
      tags: true,
      metadata: true,
      project: true,
      assignee: true,
      comments: true,
      attachments: true,
    },
  });

  // PERFORMANCE: N+1 query pattern - fetching related data in a loop
  const enrichedTodos = [];
  for (const todo of allTodos) {
    // PERFORMANCE: Individual query for each todo's history
    const history = await prisma.todo.findMany({
      where: {
        projectId: todo.projectId,
        createdAt: { lt: todo.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // PERFORMANCE: Individual query for each todo's similar items
    const similar = await prisma.todo.findMany({
      where: {
        priority: todo.priority,
        completed: todo.completed,
        id: { not: todo.id },
      },
      take: 3,
    });

    enrichedTodos.push({
      ...todo,
      history,
      similar,
      // PERFORMANCE: Computing expensive operations in the loop
      titleHash: computeExpensiveHash(todo.title),
      descriptionAnalysis: analyzeText(todo.description || ''),
    });
  }

  const duration = Date.now() - startTime;
  logger.info(`Analytics processing took ${duration}ms for ${allTodos.length} items`);

  // PERFORMANCE: Returning massive uncompressed payload
  res.json({
    data: enrichedTodos,
    count: enrichedTodos.length,
    processingTime: `${duration}ms`,
    config,
  });
});

/**
 * GET /api/analytics/search
 * VULNERABILITY: ReDoS - Regular Expression Denial of Service
 */
router.get('/search', async (req: Request, res: Response) => {
  const { pattern } = req.query;

  if (!pattern || typeof pattern !== 'string') {
    return res.status(400).json({ error: 'Pattern required' });
  }

  // VULNERABILITY: ReDoS - catastrophic backtracking with evil regex
  // Input like "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" will hang the server
  const regex = new RegExp(`^(a+)+$`);
  const isValid = regex.test(pattern);

  // VULNERABILITY: Another ReDoS pattern
  const emailRegex = new RegExp(
    `^([a-zA-Z0-9])(([\-.]|[_]+)?([a-zA-Z0-9]+))*(@){1}[a-z0-9]+[.]{1}(([a-z]{2,3})|([a-z]{2,3}[.]{1}[a-z]{2,3}))$`
  );
  const isEmail = emailRegex.test(pattern);

  // VULNERABILITY: User-supplied regex - could be evil
  try {
    const userRegex = new RegExp(pattern, 'i');
    const todos = await prisma.todo.findMany();
    const matches = todos.filter(t => userRegex.test(t.title));

    res.json({
      pattern,
      isValid,
      isEmail,
      matches: matches.length,
      results: matches,
    });
  } catch (error: any) {
    res.status(400).json({ error: `Invalid regex: ${error.message}` });
  }
});

/**
 * POST /api/analytics/aggregate
 * RELIABILITY: Unhandled promise rejections and race conditions
 */
router.post('/aggregate', async (req: Request, res: Response) => {
  const { metrics } = req.body;

  // RELIABILITY: Fire-and-forget promises (no await, no catch)
  prisma.todo.count().then(count => {
    trackMetric('total_todos', count);
  });

  // RELIABILITY: Promise created but never awaited or caught
  const backgroundTask = new Promise((resolve, reject) => {
    setTimeout(() => {
      // This rejection will be unhandled
      reject(new Error('Background aggregation timeout'));
    }, 5000);
  });

  // RELIABILITY: Race condition - parallel writes to same resource
  const updatePromises = (metrics || []).map((metric: string) => {
    // No locking, no transaction - concurrent updates will clash
    return prisma.todo.updateMany({
      where: { priority: 'HIGH' },
      data: { description: `Last aggregated: ${new Date().toISOString()} - ${metric}` },
    });
  });

  // RELIABILITY: Promise.all fails fast - one failure kills all
  try {
    await Promise.all(updatePromises);
    res.json({ success: true, metricsProcessed: metrics?.length || 0 });
  } catch (error: any) {
    // RELIABILITY: Partial updates may have succeeded
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/external
 * RELIABILITY: No timeout on external HTTP calls
 */
router.get('/external', async (req: Request, res: Response) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }

  // RELIABILITY: No timeout - request can hang indefinitely
  // VULNERABILITY: SSRF - fetching arbitrary URLs
  try {
    const response = await fetch(url);
    const data = await response.text();

    // PERFORMANCE: No response size limit - could OOM the server
    res.json({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: data,
      size: data.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analytics/batch
 * PERFORMANCE: Unbounded batch processing
 */
router.post('/batch', async (req: Request, res: Response) => {
  const { items } = req.body;

  // PERFORMANCE: No limit on batch size - could process millions of items
  // RELIABILITY: No backpressure or rate limiting
  const results = [];

  for (const item of items || []) {
    try {
      // PERFORMANCE: Sequential processing instead of batched
      const todo = await prisma.todo.create({
        data: {
          title: item.title,
          description: item.description,
          priority: item.priority || 'MEDIUM',
        },
      });
      results.push({ id: todo.id, status: 'created' });
    } catch (error: any) {
      results.push({ title: item.title, status: 'failed', error: error.message });
    }
  }

  // PERFORMANCE: No streaming - accumulates all results in memory
  res.json({
    total: items?.length || 0,
    created: results.filter(r => r.status === 'created').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  });
});

/**
 * GET /api/analytics/memory-leak
 * RELIABILITY: Demonstrates memory leak patterns
 */
const leakyCache: Map<string, any> = new Map();
const eventListeners: Function[] = [];

router.get('/memory-leak', async (req: Request, res: Response) => {
  const { key, value } = req.query;

  // RELIABILITY: Growing cache with no eviction policy
  // Each request adds data that's never cleaned up
  leakyCache.set(
    `${key}-${Date.now()}`,
    {
      value,
      timestamp: new Date(),
      largePayload: Buffer.alloc(1024 * 100).toString('hex'), // 100KB per entry
    }
  );

  // RELIABILITY: Event listener leak - never cleaned up
  const listener = () => {
    console.log(`Event for ${key}`);
  };
  eventListeners.push(listener);
  process.on('message', listener);

  // RELIABILITY: Returning cache info without size control
  res.json({
    cacheSize: leakyCache.size,
    listenersCount: eventListeners.length,
    memoryUsage: process.memoryUsage(),
    approximateCacheSizeBytes: leakyCache.size * 100 * 1024,
  });
});

// PERFORMANCE: CPU-intensive computation on the main thread
function computeExpensiveHash(input: string): string {
  let hash = 0;
  // Deliberately slow hash computation
  for (let i = 0; i < 10000; i++) {
    for (let j = 0; j < input.length; j++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(j);
      hash |= 0;
    }
  }
  return hash.toString(16);
}

// PERFORMANCE: Inefficient text analysis
function analyzeText(text: string): any {
  const words = text.split(/\s+/);
  const frequency: Record<string, number> = {};

  // O(n²) algorithm when O(n) is possible
  for (const word of words) {
    let count = 0;
    for (const w of words) {
      if (w.toLowerCase() === word.toLowerCase()) {
        count++;
      }
    }
    frequency[word.toLowerCase()] = count;
  }

  return {
    wordCount: words.length,
    uniqueWords: Object.keys(frequency).length,
    frequency,
    averageWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length || 0,
  };
}

export default router;
