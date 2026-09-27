export const MAX_MONEY = 10000000; // ₹1 Crore
export const MAX_QUANTITY = 1000000; // 10 Lakhs

export function isValidNumber(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined || value === '') return false;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(num) && !isNaN(num);
}

export function isValidMoney(value: number | string | null | undefined): boolean {
  if (!isValidNumber(value)) return false;
  const num = typeof value === 'string' ? parseFloat(value) : (value as number);
  return num >= 0 && num <= MAX_MONEY;
}

export function isValidQuantity(value: number | string | null | undefined): boolean {
  if (!isValidNumber(value)) return false;
  const num = typeof value === 'string' ? parseFloat(value) : (value as number);
  return num > 0 && num <= MAX_QUANTITY;
}

export function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  
  // Reject future dates (more than 1 day in the future to account for timezones)
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return false;
  
  return true;
}
