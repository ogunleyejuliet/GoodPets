'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSafeReturnUrl } from '@/lib/auth-validation';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const codeParam = searchParams.get('code') || '';
  const returnUrlParam = searchParams.get('returnUrl');

  const safeReturnUrl = returnUrlParam ? getSafeReturnUrl(returnUrlParam, '') : '';
  const signInHref = safeReturnUrl
    ? `/auth?mode=login&returnUrl=${encodeURIComponent(safeReturnUrl)}`
    : '/auth?mode=login';
  const signUpHref = safeReturnUrl
    ? `/auth?mode=signup&returnUrl=${encodeURIComponent(safeReturnUrl)}`
    : '/auth?mode=signup';

  const [email, setEmail] = useState<string>(emailParam);
  const [code, setCode] = useState<string>(codeParam.replace(/\D/g, '').slice(0, 6));
  const [loading, setLoading] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCodeChange = (val: string) => {
    // Only accept numeric digits up to 6 characters
    const numeric = val.replace(/\D/g, '').slice(0, 6);
    setCode(numeric);
    if (errorMsg) setErrorMsg(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorCode(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setErrorCode('INVALID_EMAIL');
      return;
    }

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      setErrorCode('INVALID_CODE');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 200 && data.success) {
        setVerified(true);
        setSuccessMsg(
          data.message ||
            'Your email address has been successfully verified. You may now sign in to your Good Pets account.'
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      setErrorCode(data.code || 'VERIFICATION_FAILED');

      if (response.status === 410 || data.code === 'CODE_EXPIRED' || data.code === 'TOKEN_EXPIRED') {
        setErrorMsg(
          data.error ||
            'This verification code has expired. Codes are valid for 10 minutes. Please request a new code.'
        );
        return;
      }

      if (response.status === 409 || data.code === 'CODE_REUSED' || data.code === 'TOKEN_REUSED') {
        setErrorMsg(
          data.error ||
            'This verification code has already been used. If your account is verified, please sign in.'
        );
        return;
      }

      if (response.status === 400 || data.code === 'INVALID_CODE' || data.code === 'ACCOUNT_NOT_FOUND') {
        setErrorMsg(
          data.error ||
            'The verification code is incorrect. Please check your email and enter the 6-digit code.'
        );
        return;
      }

      setErrorMsg(data.error || 'Unable to verify code at this time. Please try again.');
    } catch {
      setLoading(false);
      setErrorCode('NETWORK_ERROR');
      setErrorMsg('Unable to connect to the Good Pets server. Please check your connection and try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-block p-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Image
            src="/images/logo.svg"
            alt="Good Pets"
            width={160}
            height={37}
            priority
            className="h-10 w-auto mx-auto object-contain"
          />
        </Link>
        <h1 className="type-headline-large font-bold text-on-surface mt-6">
          Account Verification
        </h1>
        <p className="type-body-medium text-on-surface-variant mt-2">
          Victoria Island, Lagos pet-care reservations
        </p>
      </div>

      {/* Main Status Card */}
      <div className="bg-surface rounded-2xl border border-outline-variant p-6 sm:p-8 shadow-soft space-y-6">
        {verified ? (
          /* State: Verified Success */
          <div className="text-center py-2 space-y-5" role="status" aria-live="polite">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-success-container text-on-success-container flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="type-title-large font-bold text-on-surface">Email Verified</h2>
              <p className="type-body-medium text-on-surface-variant leading-relaxed">
                {successMsg ||
                  'Your email address has been successfully verified. You may now sign in to your Good Pets account.'}
              </p>
            </div>

            <div className="pt-2">
              <Link
                href={signInHref}
                className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all text-center cursor-pointer"
              >
                Sign In to Your Account
              </Link>
            </div>
          </div>
        ) : (
          /* State: 6-Digit Code Input Form */
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="type-title-large font-bold text-on-surface">
                Enter Verification Code
              </h2>
              <p className="type-body-medium text-xs text-on-surface-variant">
                Enter the six-digit code sent to your email to verify your Good Pets account.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-error-container text-on-error-container p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5"
              >
                <span aria-hidden="true" className="shrink-0 mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <div>{errorMsg}</div>
                  {errorCode === 'CODE_EXPIRED' && (
                    <p className="font-normal text-on-error-container/90">
                      Codes are valid for 10 minutes. If expired, please sign up again or request a new code.
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label
                  htmlFor="verify-email"
                  className="block type-label-medium font-bold text-on-surface mb-1 text-xs"
                >
                  Email Address
                </label>
                <input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="verify-code"
                  className="block type-label-medium font-bold text-on-surface mb-1 text-xs"
                >
                  6-Digit Verification Code
                </label>
                <input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full px-3.5 py-3 rounded-xl border border-outline-variant bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-[0.4em] font-mono font-bold text-2xl"
                />
              </div>

              {/* Security info box */}
              <div className="bg-surface-container rounded-xl p-3.5 text-xs text-on-surface-variant text-left space-y-1 border border-outline-variant/60">
                <div className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="text-primary text-sm leading-none" aria-hidden="true">🔒</span>
                  <span>Code security & expiry:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant pl-1">
                  <li>Codes expire in <strong>10 minutes</strong>.</li>
                  <li>Each code is single-use and invalidates immediately after verification.</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6 || !email.trim()}
                className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  <span>Verify Code</span>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href={signInHref}
                className="type-label-medium text-xs font-bold text-primary hover:underline"
              >
                Already verified? Sign in here
              </Link>
            </div>
          </div>
        )}

        {/* Navigation Link to Sign In or Sign Up */}
        <div className="pt-4 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <Link
            href={signInHref}
            className="font-bold text-primary hover:underline"
          >
            ← Back to Sign In
          </Link>
          <Link
            href={signUpHref}
            className="text-on-surface-variant hover:text-primary"
          >
            Need an account?{' '}
            <span className="font-bold text-primary hover:underline">Sign up</span>
          </Link>
        </div>
      </div>

      {/* Back to Home Link */}
      <div className="text-center mt-6">
        <Link
          href="/"
          className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
        >
          ← Back to Good Pets Home
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-secondary-container selection:text-on-secondary-container">
      <Suspense
        fallback={
          <div className="w-full max-w-md mx-auto text-center py-12 text-on-surface-variant type-body-medium">
            Loading verification...
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
