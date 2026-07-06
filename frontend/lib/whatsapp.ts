/**
 * Tractor Ledger — WhatsApp Deep Link Utility
 * 
 * Uses wa.me deep links for FREE WhatsApp notifications.
 * Tractor owner taps "Notify" → WhatsApp opens with pre-filled message → one tap to send.
 * No API key needed. No Meta account needed. Free forever.
 * 
 * All messages in Gujarati.
 */

import { Linking, Alert } from 'react-native';
import { formatIndianCurrency } from './format';

/**
 * Generate a wa.me deep link URL
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  // Ensure phone has country code (India = 91)
  const digits = phone.replace(/\D/g, '');
  const fullPhone = digits.startsWith('91') && digits.length === 12
    ? digits
    : `91${digits.slice(-10)}`;
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
}

/**
 * Generate work completion notification message (Gujarati)
 */
export function generateWorkMessage(
  farmerName: string,
  farmName: string,
  workType: string,
  amount: number,
  dueAmount: number,
  discountAmount: number = 0
): string {
  if (discountAmount > 0) {
    const netAmount = amount - discountAmount;
    return `નમસ્તે ${farmerName},

કામ પૂર્ણ ✅
ખેતર: ${farmName}
કામ: ${workType}
મૂળ રકમ: ${formatIndianCurrency(amount)}
ડિસ્કાઉન્ટ: -${formatIndianCurrency(discountAmount)}
ચૂકવવાની રકમ: ${formatIndianCurrency(netAmount)}

હાલની બાકી: ${formatIndianCurrency(dueAmount)}

આભાર 🙏`;
  }
  return `નમસ્તે ${farmerName},

કામ પૂર્ણ ✅
ખેતર: ${farmName}
કામ: ${workType}
રકમ: ${formatIndianCurrency(amount)}

બાકી રકમ: ${formatIndianCurrency(dueAmount)}

આભાર 🙏`;
}

/**
 * Generate payment received notification message (Gujarati)
 */
export function generatePaymentMessage(
  farmerName: string,
  amount: number,
  remainingDue: number,
  discountAmount: number = 0
): string {
  if (discountAmount > 0) {
    const totalBenefit = amount + discountAmount;
    return `નમસ્તે ${farmerName},

ચૂકવણી મળી ✅
ચૂકવ્યું: ${formatIndianCurrency(amount)}
ડિસ્કાઉન્ટ: ${formatIndianCurrency(discountAmount)}
કુલ લાભ: ${formatIndianCurrency(totalBenefit)}

બાકી રકમ: ${formatIndianCurrency(remainingDue)}

આભાર 🙏`;
  }
  return `નમસ્તે ${farmerName},

ચૂકવણી મળી ✅
રકમ: ${formatIndianCurrency(amount)}
બાકી રકમ: ${formatIndianCurrency(remainingDue)}

આભાર 🙏`;
}

/**
 * Generate monthly statement message (Gujarati)
 */
export function generateStatementMessage(
  farmerName: string,
  month: string,
  totalWork: number,
  totalPaid: number,
  remainingDue: number
): string {
  return `નમસ્તે ${farmerName},

માસિક હિસાબ — ${month}

કુલ કામ: ${formatIndianCurrency(totalWork)}
કુલ ચૂકવ્યું: ${formatIndianCurrency(totalPaid)}
બાકી રકમ: ${formatIndianCurrency(remainingDue)}

કોઈ સવાલ હોય તો સંપર્ક કરો 🙏`;
}

/**
 * Open WhatsApp with a work notification
 */
export async function openWorkNotification(
  phone: string,
  farmerName: string,
  farmName: string,
  workType: string,
  amount: number,
  dueAmount: number,
  discountAmount: number = 0
): Promise<boolean> {
  const message = generateWorkMessage(farmerName, farmName, workType, amount, dueAmount, discountAmount);
  return openWhatsApp(phone, message);
}

/**
 * Open WhatsApp with a payment notification
 */
export async function openPaymentNotification(
  phone: string,
  farmerName: string,
  amount: number,
  remainingDue: number,
  discountAmount: number = 0
): Promise<boolean> {
  const message = generatePaymentMessage(farmerName, amount, remainingDue, discountAmount);
  return openWhatsApp(phone, message);
}

/**
 * Open WhatsApp with a pre-filled message
 */
export async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  const url = generateWhatsAppLink(phone, message);
  
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      Alert.alert(
        'WhatsApp નથી',
        'ખેડૂતોને નોટિફિકેશન મોકલવા WhatsApp ઇન્સ્ટોલ કરો.',
        [{ text: 'ઠીક' }]
      );
      return false;
    }
  } catch (error) {
    console.error('Failed to open WhatsApp:', error);
    Alert.alert(
      'ભૂલ',
      'WhatsApp ખોલી શકાયું નથી. ફરી પ્રયાસ કરો.',
      [{ text: 'ઠીક' }]
    );
    return false;
  }
}
