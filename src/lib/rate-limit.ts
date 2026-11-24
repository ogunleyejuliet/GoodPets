import crypto from 'node:crypto';
import { isIP } from 'node:net';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export type RateLimitPurpose =
  | 'signup:ip'
  | 'signin:email'
  | 'signin:ip'
  | 'availability:ip'
  | 'booking:user'
  | 'booking:ip'
  | 'resend:email';

export interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface ReservedRateLimit {
  key: string;
  windowStart: Date;
}

export class RateLimitExceededError extends Error {
  public readonly statusCode = 429;
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Rate limit exceeded.');
    this.name = 'RateLimitExceededError';
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

export class RateLimitClientIpError extends Error {
  public readonly statusCode = 400;

  constructor(message = 'Unable to verify client network identity.') {
    super(message);
    this.name = 'RateLimitClientIpError';
  }
}

export class RateLimitConfigError extends Error {
  public readonly statusCode = 503;

  constructor() {
    super('Service temporarily unavailable.');
    this.name = 'RateLimitConfigError';
  }
}

export class RateLimitUnavailableError extends Error {
  public readonly statusCode = 503;

  constructor() {
    super('Service temporarily unavailable. Please try again shortly.');
    this.name = 'RateLimitUnavailableError';
  }
}

const MIN_AUTH_SECRET_LENGTH = 32;

/**
 * Validates and retrieves AUTH_SECRET for HMAC key derivation.
 * Fails closed without any hardcoded fallback if missing or insufficiently strong.
 */
export function getRateLimitSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_AUTH_SECRET_LENGTH) {
    console.error(
      '[rate-limit] AUTH_SECRET is missing or shorter than 32 characters; failing closed.'
    );
    throw new RateLimitConfigError();
  }
  return secret;
}

/**
 * Extracts and validates the client IP from request headers.
 * - Production: strictly requires a single valid IPv4/IPv6 in `x-vercel-forwarded-for`.
 *   Assumes production traffic hits Vercel edge directly without an intermediate proxy.
 * - Non-production: honors `x-test-client-ip` when supplied, otherwise `x-forwarded-for`
 *   or localhost (`127.0.0.1`).
 */
export function extractClientIpFromHeaders(
  headers: { get(name: string): string | null },
  isProduction: boolean
): string {
  if (isProduction) {
    const rawVercelIp = headers.get('x-vercel-forwarded-for');
    if (!rawVercelIp) {
      throw new RateLimitClientIpError();
    }
    const candidate = rawVercelIp.trim();
    if (!candidate || candidate.includes(',') || isIP(candidate) === 0) {
      throw new RateLimitClientIpError();
    }
    return candidate;
  }

  const rawTestIp = headers.get('x-test-client-ip');
  if (rawTestIp !== null && rawTestIp !== undefined) {
    const candidate = rawTestIp.trim();
    if (!candidate || candidate.includes(',') || isIP(candidate) === 0) {
      throw new RateLimitClientIpError();
    }
    return candidate;
  }

  const rawForwarded = headers.get('x-forwarded-for');
  if (rawForwarded) {
    const firstHop = rawForwarded.split(',')[0].trim();
    if (firstHop && isIP(firstHop) !== 0) {
      return firstHop;
    }
  }

  return '127.0.0.1';
}

/**
 * Convenience wrapper for extracting and validating the client IP from a NextRequest.
 */
