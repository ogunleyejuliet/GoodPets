import { z } from 'zod';

export const signupSchema = z
  .object({
    name: z
      .string({ message: 'Full name must be between 2 and 100 characters.' })
      .trim()
      .min(2, 'Full name must be between 2 and 100 characters.')
      .max(100, 'Full name must be between 2 and 100 characters.')
      .refine(
        (val) => val.split(/\s+/).filter(Boolean).length >= 2,
        { message: 'Please enter your full name (at least two names).' }
      ),
    email: z
      .string({ message: 'Please enter a valid email address.' })
      .trim()
      .toLowerCase()
      .email('Please enter a valid email address.'),
    password: z
      .string({ message: 'Password must be at least 8 characters.' })
      .trim()
      .min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z
      .string({ message: 'Passwords do not match.' })
      .trim(),
    agreeToTerms: z
      .boolean({ message: 'You must agree to the Terms and Conditions to create an account.' })
      .refine((val) => val === true, {
        message: 'You must agree to the Terms and Conditions to create an account.',
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;

