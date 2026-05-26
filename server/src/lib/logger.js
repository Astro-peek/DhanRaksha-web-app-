import winston from 'winston';

// Sensitive keys matching regex
const SENSITIVE_KEYS_REGEX = /password|token|private_key|deployer_private_key|aadhaar|upi_id|pin|otp|secret|signature|key|authorization|cookie|cvv/i;

/**
 * Deeply clones and masks sensitive keys and patterns (Aadhaar, UPI ID) from logs.
 */
export function maskSensitiveData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // 12-digit Aadhaar pattern
    let masked = data.replace(/\b\d{12}\b/g, '********XXXX');
    // Aadhaar spaced format: 1234 5678 9012
    masked = masked.replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, '**** **** XXXX');
    // UPI ID pattern: user@provider
    masked = masked.replace(/\b[\w.\-]+@[\w\-]+\b/g, 'XXXX@XXXX');
    return masked;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  if (typeof data === 'object') {
    const maskedObj = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS_REGEX.test(key)) {
        maskedObj[key] = '[MASKED]';
      } else {
        maskedObj[key] = maskSensitiveData(value);
      }
    }
    return maskedObj;
  }

  return data;
}

// Winston custom formatting to apply masking to log arguments
const maskFormat = winston.format(info => {
  const maskedInfo = { ...info };
  if (maskedInfo.message) {
    maskedInfo.message = maskSensitiveData(maskedInfo.message);
  }
  // Mask metadata properties
  for (const key of Object.keys(maskedInfo)) {
    if (key !== 'level' && key !== 'message' && key !== 'timestamp') {
      maskedInfo[key] = maskSensitiveData(maskedInfo[key]);
    }
  }
  return maskedInfo;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    maskFormat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
      )
    })
  ]
});

/**
 * Express middleware to log incoming API requests.
 */
export function requestLoggerMiddleware(req, res, next) {
  const start = process.hrtime();
  const path = req.originalUrl || req.url;
  const method = req.method;

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const status = res.statusCode;
    const userId = req.user?.id || 'anonymous';

    const logPayload = {
      method,
      path,
      status,
      durationMs: parseFloat(durationMs),
      userId
    };

    // Log request body and query only in dev or if status is error
    if (process.env.NODE_ENV !== 'production' || status >= 400) {
      if (req.body && Object.keys(req.body).length > 0) {
        logPayload.body = req.body;
      }
      if (req.query && Object.keys(req.query).length > 0) {
        logPayload.query = req.query;
      }
    }

    if (status >= 500) {
      logger.error(`API Request Failed: ${method} ${path}`, logPayload);
    } else if (status >= 400) {
      logger.warn(`API Request Warning: ${method} ${path}`, logPayload);
    } else {
      logger.info(`API Request: ${method} ${path}`, logPayload);
    }
  });

  next();
}

export default logger;
