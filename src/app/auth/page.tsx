'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  validateRequired,
  validateFullName,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateCustomerId,
  EMAIL_REGEX,
} from '@/lib/auth-validation';

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


function CautionIcon({ className = 'w-4 h-4 text-error shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
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
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{ email?: string; customerId?: string; password?: string }>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginServerError, setLoginServerError] = useState<string | null>(null);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);

  const handleLoginEmailBlur = () => {
    const err = validateRequired(loginEmail);
    if (err) {
      setLoginErrors((prev) => ({ ...prev, email: err }));
    } else if (EMAIL_REGEX.test(loginEmail.trim())) {
      setLoginErrors((prev) => ({ ...prev, email: undefined }));
    } else if (loginErrors.email === 'This field must not be empty') {
      setLoginErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handleLoginEmailChange = (val: string) => {
    setLoginEmail(val);
    if (loginErrors.email) {
      if (val.trim() && EMAIL_REGEX.test(val.trim())) {
        setLoginErrors((prev) => ({ ...prev, email: undefined }));
      } else if (loginErrors.email === 'This field must not be empty' && val.trim()) {
        setLoginErrors((prev) => ({ ...prev, email: undefined }));
      }
    }
  };

  const handleLoginCustomerIdBlur = () => {
    const err = validateCustomerId(loginCustomerId);
    if (err) {
      setLoginErrors((prev) => ({ ...prev, customerId: err }));
    } else {
      setLoginErrors((prev) => ({ ...prev, customerId: undefined }));
    }
  };

  const handleLoginCustomerIdChange = (val: string) => {
    setLoginCustomerId(val);
    if (loginErrors.customerId) {
      if (validateCustomerId(val) === undefined) {
        setLoginErrors((prev) => ({ ...prev, customerId: undefined }));
      } else if (loginErrors.customerId === 'This field must not be empty' && val.trim()) {
        setLoginErrors((prev) => ({ ...prev, customerId: undefined }));
      }
    }
  };

  const handleLoginPasswordBlur = () => {
    const err = validateRequired(loginPassword);
    if (err) {
      setLoginErrors((prev) => ({ ...prev, password: err }));
    } else {
      setLoginErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleLoginPasswordChange = (val: string) => {
    setLoginPassword(val);
    if (val && loginErrors.password) {
      setLoginErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginServerError(null);
    setLoginSuccessMsg(null);

    const errors: { email?: string; customerId?: string; password?: string } = {};
    const emailErr = validateEmail(loginEmail);
    if (emailErr) {
      errors.email = emailErr;
    }

    const customerIdErr = validateCustomerId(loginCustomerId);
    if (customerIdErr) {
      errors.customerId = customerIdErr;
    }

    const passwordErr = validateRequired(loginPassword);
    if (passwordErr) {
      errors.password = passwordErr;
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
          email: loginEmail.trim().toLowerCase(),
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
        name: data.user.name || loginEmail.trim().split('@')[0],
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
  const [signUpAgreeToTerms, setSignUpAgreeToTerms] = useState(false);
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  const [signUpErrors, setSignUpErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpServerError, setSignUpServerError] = useState<string | null>(null);
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState<string | null>(null);

  const handleSignUpNameChange = (val: string) => {
    setSignUpName(val);
    if (signUpErrors.name) {
      const err = validateFullName(val);
      if (!err) {
        setSignUpErrors((prev) => ({ ...prev, name: undefined }));
      }
    }
  };

  const handleSignUpNameBlur = () => {
    const err = validateFullName(signUpName);
    if (err) {
      setSignUpErrors((prev) => ({ ...prev, name: err }));
    } else {
      setSignUpErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleSignUpEmailChange = (val: string) => {
    setSignUpEmail(val);
    if (signUpErrors.email) {
      if (val.trim() && EMAIL_REGEX.test(val.trim())) {
        setSignUpErrors((prev) => ({ ...prev, email: undefined }));
      } else if (signUpErrors.email === 'This field must not be empty' && val.trim()) {
        setSignUpErrors((prev) => ({ ...prev, email: undefined }));
      }
    }
  };

  const handleSignUpEmailBlur = () => {
    const trimmed = signUpEmail.trim();
    if (!trimmed) {
      setSignUpErrors((prev) => ({ ...prev, email: 'This field must not be empty' }));
    } else if (!EMAIL_REGEX.test(trimmed)) {
      setSignUpErrors((prev) => ({ ...prev, email: 'Enter a valid email address' }));
    } else {
      setSignUpErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handleSignUpPasswordChange = (val: string) => {
    setSignUpPassword(val);
    if (!showPasswordHint && val.length > 0) {
      setShowPasswordHint(true);
    }
    if (signUpErrors.password) {
      if (val.length >= 8) {
        setSignUpErrors((prev) => ({ ...prev, password: undefined }));
      }
    }
    if (signUpConfirmPassword && signUpErrors.confirmPassword) {
      if (val === signUpConfirmPassword) {
        setSignUpErrors((prev) => ({ ...prev, confirmPassword: undefined }));
      }
    }
  };

  const handleSignUpPasswordBlur = () => {
    const err = validatePassword(signUpPassword);
    if (err) {
      setSignUpErrors((prev) => ({ ...prev, password: err }));
    } else {
      setSignUpErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleSignUpConfirmPasswordChange = (val: string) => {
    setSignUpConfirmPassword(val);
    if (signUpErrors.confirmPassword) {
      if (val === signUpPassword) {
        setSignUpErrors((prev) => ({ ...prev, confirmPassword: undefined }));
      }
    }
  };

  const handleSignUpConfirmPasswordBlur = () => {
    const err = validateConfirmPassword(signUpConfirmPassword, signUpPassword);
    if (err) {
      setSignUpErrors((prev) => ({ ...prev, confirmPassword: err }));
    } else {
      setSignUpErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  };

  // Sign-up validity computations
  const isNameValid = validateFullName(signUpName) === undefined;
  const isEmailValid = signUpEmail.trim().length > 0 && EMAIL_REGEX.test(signUpEmail.trim());
  const isPasswordValid = signUpPassword.length >= 8;
  const isConfirmPasswordValid = signUpConfirmPassword.length > 0 && signUpConfirmPassword === signUpPassword;

  const areAllSignUpFieldsValid = isNameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid;
  const isSignUpFormValid = areAllSignUpFieldsValid && signUpAgreeToTerms;
  const showTermsRequiredSignal = (areAllSignUpFieldsValid && !signUpAgreeToTerms) || !!signUpErrors.terms;

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpServerError(null);
    setSignUpSuccessMsg(null);

    const errors: typeof signUpErrors = {};
    const nameErr = validateFullName(signUpName);
    if (nameErr) errors.name = nameErr;

    const emailErr = validateEmail(signUpEmail);
    if (emailErr) errors.email = emailErr;

    const passwordErr = validatePassword(signUpPassword);
    if (passwordErr) errors.password = passwordErr;

    const confirmErr = validateConfirmPassword(signUpConfirmPassword, signUpPassword);
    if (confirmErr) errors.confirmPassword = confirmErr;

    if (!signUpAgreeToTerms) {
      errors.terms = 'You must agree to the Terms and Conditions to create an account.';
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
          name: signUpName.trim(),
          email: signUpEmail.trim().toLowerCase(),
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
        name: data.user.name || signUpName.trim(),
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

            <form noValidate onSubmit={handleLoginSubmit} className="space-y-4">
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
                  onChange={(e) => handleLoginEmailChange(e.target.value)}
                  onBlur={handleLoginEmailBlur}
                  placeholder="name@example.com"
                  autoComplete="email"
                  aria-invalid={!!loginErrors.email}
                  aria-describedby={loginErrors.email ? 'auth-login-email-error' : undefined}
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    loginErrors.email ? 'border-error ring-1 ring-error focus:ring-error' : 'border-outline-variant'
                  }`}
                />
                {loginErrors.email && (
                  <div
                    id="auth-login-email-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{loginErrors.email}</span>
                  </div>
                )}
              </div>

              <div>
                <label
                  className="block type-label-medium font-bold text-on-surface mb-1"
                  htmlFor="auth-login-customer-id"
                >
                  Customer ID
                </label>
                <input
                  id="auth-login-customer-id"
                  type="number"
                  value={loginCustomerId}
                  onChange={(e) => handleLoginCustomerIdChange(e.target.value)}
                  onBlur={handleLoginCustomerIdBlur}
                  autoComplete="off"
                  aria-invalid={!!loginErrors.customerId}
                  aria-describedby={loginErrors.customerId ? 'auth-login-customer-id-error' : undefined}
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary no-spinner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 ${
                    loginErrors.customerId ? 'border-error ring-1 ring-error focus:ring-error' : 'border-outline-variant'
                  }`}
                />
                {loginErrors.customerId && (
                  <div
                    id="auth-login-customer-id-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{loginErrors.customerId}</span>
                  </div>
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
                  onChange={(e) => handleLoginPasswordChange(e.target.value)}
                  onBlur={handleLoginPasswordBlur}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!loginErrors.password}
                  aria-describedby={loginErrors.password ? 'auth-login-password-error' : undefined}
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    loginErrors.password ? 'border-error ring-1 ring-error focus:ring-error' : 'border-outline-variant'
                  }`}
                />
                {loginErrors.password && (
                  <div
                    id="auth-login-password-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{loginErrors.password}</span>
                  </div>
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

            <form noValidate onSubmit={handleSignUpSubmit} className="space-y-4">
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
                  onChange={(e) => handleSignUpNameChange(e.target.value)}
                  onBlur={handleSignUpNameBlur}
                  placeholder="e.g. Juliet Ogunleye"
                  autoComplete="name"
                  aria-invalid={!!signUpErrors.name}
                  aria-describedby={signUpErrors.name ? 'auth-signup-name-error' : undefined}
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.name ? 'border-error ring-1 ring-error focus:ring-error' : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.name && (
                  <div
                    id="auth-signup-name-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{signUpErrors.name}</span>
                  </div>
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
                  onChange={(e) => handleSignUpEmailChange(e.target.value)}
                  onBlur={handleSignUpEmailBlur}
                  placeholder="name@example.com"
                  autoComplete="email"
                  aria-invalid={!!signUpErrors.email}
                  aria-describedby={signUpErrors.email ? 'auth-signup-email-error' : undefined}
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.email ? 'border-error ring-1 ring-error focus:ring-error' : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.email && (
                  <div
                    id="auth-signup-email-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{signUpErrors.email}</span>
                  </div>
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
                  onChange={(e) => handleSignUpPasswordChange(e.target.value)}
                  onBlur={handleSignUpPasswordBlur}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={!!signUpErrors.password}
                  aria-describedby={
                    [
                      showPasswordHint ? 'auth-signup-password-hint' : '',
                      signUpErrors.password ? 'auth-signup-password-error' : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.password
                      ? 'border-error ring-1 ring-error focus:ring-error'
                      : 'border-outline-variant'
                  }`}
                />
                {showPasswordHint && (
                  <p id="auth-signup-password-hint" className="type-body-small text-on-surface-variant mt-1">
                    Password must be at least 8 characters.
                  </p>
                )}
                {signUpErrors.password && (
                  <div
                    id="auth-signup-password-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{signUpErrors.password}</span>
                  </div>
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
                  onChange={(e) => handleSignUpConfirmPasswordChange(e.target.value)}
                  onBlur={handleSignUpConfirmPasswordBlur}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  aria-invalid={!!signUpErrors.confirmPassword}
                  aria-describedby={
                    signUpErrors.confirmPassword ? 'auth-signup-confirm-password-error' : undefined
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                    signUpErrors.confirmPassword
                      ? 'border-error ring-1 ring-error focus:ring-error'
                      : 'border-outline-variant'
                  }`}
                />
                {signUpErrors.confirmPassword && (
                  <div
                    id="auth-signup-confirm-password-error"
                    role="alert"
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-error font-semibold"
                  >
                    <CautionIcon />
                    <span>{signUpErrors.confirmPassword}</span>
                  </div>
                )}
              </div>

              {/* Terms and Conditions Acceptance Checkbox */}
              <div>
                <div className="flex items-start gap-3 mt-1">
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      id="auth-signup-terms"
                      type="checkbox"
                      checked={signUpAgreeToTerms}
                      onChange={(e) => {
                        setSignUpAgreeToTerms(e.target.checked);
                        if (signUpErrors.terms) {
                          setSignUpErrors((prev) => ({ ...prev, terms: undefined }));
                        }
                      }}
                      aria-invalid={showTermsRequiredSignal}
                      aria-describedby={showTermsRequiredSignal ? 'auth-signup-terms-error' : undefined}
                      className={`h-4 w-4 rounded border text-primary focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer transition-colors ${
                        showTermsRequiredSignal
                          ? 'border-error ring-1 ring-error'
                          : 'border-outline-variant'
                      }`}
                    />
                  </div>
                  <label
                    htmlFor="auth-signup-terms"
                    className="type-body-medium text-xs text-on-surface leading-normal cursor-pointer select-none"
                  >
                    I agree to the{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms and Conditions
                    </a>
                    .
                  </label>
                </div>
                {showTermsRequiredSignal && (
                  <div
                    id="auth-signup-terms-error"
                    role="alert"
                    className="flex items-center gap-1.5 text-xs text-error mt-1.5 font-semibold"
                  >
                    <CautionIcon />
                    <span>{signUpErrors.terms || 'You must agree to the Terms and Conditions to create an account.'}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!isSignUpFormValid || signUpLoading}
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
              <form noValidate onSubmit={handleResetSubmit} className="space-y-4">
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
