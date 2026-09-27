/**
 * Tractor Ledger — Phone Normalization Helper
 * 
 * Normalizes Indian mobile numbers into standard E.164 format (+91XXXXXXXXXX).
 * 
 * Logic:
 * - Removes spaces, dashes, and non-digits.
 * - If 10 digits: use as national number.
 * - If 11 digits and begins with 0: remove leading 0.
 * - If 12 digits and begins with 91: remove leading 91.
 * - Otherwise: reject.
 * - Ensures exactly 10 digits remaining.
 * - Ensures valid Indian mobile prefix (starts with 6, 7, 8, or 9).
 * - Returns `+91` + number if valid, or `null` if invalid.
 */

export function normalizeIndianPhoneNumber(input: string): string | null {
  if (!input) return null;

  // Remove non-digits (spaces, dashes, parens, letters, etc.)
  const digits = input.replace(/\D/g, '');

  let nationalNumber = '';

  if (digits.length === 10) {
    nationalNumber = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    nationalNumber = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    nationalNumber = digits.slice(2);
  } else {
    return null; // Invalid length or format
  }

  if (nationalNumber.length !== 10) {
    return null;
  }

  // Valid Indian mobile prefix: 6, 7, 8, or 9
  const firstDigit = nationalNumber.charAt(0);
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return null; // Invalid prefix
  }

  return `+91${nationalNumber}`;
}
