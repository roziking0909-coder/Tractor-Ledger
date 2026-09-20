/**
 * Tractor Ledger — Format Utilities
 * 
 * Indian number formatting (₹1,23,456), date formatting, phone formatting.
 * All amounts use the Indian numbering system (lakhs, crores).
 */

/**
 * Format a number in Indian currency format: ₹1,23,456
 * Indian system: last 3 digits, then groups of 2
 */
export function formatIndianCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0';
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Split into integer and decimal parts
  const parts = absNum.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Apply Indian grouping: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    // Group remaining digits in pairs from right
    const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = `${grouped},${lastThree}`;
  }

  // Remove .00 for whole numbers
  const formatted = decPart === '00' ? intPart : `${intPart}.${decPart}`;
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Format a number in Indian currency format without the ₹ symbol
 */
export function formatIndianNumber(amount: number | string | null | undefined): string {
  const formatted = formatIndianCurrency(amount);
  return formatted.replace('₹', '').replace('-₹', '-');
}

/**
 * Format date for display: "11 Jun 2025"
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format date for short display: "11 Jun"
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}`;
}

/**
 * Format date for SQL/storage: "2025-06-11"
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format phone number for display: "98765 43210"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle Indian 10-digit numbers
  const last10 = digits.slice(-10);
  if (last10.length === 10) {
    return `${last10.slice(0, 5)} ${last10.slice(5)}`;
  }
  
  return phone;
}

/**
 * Get phone number with country code for WhatsApp: "919876543210"
 */
export function getPhoneWithCountryCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  const last10 = digits.slice(-10);
  return `91${last10}`;
}

/**
 * Format quantity with unit: "5.0 acres" or "3.5 hours"
 */
export function formatQuantity(quantity: number | null | undefined, unit: string | null | undefined): string {
  if (!quantity) return '';
  const q = typeof quantity === 'number' ? quantity : parseFloat(String(quantity));
  if (isNaN(q)) return '';
  
  const formatted = q % 1 === 0 ? q.toString() : q.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get today's date as ISO string: "2025-06-11"
 */
export function getTodayISO(): string {
  return formatDateISO(new Date());
}

/**
 * Get relative time: "Today", "Yesterday", "3 days ago", etc.
 */
export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
