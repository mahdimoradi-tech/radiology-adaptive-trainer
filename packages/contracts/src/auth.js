import { z } from 'zod';

/**
 * User roles
 * @typedef {'resident' | 'instructor'} Role
 */
export const ROLES = /** @type {const} */ (['resident', 'instructor']);
export const RoleSchema = z.enum(ROLES);

/**
 * Supported UI languages
 * @typedef {'fa' | 'en'} Language
 */
export const LANGUAGES = /** @type {const} */ (['fa', 'en']);
export const LanguageSchema = z.enum(LANGUAGES);

/**
 * Email validation schema: trimmed, lowercased, max 254 chars, valid email format
 */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email must not exceed 254 characters')
  .pipe(z.email('Invalid email address'));

/**
 * Password validation schema: length 8..72 bytes
 */
export const PasswordSchema = z.string().refine(
  (val) => {
    const bytes = new TextEncoder().encode(val).length;
    return bytes >= 8 && bytes <= 72;
  },
  {
    message: 'Password must be between 8 and 72 bytes',
  },
);

/**
 * Registration request body schema
 * @typedef {Object} RegisterBody
 * @property {string} email
 * @property {string} password
 * @property {string} displayName
 * @property {Language} [language]
 */
export const RegisterBodySchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    displayName: z
      .string()
      .trim()
      .min(2, 'DisplayName must be at least 2 characters')
      .max(60, 'DisplayName must not exceed 60 characters'),
    language: LanguageSchema.default('fa'),
  })
  .refine((data) => data.password !== data.email, {
    message: 'Password must differ from email',
    path: ['password'],
  });

/**
 * Login request body schema
 * @typedef {Object} LoginBody
 * @property {string} email
 * @property {string} password
 */
export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Public user projection schema
 * @typedef {Object} UserPublic
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {Role} role
 * @property {Language} language
 * @property {string|Date} createdAt
 */
export const UserPublicSchema = z.object({
  id: z.string().min(1),
  email: EmailSchema,
  displayName: z.string().min(1),
  role: RoleSchema,
  language: LanguageSchema,
  createdAt: z.union([z.string(), z.date()]),
});
