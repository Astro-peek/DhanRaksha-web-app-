/**
 * Formats a number to Indian Rupee (INR) currency representation
 * with the '₹' symbol using the Indian numbering system (e.g., 1,00,000 instead of 100,000).
 * 
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted Indian Rupee string
 */
export function formatINR(amount) {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount) || numericAmount === null || numericAmount === undefined) {
    return '₹0.00';
  }

  // Format as INR currency
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numericAmount);
}

/**
 * Combines Tailwind CSS class names cleanly.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Safely convert unknown values into text suitable for React rendering.
 */
export function asDisplayText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
  }

  return fallback;
}

/**
 * Extract a user-safe error message from axios/supabase/native errors.
 */
export function getErrorMessage(error, fallback = 'Something went wrong.') {
  const candidate =
    error?.response?.data?.error ??
    error?.response?.data?.message ??
    error?.message ??
    error;

  const text = asDisplayText(candidate, '').trim();
  return text || fallback;
}
