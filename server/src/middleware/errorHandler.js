import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Global Error Handling Middleware
 * Must be mounted as the last middleware in the Express application.
 */
export const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const status = err.status || 500;
  
  // Create a unique support lookup ID for the customer
  const requestId = crypto.randomUUID();

  // 1. Logging Logic
  if (!isProduction) {
    // Detailed local console logging during development
    console.error(`[Error] Request ID: ${requestId}`);
    console.error(`[Error] Path: ${req.method} ${req.path}`);
    console.error(err);
  } else {
    // Silent console logging in production + offload auditing to the database asynchronously
    console.error(`[Production Error] Request ID: ${requestId} - Code: ${err.code || 'INTERNAL_ERROR'} - Message: ${err.message}`);
    
    // Asynchronous background insertion into public.audit_log to avoid blocking HTTP threads
    supabaseAdmin.from('audit_log').insert({
      user_id: req.user?.id || null,
      action: 'SYSTEM_ERROR',
      table_name: 'api_server',
      new_data: {
        message: err.message,
        code: err.code || 'INTERNAL_ERROR',
        path: req.path,
        method: req.method,
        query: req.query,
        requestId
      },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null
    }).then(({ error }) => {
      if (error) {
        console.error('❌ Failed to write system exception details to Supabase audit log:', error);
      }
    }).catch(catchErr => {
      console.error('❌ Network failure writing exception audit logs:', catchErr);
    });
  }

  // 2. Respond to client with strict data filtering (never leak stacks)
  const userFriendlyMessage = status === 500
    ? 'An unexpected error occurred. Please contact support with your Request ID.'
    : err.message;

  return res.status(status).json({
    error: userFriendlyMessage,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    requestId
  });
};
