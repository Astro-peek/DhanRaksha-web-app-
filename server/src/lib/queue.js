/**
 * SafeKosh Dual-Mode Job Queue
 *
 * Production  → BullMQ backed by Upstash Redis (UPSTASH_REDIS_URL set)
 * Local Dev   → Lightweight in-process async runner (no Redis required)
 *
 * Usage:
 *   import { enqueue, registerWorker } from '../lib/queue.js';
 *   await enqueue('generate_certificate', { userId, certId });
 *   registerWorker('generate_certificate', async (job) => { ... });
 */

import { EventEmitter } from 'events';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const USE_REAL_QUEUE = !!(REDIS_URL && !REDIS_URL.includes('name.upstash.io'));

// ────────────────────────────────────────────────────
// IN-PROCESS MOCK QUEUE (local dev fallback)
// ────────────────────────────────────────────────────

class MockQueue extends EventEmitter {
  constructor() {
    super();
    this._handlers = new Map();
    this.setMaxListeners(50);
  }

  registerHandler(name, fn) {
    this._handlers.set(name, fn);
  }

  async add(name, data, opts = {}) {
    const delay = opts.delay || 0;
    const jobId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const job = { id: jobId, name, data };

    setTimeout(async () => {
      const handler = this._handlers.get(name);
      if (!handler) {
        console.warn(`[MockQueue] No handler registered for job "${name}"`);
        return;
      }
      try {
        console.info(`[MockQueue] ▶  Running job "${name}" (id: ${jobId})`);
        await handler(job);
        console.info(`[MockQueue] ✓  Job "${name}" (id: ${jobId}) completed`);
      } catch (err) {
        console.error(`[MockQueue] ✗  Job "${name}" (id: ${jobId}) failed:`, err.message);
      }
    }, delay);

    return job;
  }
}

// ────────────────────────────────────────────────────
// REAL BULLMQ QUEUE (production)
// ────────────────────────────────────────────────────

let _queue = null;
let _workers = new Map();

async function _initBullMQ() {
  try {
    const { Queue, Worker } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');

    const connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith('rediss://') ? {} : undefined
    });

    _queue = new Queue('safekosh', { connection });
    console.info('[BullMQ] ✓ Queue connected to Upstash Redis');
    return { Queue, Worker, connection };
  } catch (err) {
    console.error('[BullMQ] Failed to initialise queue — falling back to MockQueue:', err.message);
    return null;
  }
}

// ────────────────────────────────────────────────────
// Singleton mock (used when Redis not available)
// ────────────────────────────────────────────────────

const _mockQueue = new MockQueue();
let _bullMQCtx = null;

if (USE_REAL_QUEUE) {
  _initBullMQ().then(ctx => { _bullMQCtx = ctx; });
} else {
  console.info('[Queue] UPSTASH_REDIS_URL absent — using in-process MockQueue');
}

// ────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────

/**
 * Enqueue a named job with a data payload.
 * @param {string} name  - Job name (e.g. 'generate_certificate')
 * @param {object} data  - Arbitrary serialisable payload
 * @param {object} opts  - Optional: { delay: ms, attempts: n }
 */
export async function enqueue(name, data, opts = {}) {
  if (USE_REAL_QUEUE && _queue) {
    return _queue.add(name, data, {
      attempts: opts.attempts || 3,
      backoff: { type: 'exponential', delay: 1000 },
      ...opts
    });
  }
  return _mockQueue.add(name, data, opts);
}

/**
 * Register a worker handler for a named job type.
 * Must be called at server startup before any jobs are enqueued.
 * @param {string}   name    - Job name to handle
 * @param {Function} handler - async (job) => void
 */
export function registerWorker(name, handler) {
  if (USE_REAL_QUEUE) {
    // Store for later when BullMQ connection resolves
    _workers.set(name, handler);

    // If BullMQ is already initialised, spin up worker immediately
    if (_bullMQCtx) {
      const { Worker, connection } = _bullMQCtx;
      new Worker('safekosh', async (job) => {
        if (job.name === name) return handler(job);
      }, { connection });
    } else {
      // Retry after connection resolves (up to 10 seconds)
      const interval = setInterval(() => {
        if (_bullMQCtx) {
          const { Worker, connection } = _bullMQCtx;
          new Worker('safekosh', async (job) => {
            if (job.name === name) return handler(job);
          }, { connection });
          clearInterval(interval);
        }
      }, 1000);
      setTimeout(() => clearInterval(interval), 10000);
    }
  } else {
    _mockQueue.registerHandler(name, handler);
  }
}
