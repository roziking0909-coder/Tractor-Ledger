/**
 * Tractor Ledger — WhatsApp Deep Link Utility
 * 
 * Uses wa.me deep links for FREE WhatsApp notifications.
 * Tractor owner taps "Notify" → WhatsApp opens with pre-filled message → one tap to send.
 * No API key needed. No Meta account needed. Free forever.
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
 * Generate work completion notification message
 */
export function generateWorkMessage(
  farmerName: string,
  farmName: string,
  workType: string,
  amount: number,
  dueAmount: number
): string {
  return `Hello ${farmerName},

Work completed ✅
Farm: ${farmName}
Work: ${workType}
Amount Added: ${formatIndianCurrency(amount)}

Current Due: ${formatIndianCurrency(dueAmount)}

Thank you 🙏`;
}

/**
 * Generate payment received notification message
 */
export function generatePaymentMessage(
  farmerName: string,
  amount: number,
  remainingDue: number
): string {
  return `Hello ${farmerName},

Payment Received ✅
Amount: ${formatIndianCurrency(amount)}
Remaining Due: ${formatIndianCurrency(remainingDue)}

Thank you 🙏`;
}

/**
 * Generate monthly statement message
 */
export function generateStatementMessage(
  farmerName: string,
  month: string,
  totalWork: number,
  totalPaid: number,
  remainingDue: number
): string {
  return `Hello ${farmerName},

Monthly Statement — ${month}

Total Work: ${formatIndianCurrency(totalWork)}
Total Paid: ${formatIndianCurrency(totalPaid)}
Remaining Due: ${formatIndianCurrency(remainingDue)}

Please contact for any queries 🙏`;
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
  dueAmount: number
): Promise<boolean> {
  const message = generateWorkMessage(farmerName, farmName, workType, amount, dueAmount);
  return openWhatsApp(phone, message);
}

/**
 * Open WhatsApp with a payment notification
 */
export async function openPaymentNotification(
  phone: string,
  farmerName: string,
  amount: number,
  remainingDue: number
): Promise<boolean> {
  const message = generatePaymentMessage(farmerName, amount, remainingDue);
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
        'WhatsApp Not Found',
        'Please install WhatsApp to send notifications to farmers.',
        [{ text: 'OK' }]
      );
      return false;
    }
  } catch (error) {
    console.error('Failed to open WhatsApp:', error);
    Alert.alert(
      'Error',
      'Could not open WhatsApp. Please try again.',
      [{ text: 'OK' }]
    );
    return false;
  }
}
