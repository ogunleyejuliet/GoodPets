'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type AuthMode = 'login' | 'signup' | 'reset';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

const AUTH_STORAGE_KEY = 'goodpets_customer_session';

/**
 * Validates and cleanses returnUrl to prevent open redirect vulnerabilities.
 * Only permits safe internal paths within this application.
 */
function getSafeReturnUrl(rawUrl: string | null): string {
  if (!rawUrl) return '/book';
  const trimmed = rawUrl.trim();

  // Must start with a single '/' and not with '//' or '/\'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      if (parsed.origin === 'http://localhost') {
        return parsed.pathname + parsed.search + parsed.hash;
      }
    } catch {
      return '/book';
    }
  }
  return '/book';
}

function AuthContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. URL-driven mode resolution
  const modeParam = searchParams.get('mode');
  const activeMode: AuthMode =
    modeParam === 'signup' || modeParam === 'reset' ? modeParam : 'login';

  const rawReturnUrl = searchParams.get('returnUrl');
  const returnUrl = getSafeReturnUrl(rawReturnUrl);

  // Helper to switch mode query parameter without full-page reload
  const navigateToMode = (newMode: AuthMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', newMode);
    router.push(`${pathname}?${params.toString()}`);
  };

  const getModeHref = (newMode: AuthMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', newMode);
    return `${pathname}?${params.toString()}`;
  };

  // ----------------------------------------------------
  // Form States: Login
  // ----------------------------------------------------
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginServerError, setLoginServerError] = useState<string | null>(null);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginServerError(null);
    setLoginSuccessMsg(null);

    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = loginEmail.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!loginPassword) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors);
      return;
    }

    setLoginErrors({});
    setLoginLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail.toLowerCase(),
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginLoading(false);
        setLoginServerError(data.error || 'Email or password is incorrect.');
        return;
      }

      setLoginLoading(false);
      const loggedUser: UserProfile = {
        id: data.user.id,
        name: data.user.name || trimmedEmail.split('@')[0],
        email: data.user.email,
        role: data.user.role,
      };

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedUser));
      }

      setLoginSuccessMsg('Signed in successfully! Redirecting...');
      setTimeout(() => {
        router.push(returnUrl);
      }, 600);
    } catch {
      setLoginLoading(false);
      setLoginServerError('Unable to connect to the server. Please check your connection and try again.');
    }
  };

  // ----------------------------------------------------
  // Form States: Signup
  // ----------------------------------------------------
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpErrors, setSignUpErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpServerError, setSignUpServerError] = useState<string | null>(null);
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState<string | null>(null);

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpServerError(null);
    setSignUpSuccessMsg(null);

    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    const trimmedName = signUpName.trim();
    const trimmedEmail = signUpEmail.trim();

    if (!trimmedName || trimmedName.length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Full name cannot exceed 100 characters.';
    }

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!signUpPassword) {
      errors.password = 'Password is required.';
    } else if (signUpPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (signUpPassword !== signUpConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setSignUpErrors(errors);
      return;
    }

    setSignUpErrors({});
    setSignUpLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail.toLowerCase(),
          password: signUpPassword,
          confirmPassword: signUpConfirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSignUpLoading(false);
        setSignUpServerError(data.error || 'Failed to create account. Please check your details.');
        return;
      }

      setSignUpLoading(false);
      const newUser: UserProfile = {
        id: data.user.id,
        name: data.user.name || trimmedName,
        email: data.user.email,
        role: data.user.role,
      };

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
      }

      setSignUpSuccessMsg('Account created successfully! Redirecting...');
      setTimeout(() => {
        router.push(returnUrl);
      }, 600);
    } catch {
      setSignUpLoading(false);
      setSignUpServerError('Unable to connect to the server. Please check your connection and try again.');
    }
  };

  // ----------------------------------------------------
  // Form States: Reset Password
  // ----------------------------------------------------
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitted, setResetSubmitted] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resetEmail.trim();

    if (!trimmed) {
      setResetError('Email address is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResetError('Please enter a valid email address.');
      return;
    }

    setResetError(null);
    setResetSubmitted(true);
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
          {activeMode === 'login'
            ? 'Sign In'
            : activeMode === 'signup'
            ? 'Create Account'
            : 'Reset Password'}
        </h1>
        <p className="type-body-medium text-on-surface-variant mt-2">
          {activeMode === 'login'
            ? 'Access your pet profiles and booking reservations.'
            : activeMode === 'signup'
            ? 'Join Good Pets to book grooming, daycare, and boarding in Lagos.'
            : 'Password recovery for your Good Pets account.'}
        </p>
      </div>

      {/* Main Container Card */}
      <div className="bg-surface rounded-2xl border border-outline-variant p-6 sm:p-8 shadow-soft space-y-6">
        {/* Mode Selector Tabs (Login vs Signup) */}
        {activeMode !== 'reset' && (
          <div className="flex rounded-full bg-surface-container-high p-1 border border-outline-variant">
            <Link
              href={getModeHref('login')}
              scroll={false}
              className={`flex-1 py-2 text-center text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer ${
                activeMode === 'login'
                  ? 'bg-surface text-on-surface shadow-soft'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </Link>
            <Link
              href={getModeHref('signup')}
              scroll={false}
              className={`flex-1 py-2 text-center text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer ${
                activeMode === 'signup'
                  ? 'bg-surface text-on-surface shadow-soft'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Create Account
            </Link>
          </div>
        )}

        {/* =========================================================================
            MODE 1: SIGN IN FORM
            ========================================================================= */}
        {activeMode === 'login' && (
          <div className="space-y-4">
            {loginSuccessMsg && (
              <div className="bg-success-container text-on-success-container p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>{loginSuccessMsg}</span>
              </div>
            )}
            {loginServerError && (
              <div className="bg-error-container text-on-error-container p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{loginServerError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  className="block type-label-medium font-bold text-on-surface mb-1"
                  htmlFor="auth-login-email"
                >
                  Email Address
                </label>
                <input
                  id="auth-login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    loginErrors.email ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                  }`}
                />
                {loginErrors.email && (
                  <p className="text-xs text-error mt-1 font-semibold">{loginErrors.email}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    className="block type-label-medium font-bold text-on-surface"
                    htmlFor="auth-login-password"
                  >
                    Password
                  </label>
                  <Link
                    href={getModeHref('reset')}
                    scroll={false}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="auth-login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    loginErrors.password ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                  }`}
                />
                {loginErrors.password && (
                  <p className="text-xs text-error mt-1 font-semibold">{loginErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed mt-2"
              >
                {loginLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-outline-variant/60 text-center">
              <p className="type-body-medium text-xs text-on-surface-variant">
                Don&apos;t have an account?{' '}
                <Link
                  href={getModeHref('signup')}
                  scroll={false}
                  className="font-bold text-primary hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODE 2: SIGN UP FORM
            ========================================================================= */}
        {activeMode === 'signup' && (
          <div className="space-y-4">
            {signUpSuccessMsg && (
              <div className="bg-success-container text-on-success-container p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>{signUpSuccessMsg}</span>
              </div>
            )}
            {signUpServerError && (
              <div className="bg-error-container text-on-error-container p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{signUpServerError}</span>
              </div>
            )}

            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div>
                <label
                  className="block type-label-medium font-bold text-on-surface mb-1"
                  htmlFor="auth-signup-name"
                >
                  Full Name
                </label>
                <input
                  id="auth-signup-name"
                  type="text"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="e.g. Juliet Ogunleye"
                  autoComplete="name"
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.name ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.name && (
                  <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  className="block type-label-medium font-bold text-on-surface mb-1"
                  htmlFor="auth-signup-email"
                >
                  Email Address
                </label>
                <input
                  id="auth-signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.email ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.email && (
                  <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.email}</p>
                )}
              </div>

              <div>
                <label
                  className="block type-label-medium font-bold text-on-surface mb-1"
                  htmlFor="auth-signup-password"
                >
                  Password
                </label>
                <input
                  id="auth-signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.password
                      ? 'border-error ring-1 ring-error'
                      : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.password && (
                  <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.password}</p>
                )}
              </div>

              <div>
                <label
                  className="block type-label-medium font-bold text-on-surface mb-1"
                  htmlFor="auth-signup-confirm-password"
                >
                  Confirm Password
                </label>
                <input
                  id="auth-signup-confirm-password"
                  type="password"
                  value={signUpConfirmPassword}
                  onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.confirmPassword
                      ? 'border-error ring-1 ring-error'
                      : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.confirmPassword && (
                  <p className="text-xs text-error mt-1 font-semibold">
                    {signUpErrors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={signUpLoading}
                className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed mt-2"
              >
                {signUpLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-outline-variant/60 text-center">
              <p className="type-body-medium text-xs text-on-surface-variant">
                Already have an account?{' '}
                <Link
                  href={getModeHref('login')}
                  scroll={false}
                  className="font-bold text-primary hover:underline"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODE 3: PASSWORD RESET FORM
            ========================================================================= */}
        {activeMode === 'reset' && (
          <div className="space-y-4">
            {/* Backend Capability Notice */}
            <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/80 text-xs text-on-surface-variant space-y-2">
              <div className="flex items-center gap-2 font-bold text-on-surface text-xs uppercase tracking-wider">
                <span className="text-primary text-base leading-none">ℹ️</span>
                <span>Feature Status: In Development</span>
              </div>
              <p className="leading-relaxed">
                Automated password reset email dispatch (PRD Flow 12) is scheduled for integration alongside the transactional email module. Token persistence models are prepared, but outbound reset emails are not yet active in this environment.
              </p>
            </div>

            {resetSubmitted ? (
              <div className="space-y-4">
                <div className="bg-secondary-container text-on-secondary-container p-4 rounded-xl text-xs font-semibold space-y-2">
                  <div className="flex items-center gap-2">
                    <span>⚠️</span>
                    <span className="font-bold">Email Service Notice</span>
                  </div>
                  <p className="leading-relaxed">
                    Automated password reset emails are currently disabled while transactional email delivery is finalized. To continue using Good Pets, please sign in with your password or create a new test account.
                  </p>
                </div>

                <Link
                  href={getModeHref('login')}
                  scroll={false}
                  className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all text-center cursor-pointer"
                >
                  Return to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label
                    className="block type-label-medium font-bold text-on-surface mb-1"
                    htmlFor="auth-reset-email"
                  >
                    Email Address
                  </label>
                  <input
                    id="auth-reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (resetError) setResetError(null);
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      resetError ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {resetError && (
                    <p className="text-xs text-error mt-1 font-semibold">{resetError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer mt-2"
                >
                  Request Password Reset
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <Link
                href={getModeHref('login')}
                scroll={false}
                className="font-bold text-primary hover:underline"
              >
                ← Back to Sign In
              </Link>
              <Link
                href={getModeHref('signup')}
                scroll={false}
                className="text-on-surface-variant hover:text-primary"
              >
                Need an account?{' '}
                <span className="font-bold text-primary hover:underline">Sign up</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Back to Home / Book */}
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

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-secondary-container selection:text-on-secondary-container">
      <Suspense
        fallback={
          <div className="w-full max-w-md mx-auto text-center py-12 text-on-surface-variant type-body-medium">
            Loading authentication...
          </div>
        }
      >
        <AuthContent />
      </Suspense>
    </div>
  );
}
