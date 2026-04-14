import crypto from 'crypto';

export type GeideaLanguage = 'en' | 'ar';

export interface GeideaConfig {
  publicKey: string;
  apiPassword: string;
  sessionUrl: string;
  callbackUrl: string;
  returnUrl: string;
  checkoutScriptUrl: string;
}

export interface GeideaCallbackSummary {
  merchantReferenceId: string | null;
  orderId: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  responseCode: string | null;
  responseMessage: string | null;
  detailedResponseCode: string | null;
  detailedResponseMessage: string | null;
  reference: string | null;
  signature: string | null;
  timestamp: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGeideaConfig(): GeideaConfig {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('Missing required environment variable: APP_URL');
  }

  const normalizedAppUrl = appUrl.replace(/\/$/, '');

  return {
    publicKey: requireEnv('GEIDEA_PUBLIC_KEY'),
    apiPassword: requireEnv('GEIDEA_API_PASSWORD'),
    sessionUrl:
      process.env.GEIDEA_SESSION_URL ||
      process.env.GEIDEA_API_BASE_URL ||
      'https://api.merchant.geidea.net/payment-intent/api/v2/direct/session',
    callbackUrl:
      process.env.GEIDEA_CALLBACK_URL ||
      `${normalizedAppUrl}/api/payments/geidea/callback`,
    returnUrl:
      process.env.GEIDEA_RETURN_URL || `${normalizedAppUrl}/client/payment`,
    checkoutScriptUrl:
      process.env.NEXT_PUBLIC_GEIDEA_CHECKOUT_SCRIPT_URL ||
      'https://www.merchant.geidea.net/hpp/geideaCheckout.min.js',
  };
}

export function buildGeideaBasicAuth(publicKey: string, apiPassword: string): string {
  return `Basic ${Buffer.from(`${publicKey}:${apiPassword}`).toString('base64')}`;
}

export function formatGeideaAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

export function buildCreateSessionSignature(
  publicKey: string,
  amount: number,
  currency: string,
  merchantReferenceId: string,
  timestamp: string,
  apiPassword: string,
): string {
  // Geidea v2 field order: publicKey + amount + currency + timestamp + merchantReferenceId
  // HMAC-SHA256 keyed with apiPassword, base64-encoded.
  // If Geidea rejects with signature error, verify field order with the portal team.
  const data = `${publicKey}${formatGeideaAmount(amount)}${currency}${timestamp}${merchantReferenceId}`;
  return crypto.createHmac('sha256', apiPassword).update(data).digest('base64');
}

export function buildCallbackSignature(
  publicKey: string,
  amount: number,
  currency: string,
  orderId: string,
  status: string,
  merchantReferenceId: string,
  timestamp: string,
  apiPassword: string,
): string {
  const data = `${publicKey}${formatGeideaAmount(amount)}${currency}${orderId}${status}${merchantReferenceId}${timestamp}`;
  return crypto.createHmac('sha256', apiPassword).update(data).digest('base64');
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function extractGeideaCallbackSummary(payload: unknown): GeideaCallbackSummary {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const order = (root.order && typeof root.order === 'object' ? root.order : {}) as Record<string, unknown>;
  const codes = (order.codes && typeof order.codes === 'object' ? order.codes : root.codes && typeof root.codes === 'object' ? root.codes : {}) as Record<string, unknown>;

  return {
    merchantReferenceId:
      toNullableString(root.merchantReferenceId) ||
      toNullableString(order.merchantReferenceId) ||
      toNullableString(order.merchantReferenceID),
    orderId:
      toNullableString(root.orderId) ||
      toNullableString(order.orderId) ||
      toNullableString(order.id),
    amount: toNullableNumber(root.amount) ?? toNullableNumber(order.amount),
    currency: toNullableString(root.currency) || toNullableString(order.currency),
    status: toNullableString(root.status) || toNullableString(order.status),
    responseCode:
      toNullableString(root.responseCode) || toNullableString(codes.responseCode),
    responseMessage:
      toNullableString(root.responseMessage) || toNullableString(codes.responseMessage),
    detailedResponseCode:
      toNullableString(root.detailedResponseCode) ||
      toNullableString(root.detailResponseCode) ||
      toNullableString(codes.detailedResponseCode) ||
      toNullableString(codes.detailResponseCode),
    detailedResponseMessage:
      toNullableString(root.detailedResponseMessage) ||
      toNullableString(root.detailResponseMessage) ||
      toNullableString(codes.detailedResponseMessage) ||
      toNullableString(codes.detailResponseMessage),
    reference: toNullableString(root.reference) || toNullableString(order.reference),
    signature: toNullableString(root.signature) || toNullableString(order.signature),
    timestamp:
      toNullableString(root.timeStamp) ||
      toNullableString(root.timestamp) ||
      toNullableString(order.timeStamp) ||
      toNullableString(order.timestamp),
  };
}

export function isGeideaPaymentSuccessful(summary: GeideaCallbackSummary): boolean {
  // Primary gate: status must be "Success" (case-insensitive) AND responseCode must be "000".
  // detailedResponseCode is checked when present but exact message strings are not
  // relied upon — they vary by Geidea region and version.
  const statusOk =
    typeof summary.status === 'string' && summary.status.toLowerCase() === 'success';
  const codeOk = summary.responseCode === '000';
  const detailOk =
    !summary.detailedResponseCode ||
    summary.detailedResponseCode === '000' ||
    summary.detailedResponseCode.startsWith('000');
  return statusOk && codeOk && detailOk;
}

export function getGeideaLanguage(language: string | null | undefined): GeideaLanguage {
  return language === 'ar' ? 'ar' : 'en';
}
