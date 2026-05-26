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
