import crypto from 'node:crypto';

/**
 * Good Pets - Paystack API Client Module
 *
 * Implements Paystack official transaction API integration (test mode).
 * Adheres strictly to PRD Section 7 (FR-014, FR-015, FR-016), Section 8 (BR-015, BR-017, BR-044),
 * and security rules (secrets server-only, constant-time HMAC comparison, timeout safety).
 */

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds per PRD FR-014

export interface InitializePaymentParams {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  channels?: ('card' | 'bank_transfer')[];
  metadata?: Record<string, any>;
}

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyData {
  id: number;
  domain: string;
  status: string; // 'success', 'failed', 'abandoned'
  reference: string;
  amount: number; // in kobo
  gateway_response: string;
  paid_at: string | null;
  created_at: string;
  channel: string;
  currency: string;
  metadata?: {
    bookingId?: string;
    bookingReference?: string;
    customerId?: string;
    [key: string]: any;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: PaystackVerifyData;
}

/**
 * Returns the Paystack secret key from environment variables.
 * Throws a clean, safe server error if not configured.
 */
export function getPaystackSecretKey(): string {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in server environment variables.');
  }
  return secretKey;
}

/**
 * Verifies Paystack webhook signature using HMAC-SHA512 with constant-time equality check.
 * Security rule 10 & PRD FR-016.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !rawBody) return false;

  try {
    const secret = getPaystackSecretKey();
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    const expectedBuffer = Buffer.from(hash, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (error) {
    console.error('Error verifying Paystack webhook signature:', error);
    return false;
  }
}

/**
 * Initializes a transaction on Paystack hosted checkout.
 * Per PRD FR-014 & BR-017, amount is in integer kobo, currency is strictly NGN.
 */
export async function initializePaystackTransaction(
  params: InitializePaymentParams
): Promise<PaystackInitResponse> {
  // Test mock support for automated test runs without network dependency
  if (process.env.PAYSTACK_MOCK_MODE === 'true') {
    return {
      authorization_url: `https://checkout.paystack.com/mock-${encodeURIComponent(params.reference)}`,
      access_code: `mock_code_${Buffer.from(params.reference).toString('base64url').substring(0, 10)}`,
      reference: params.reference,
    };
  }

  const secret = getPaystackSecretKey();

  const body: Record<string, any> = {
    email: params.email,
    amount: params.amountKobo,
    currency: 'NGN',
    reference: params.reference,
    metadata: params.metadata,
  };

  if (params.callbackUrl) {
    body.callback_url = params.callbackUrl;
  }

  if (params.channels && params.channels.length > 0) {
    body.channels = params.channels;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Paystack payment initialization failed');
    }

    return data.data as PaystackInitResponse;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Paystack initialization request timed out after 10 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verifies transaction directly with Paystack API.
 * PRD FR-015, FR-016 & BR-015.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResponse> {
  // Test mock support for automated test runs without network dependency
  if (process.env.PAYSTACK_MOCK_MODE === 'true') {
    if (reference.includes('FAILTEST')) {
      return {
        status: true,
        message: 'Verification successful',
        data: {
          id: 999904,
          domain: 'test',
          status: 'failed',
          reference,
          amount: 500000,
          gateway_response: 'Declined by issuer',
          channel: 'card',
          currency: 'NGN',
          paid_at: null,
          created_at: new Date().toISOString(),
        },
      };
    }
    return {
      status: true,
      message: 'Verification successful',
      data: {
        id: 999999,
        domain: 'test',
        status: 'success',
        reference,
        amount: 500000,
        gateway_response: 'Successful',
        channel: 'card',
        currency: 'NGN',
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    };
  }

  const secret = getPaystackSecretKey();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Paystack transaction verification failed');
    }

    return data as PaystackVerifyResponse;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Paystack verification request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
