import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { trackEvent, trackMetric } from '../config/appInsights';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';          // CODE SMELL: Unused import
import { EventEmitter } from 'events'; // CODE SMELL: Unused import

const router = Router();

// CODE SMELL: Magic numbers without constants
const CACHE_TTL = 3600;
const MAX_RETRIES = 3;

// CODE SMELL: Unused variables
const DEBUG_MODE = true;
const TEMP_BUFFER_SIZE = 1024 * 1024;
const reportVersion = '2.1.0';
let lastReportGenerated: Date | null = null;
let reportCounter = 0;

/**
 * GET /api/reports/dashboard
 * CODE SMELL: God function - does too many things (high cyclomatic complexity)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { period, format, includeArchived, groupBy, sortBy, sortOrder, limit, offset, teamId, projectId, userId, priority, status, dateFrom, dateTo } = req.query;

  // CODE SMELL: Deeply nested conditionals (high complexity)
  let data: any = {};

  if (period === 'daily') {
    if (format === 'detailed') {
      if (includeArchived === 'true') {
        if (groupBy === 'project') {
          if (sortBy === 'count') {
            const todos = await prisma.todo.findMany({
              include: { project: true, tags: true, metadata: true, assignee: true },
              orderBy: { createdAt: 'desc' },
            });
            data.todos = todos;
            data.total = todos.length;
            data.archived = todos.filter((t: any) => t.completed).length;
            data.active = todos.filter((t: any) => !t.completed).length;
            data.byProject = {};
            for (const todo of todos) {
              const projectName = todo.project?.name || 'Unassigned';
              if (!data.byProject[projectName]) {
                data.byProject[projectName] = [];
              }
              data.byProject[projectName].push(todo);
            }
          } else {
            const todos = await prisma.todo.findMany({
              include: { project: true, tags: true },
              orderBy: { updatedAt: 'desc' },
            });
            data.todos = todos;
            data.total = todos.length;
          }
        } else if (groupBy === 'user') {
          const todos = await prisma.todo.findMany({
            include: { assignee: true, tags: true },
            orderBy: { createdAt: 'desc' },
          });
          data.todos = todos;
          data.total = todos.length;
          data.byUser = {};
          for (const todo of todos) {
            const userName = todo.assignee?.name || 'Unassigned';
            if (!data.byUser[userName]) {
              data.byUser[userName] = [];
            }
            data.byUser[userName].push(todo);
          }
        } else {
          const todos = await prisma.todo.findMany({
            include: { project: true, tags: true },
          });
          data.todos = todos;
          data.total = todos.length;
        }
      } else {
        const todos = await prisma.todo.findMany({
          where: { completed: false },
          include: { project: true },
        });
        data.todos = todos;
        data.total = todos.length;
      }
    } else {
      const todos = await prisma.todo.findMany({
        where: { completed: false },
      });
      data.todos = todos;
      data.total = todos.length;
    }
  } else if (period === 'weekly') {
    // CODE SMELL: Duplicated logic (same as daily but slightly different)
    if (format === 'detailed') {
      if (includeArchived === 'true') {
        const todos = await prisma.todo.findMany({
          include: { project: true, tags: true, metadata: true, assignee: true },
          orderBy: { createdAt: 'desc' },
        });
        data.todos = todos;
        data.total = todos.length;
        data.archived = todos.filter((t: any) => t.completed).length;
        data.active = todos.filter((t: any) => !t.completed).length;
      } else {
        const todos = await prisma.todo.findMany({
          where: { completed: false },
          include: { project: true },
        });
        data.todos = todos;
        data.total = todos.length;
      }
    } else {
      const todos = await prisma.todo.findMany({
        where: { completed: false },
      });
      data.todos = todos;
      data.total = todos.length;
    }
  } else {
    const todos = await prisma.todo.findMany();
    data.todos = todos;
    data.total = todos.length;
  }

  // CODE SMELL: Magic number
  if (data.total > 1000) {
    data.warning = 'Large dataset, consider pagination';
  }

  const duration = Date.now() - startTime;
  // CODE SMELL: Using console.log instead of logger
  console.log(`Dashboard report generated in ${duration}ms`);

  res.json(data);
});

/**
 * GET /api/reports/summary
 * CODE SMELL: Duplicated code (same patterns as dashboard)
 */
