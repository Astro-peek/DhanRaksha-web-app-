import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: { rejectUnauthorized: false }
});

export const certificateQueue = new Queue('certificate-generation', { connection });
export const notificationQueue = new Queue('notifications', { connection });
export const auctionQueue = new Queue('auction-management', { connection });
export const dailyResetQueue = new Queue('daily-reset', { connection });

// Schedule the daily reset repeating cron job
dailyResetQueue.add('reset', {}, {
  repeat: { cron: '0 18 * * *' } // 11:30 PM IST (UTC+5:30)
}).catch(err => {
  console.error('[DailyResetQueue] Failed to schedule repeating reset job:', err.message);
});
