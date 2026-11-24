import crypto from 'node:crypto';
import dns from 'node:dns';

// Ensure IPv4 is prioritized to prevent EDNS/IPv6 lookup timeouts on Windows hosts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Graceful fallback for older Node versions
}

/**
 * Custom error thrown when the breached-password screening service (Pwned Passwords API)
 * times out, returns a non-200 HTTP status, encounters network failure, or returns malformed data.
 *
 * Fail-Closed Security Policy:
 * Registrations must not proceed if breach screening cannot be verified. A failed check is
 * never assumed to be an unbreached password.
 */
export class BreachedPasswordServiceError extends Error {
  constructor(message: string = 'Password security screening is temporarily unavailable. Please try again shortly.') {
    super(message);
    this.name = 'BreachedPasswordServiceError';
  }
}

export interface BreachedPasswordOptions {
  /**
   * Custom fetch implementation for unit testing and mocking.
   * Defaults to the global `fetch`.
   */
  fetchFn?: typeof fetch;
  /**
   * Timeout in milliseconds. Defaults to 2,000 ms.
   */
  timeoutMs?: number;
  /**
   * Base API endpoint for range lookup. Defaults to 'https://api.pwnedpasswords.com/range'.
   */
  baseUrl?: string;
}

/**
 * Checks whether a password appears in known data breaches using the Pwned Passwords API.
 *
 * Privacy & Security Model:
 * - This implementation uses the k-anonymity model, NOT a zero-knowledge proof.
 * - The password is hashed locally with SHA-1 solely for this lookup.
 * - Only the first 5 hexadecimal characters (the prefix) are transmitted over HTTPS.
 * - The remaining 35 characters (the suffix) are matched locally against the returned candidate list.
 * - The plaintext password and full SHA-1 hash are NEVER transmitted across the network,
 *   NEVER logged to console or monitoring tools, and NEVER stored in the database.
 * - SHA-1 is discarded immediately and is NOT used for credential storage (Argon2id is used instead).
 *
 * @param password The trimmed/normalized password string to screen.
 * @param options Optional configuration (custom fetch, timeout, baseUrl).
 * @returns Promise<boolean> `true` if the password is found in the breach dataset, `false` if verified absent.
 * @throws {BreachedPasswordServiceError} If screening fails, times out, or returns invalid data (fail-closed).
 */
export async function isPasswordBreached(
  password: string,
  options: BreachedPasswordOptions = {}
): Promise<boolean> {
  if (!password || typeof password !== 'string') {
    return false;
  }

  const {
    fetchFn = fetch,
    timeoutMs = 5000,
    baseUrl = 'https://api.pwnedpasswords.com/range',
  } = options;

  // 1. Calculate SHA-1 hash locally and format as uppercase hex
  const sha1Hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();

  // 2. Split into 5-char prefix (for k-anonymity query) and 35-char suffix (for local comparison)
  const prefix = sha1Hash.slice(0, 5);
  const targetSuffix = sha1Hash.slice(5);

  const url = `${baseUrl.replace(/\/+$/, '')}/${prefix}`;

  let response: Response;
  let lastErr: unknown = null;

  // Execute request with automatic single retry on transient network timeout
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Add-Padding': 'true',
          'User-Agent': 'GoodPets-Breach-Screening',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastErr = null;
      break;
    } catch (err: unknown) {
      lastErr = err;
      if (attempt === 0 && options.fetchFn === undefined) {
        // Only retry once on real network if caller didn't pass custom mock fetch
        await new Promise((res) => setTimeout(res, 200));
        continue;
      }
      break;
    }
  }

  if (lastErr || !response!) {
    const message = lastErr instanceof Error ? lastErr.message : 'Unknown network failure';
    throw new BreachedPasswordServiceError(`Network failure or timeout during breach screening: ${message}`);
  }

  // 3. Enforce valid HTTP status (non-200 fails closed)
  if (!response.ok) {
    throw new BreachedPasswordServiceError(
      `Password screening service returned unexpected HTTP status: ${response.status}`
    );
  }

  let text: string;
  try {
    text = await response.text();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to read response body';
    throw new BreachedPasswordServiceError(`Unable to read response from breach screening service: ${message}`);
  }

  // 4. Validate and parse the k-anonymity response lines
  // Format: <35-char-suffix>:<count>\r\n
  const lines = text.split(/\r?\n/);
  let validLineCount = 0;
  let found = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      throw new BreachedPasswordServiceError('Malformed line in breach screening response (missing delimiter).');
    }

    const suffix = line.slice(0, colonIndex).trim().toUpperCase();
    const countStr = line.slice(colonIndex + 1).trim();

    if (suffix.length !== 35 || !/^[0-9A-F]{35}$/i.test(suffix) || !/^\d+$/.test(countStr)) {
      throw new BreachedPasswordServiceError('Malformed data format in breach screening response.');
    }

    validLineCount++;

    // Local case-insensitive comparison against the target suffix
    if (suffix === targetSuffix) {
      const count = parseInt(countStr, 10);
      // With Add-Padding: true, artificial padding entries have count 0; real breaches have count >= 1
      if (count > 0) {
        found = true;
        break;
      }
    }
  }

  if (validLineCount === 0) {
    throw new BreachedPasswordServiceError('Empty or invalid response from breach screening service.');
  }

  return found;
}