router.get('/summary', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // CODE SMELL: Duplicate of code above
  const todos = await prisma.todo.findMany({
    include: { project: true, tags: true, metadata: true, assignee: true },
    orderBy: { createdAt: 'desc' },
  });

  const total = todos.length;
  const completed = todos.filter((t: any) => t.completed).length;
  const active = todos.filter((t: any) => !t.completed).length;
  const highPriority = todos.filter((t: any) => t.priority === 'HIGH' || t.priority === 'URGENT').length;

  // CODE SMELL: Duplicate grouping logic
  const byProject: any = {};
  for (const todo of todos) {
    const projectName = todo.project?.name || 'Unassigned';
    if (!byProject[projectName]) {
      byProject[projectName] = [];
    }
    byProject[projectName].push(todo);
  }

  // CODE SMELL: Duplicate grouping logic (again!)
  const byUser: any = {};
  for (const todo of todos) {
    const userName = todo.assignee?.name || 'Unassigned';
    if (!byUser[userName]) {
      byUser[userName] = [];
    }
    byUser[userName].push(todo);
  }

  // CODE SMELL: Duplicate grouping logic (and again!)
  const byPriority: any = {};
  for (const todo of todos) {
    const priority = todo.priority || 'NONE';
    if (!byPriority[priority]) {
      byPriority[priority] = [];
    }
    byPriority[priority].push(todo);
  }

  const duration = Date.now() - startTime;
  console.log(`Summary generated in ${duration}ms`);

  res.json({
    total,
    completed,
    active,
    highPriority,
    completionRate: total > 0 ? (completed / total * 100).toFixed(2) : 0,
    byProject,
    byUser,
    byPriority,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * POST /api/reports/generate
 * CODE SMELL: Empty catch blocks, swallowed errors
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { type, options } = req.body;

  let report: any = {};

  try {
    const todos = await prisma.todo.findMany({
      include: { project: true },
    });
    report.data = todos;
  } catch (error) {
    // CODE SMELL: Empty catch block - error is completely swallowed
  }

  try {
    const users = await prisma.user.findMany();
    report.users = users;
  } catch (e) {
    // CODE SMELL: Empty catch block with different variable name
  }

  try {
    const projects = await prisma.project.findMany({
      include: { members: true },
    });
    report.projects = projects;
  } catch (err) {
    // CODE SMELL: Catching and logging but not handling
    console.log(err);
  }

  // CODE SMELL: Using var instead of const/let
  var reportId = crypto.randomUUID();
  var timestamp = new Date().toISOString();

  // CODE SMELL: String concatenation instead of template literals
  var reportName = 'report-' + type + '-' + timestamp + '-' + reportId;

  // CODE SMELL: Modifying outer scope variable from function
  reportCounter++;
  lastReportGenerated = new Date();

  console.log('Report generated: ' + reportName);

  res.json({
    id: reportId,
    name: reportName,
    type,
    ...report,
    generatedAt: timestamp,
    reportNumber: reportCounter,
  });
});

/**
 * GET /api/reports/metrics
 * CODE SMELL: Function too long, doing too many things
 */
router.get('/metrics', async (req: Request, res: Response) => {
  // Get all data first (CODE SMELL: fetching everything)
  const allTodos = await prisma.todo.findMany({ include: { project: true, assignee: true, metadata: true } });
  const allUsers = await prisma.user.findMany();
  const allProjects = await prisma.project.findMany({ include: { members: true } });

  // Calculate todo metrics
  const todoMetrics = {
    total: allTodos.length,
    completed: allTodos.filter(t => t.completed).length,
    pending: allTodos.filter(t => !t.completed).length,
    overdue: allTodos.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed).length,
    highPriority: allTodos.filter(t => t.priority === 'HIGH').length,
    urgentPriority: allTodos.filter(t => t.priority === 'URGENT').length,
    mediumPriority: allTodos.filter(t => t.priority === 'MEDIUM').length,
    lowPriority: allTodos.filter(t => t.priority === 'LOW').length,
    withProject: allTodos.filter(t => t.projectId !== null).length,
    withAssignee: allTodos.filter(t => t.assigneeId !== null).length,
    avgViewCount: allTodos.reduce((sum, t) => sum + (t.metadata?.viewCount || 0), 0) / allTodos.length || 0,
  };

  // Calculate user metrics (CODE SMELL: very similar pattern, should be extracted)
  const userMetrics = {
    total: allUsers.length,
    admins: allUsers.filter(u => u.role === 'ADMIN').length,
    developers: allUsers.filter(u => u.role === 'DEVELOPER').length,
    managers: allUsers.filter(u => u.role === 'MANAGER').length,
    designers: allUsers.filter(u => u.role === 'DESIGNER').length,
    qa: allUsers.filter(u => u.role === 'QA').length,
    activeLastWeek: allUsers.filter(u => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      return new Date(u.updatedAt) > lastWeek;
    }).length,
  };

  // Calculate project metrics (CODE SMELL: same repetitive pattern)
  const projectMetrics = {
    total: allProjects.length,
    active: allProjects.filter(p => p.status === 'ACTIVE').length,
    completed: allProjects.filter(p => p.status === 'COMPLETED').length,
    onHold: allProjects.filter(p => p.status === 'ON_HOLD').length,
    archived: allProjects.filter(p => p.status === 'ARCHIVED').length,
    avgMembers: allProjects.reduce((sum, p) => sum + (p.members?.length || 0), 0) / allProjects.length || 0,
  };

  // CODE SMELL: Returning excessively large response
  res.json({
    todoMetrics,
    userMetrics,
    projectMetrics,
    raw: {
      todos: allTodos,     // CODE SMELL: Including raw data in metrics response
      users: allUsers,
      projects: allProjects,
    },
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/reports/export
 * CODE SMELL: Inconsistent error handling patterns
 */
router.get('/export', async (req: Request, res: Response) => {
  const { format } = req.query;

  if (format == 'csv') {  // CODE SMELL: Loose equality (== instead of ===)
    try {
      const todos = await prisma.todo.findMany();
      let csv = 'id,title,completed,priority,createdAt\n';
      for (var i = 0; i < todos.length; i++) {  // CODE SMELL: var in for loop
        csv += todos[i].id + ',' + todos[i].title + ',' + todos[i].completed + ',' + todos[i].priority + ',' + todos[i].createdAt + '\n';
      }
      res.setHeader('Content-Type', 'text/csv');
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: 'Export failed' });
    }
  } else if (format == 'json') {  // CODE SMELL: Loose equality again
    const todos = await prisma.todo.findMany();
    res.json(todos);
  } else {
    // CODE SMELL: No proper error response for invalid format
    res.send('Invalid format');
  }
});

export default router;
