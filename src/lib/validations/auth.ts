import { z } from 'zod';

export const signupSchema = z
  .object({
    name: z
      .string({ message: 'Full name must be between 2 and 100 characters.' })
      .trim()
      .min(2, 'Full name must be between 2 and 100 characters.')
      .max(100, 'Full name must be between 2 and 100 characters.'),
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
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;

