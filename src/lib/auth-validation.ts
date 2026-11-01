/**
 * Authentication Form Validation Utilities
 * Good Pets Design System & Validation Rules
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a required field.
 * Returns "This field must not be empty" when empty or whitespace-only.
 */
export function validateRequired(value: string): string | undefined {
  if (!value || !value.trim()) {
    return 'This field must not be empty';
  }
  return undefined;
}

/**
 * Validates a full name:
 * - Must not be empty.
 * - Must be at least 2 characters.
 * - Must contain at least 2 name parts (words) separated by whitespace.
 * - Handles leading, trailing, and repeated whitespace properly.
 */
export function validateFullName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'This field must not be empty';
  }
  if (trimmed.length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return 'Please enter your full name (at least two names).';
  }
  if (trimmed.length > 100) {
    return 'Full name cannot exceed 100 characters.';
  }
  return undefined;
}

/**
 * Validates an email address.
 * Returns "This field must not be empty" if empty,
 * or "Enter a valid email address" if the format is invalid.
 */
export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'This field must not be empty';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Enter a valid email address';
  }
  return undefined;
}

/**
 * Validates a password:
 * - Must not be empty.
 * - Must be at least 8 characters.
 */
export function validatePassword(value: string): string | undefined {
  if (!value) {
    return 'This field must not be empty';
  }
  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return undefined;
}

/**
 * Validates confirm password:
 * - Must not be empty.
 * - Must match password.
 */
export function validateConfirmPassword(value: string, passwordValue: string): string | undefined {
  if (!value) {
    return 'This field must not be empty';
  }
  if (passwordValue && value !== passwordValue) {
    return 'Passwords do not match.';
  }
  return undefined;
}

/**
 * Checks if the entire full name value is valid.
 */
export function isFullNameValid(value: string): boolean {
  return validateFullName(value) === undefined;
}

/**
 * Checks if the email value is valid.
 */
export function isEmailValid(value: string): boolean {
  return validateEmail(value) === undefined;
}

/**
 * Checks if the password value is valid.
 */
export function isPasswordValid(value: string): boolean {
  return validatePassword(value) === undefined;
}

/**
 * Checks if confirm password matches password.
 */
export function isConfirmPasswordValid(value: string, passwordValue: string): boolean {
  return validateConfirmPassword(value, passwordValue) === undefined;
}

/**
 * Validates a Customer ID:
 * - Must not be empty.
 * - Format guidance is kept generic to avoid enumeration risks.
 * - Preserves leading zeros.
 */
export function validateCustomerId(value: string): string | undefined {
  if (!value || !value.trim()) {
    return 'This field must not be empty';
  }
  return undefined;
}

/**
 * Underlying 4-digit validation for Customer ID.
 */
export function isCustomerIdValid(value: string): boolean {
  if (!value || !value.trim()) return false;
  return /^\d{4}$/.test(value.trim());
}