export function getClientIp(request: NextRequest): string {
  return extractClientIpFromHeaders(
    request.headers,
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Derives a domain-separated, non-reversible HMAC-SHA256 rate-limit key.
 * Preserves the purpose prefix in both the HMAC payload and stored database key.
 */
export function deriveRateLimitKey(purpose: RateLimitPurpose, value: string): string {
  const secret = getRateLimitSecret();
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${purpose}:${value}`)
    .digest('hex');
  return `${purpose}:${digest}`;
}

/**
 * Produces a short, non-PII prefix for diagnostic logging without exposing raw values or full hashes.
 */
export function redactKeyForLog(key: string): string {
  const colonIdx = key.lastIndexOf(':');
  if (colonIdx === -1) return 'redacted';
  const prefix = key.slice(0, colonIdx);
  const hashPrefix = key.slice(colonIdx + 1, colonIdx + 9);
  return `${prefix}:${hashPrefix}...`;
}

/**
 * Atomically reserves one or more rate-limit counters inside a single PostgreSQL transaction.
 * Uses database NOW() (UTC) for all window math and Retry-After calculation.
 * Evaluates all counters; if any exceeds its limit, throws RateLimitExceededError inside
 * the transaction so PostgreSQL rolls back every speculative increment.
 */
export async function reserveRateLimits(
  rules: RateLimitRule[],
  db: typeof prisma = prisma
): Promise<ReservedRateLimit[]> {
  if (rules.length === 0) return [];

  // Canonical lock order by key prevents cross-transaction deadlocks.
  const orderedRules = [...rules].sort((a, b) => a.key.localeCompare(b.key));

  try {
    return await db.$transaction(async (tx) => {
      const reservations: ReservedRateLimit[] = [];
      let maxExceededRetryAfter = 0;

      for (const rule of orderedRules) {
        const rows = await tx.$queryRaw<
          Array<{ count: number; windowStart: Date; retryAfterSeconds: number }>
        >`
          INSERT INTO "RateLimit" ("key", "windowStart", "count")
          VALUES (${rule.key}, (NOW() AT TIME ZONE 'UTC'), 1)
          ON CONFLICT ("key") DO UPDATE
          SET
            "count" = CASE
              WHEN "RateLimit"."windowStart" + (${rule.windowSeconds} * INTERVAL '1 second') <= (NOW() AT TIME ZONE 'UTC')
                THEN 1
              ELSE "RateLimit"."count" + 1
            END,
            "windowStart" = CASE
              WHEN "RateLimit"."windowStart" + (${rule.windowSeconds} * INTERVAL '1 second') <= (NOW() AT TIME ZONE 'UTC')
                THEN (NOW() AT TIME ZONE 'UTC')
              ELSE "RateLimit"."windowStart"
            END
          RETURNING
            "count",
            "windowStart",
            GREATEST(
              1,
              CEIL(
                EXTRACT(
                  EPOCH FROM (
                    ("RateLimit"."windowStart" + (${rule.windowSeconds} * INTERVAL '1 second'))
                    - (NOW() AT TIME ZONE 'UTC')
                  )
                )
              )
            )::int AS "retryAfterSeconds";
        `;

        const row = rows[0];
        if (!row) {
          throw new RateLimitUnavailableError();
        }

        const currentCount = Number(row.count);
        const retryAfter = Number(row.retryAfterSeconds);

        reservations.push({
          key: rule.key,
          windowStart: row.windowStart,
        });

        if (currentCount > rule.limit) {
          maxExceededRetryAfter = Math.max(maxExceededRetryAfter, retryAfter);
        }
      }

      if (maxExceededRetryAfter > 0) {
        throw new RateLimitExceededError(maxExceededRetryAfter);
      }

      return reservations;
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[rate-limit] Failed to reserve rate limits: ${message}`);
    throw new RateLimitUnavailableError();
  }
}

/**
 * Safely rolls back speculative rate-limit reservations by decrementing exactly 1
 * only when both the primary key and exact windowStart match.
 * Cannot reduce another concurrent request's increment or corrupt a newer window.
 */
export async function decrementRateLimits(
  reservations: ReservedRateLimit[],
  db: typeof prisma = prisma
): Promise<void> {
  if (reservations.length === 0) return;

  const ordered = [...reservations].sort((a, b) => a.key.localeCompare(b.key));

  await db.$transaction(async (tx) => {
    for (const item of ordered) {
      await tx.$executeRaw`
        UPDATE "RateLimit"
        SET "count" = GREATEST(0, "count" - 1)
        WHERE "key" = ${item.key}
          AND "windowStart" = (${item.windowStart}::timestamptz AT TIME ZONE 'UTC');
      `;
    }
  });
}

/**
 * Deletes expired RateLimit entries whose windowStart is older than 24 hours.
 * Designed to be invoked by a scheduled Inngest background job (PRD FR-043, /api/inngest).
 * Do not rely on detached fire-and-forget execution inside API route handlers.
 */
export async function cleanupExpiredRateLimits(
  db: typeof prisma = prisma
): Promise<number> {
  const deleted = await db.$executeRaw`
    DELETE FROM "RateLimit"
    WHERE "windowStart" < (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours';
  `;
  return Number(deleted);
}
