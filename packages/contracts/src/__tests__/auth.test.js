import { describe, it, expect } from 'vitest';
import {
  ROLES,
  RoleSchema,
  LANGUAGES,
  LanguageSchema,
  EmailSchema,
  PasswordSchema,
  RegisterBodySchema,
  LoginBodySchema,
  UserPublicSchema,
} from '../auth.js';

describe('Auth contracts', () => {
  describe('Roles and Languages', () => {
    it('allows valid roles and rejects others', () => {
      expect(ROLES).toEqual(['resident', 'instructor']);
      expect(RoleSchema.safeParse('resident').success).toBe(true);
      expect(RoleSchema.safeParse('instructor').success).toBe(true);
      expect(RoleSchema.safeParse('admin').success).toBe(false);
      expect(RoleSchema.safeParse('').success).toBe(false);
    });

    it('allows valid languages and rejects others', () => {
      expect(LANGUAGES).toEqual(['fa', 'en']);
      expect(LanguageSchema.safeParse('fa').success).toBe(true);
      expect(LanguageSchema.safeParse('en').success).toBe(true);
      expect(LanguageSchema.safeParse('fr').success).toBe(false);
    });
  });

  describe('EmailSchema', () => {
    it('trims and lowercases valid email', () => {
      const parsed = EmailSchema.parse('  Resident.Doctor@Hospital.ORG  ');
      expect(parsed).toBe('resident.doctor@hospital.org');
    });

    it('rejects malformed email formats', () => {
      expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
      expect(EmailSchema.safeParse('@hospital.org').success).toBe(false);
      expect(EmailSchema.safeParse('user@').success).toBe(false);
      expect(EmailSchema.safeParse('').success).toBe(false);
    });

    it('rejects emails longer than 254 characters', () => {
      const longEmail = 'a'.repeat(245) + '@test.org'; // 254 chars
      expect(EmailSchema.safeParse(longEmail).success).toBe(true);

      const tooLongEmail = 'a'.repeat(246) + '@test.org'; // 255 chars
      expect(EmailSchema.safeParse(tooLongEmail).success).toBe(false);
    });
  });

  describe('PasswordSchema', () => {
    it('accepts 8-byte minimum and 72-byte maximum ASCII passwords', () => {
      expect(PasswordSchema.safeParse('12345678').success).toBe(true); // 8 bytes
      expect(PasswordSchema.safeParse('a'.repeat(72)).success).toBe(true); // 72 bytes
    });

    it('rejects passwords shorter than 8 bytes or longer than 72 bytes', () => {
      expect(PasswordSchema.safeParse('1234567').success).toBe(false); // 7 bytes
      expect(PasswordSchema.safeParse('a'.repeat(73)).success).toBe(false); // 73 bytes
    });

    it('accurately validates UTF-8 multi-byte characters (Persian characters are 2 bytes)', () => {
      // 5 Persian chars = 10 bytes
      const fivePersianChars = 'سلامت'; // 'س' (2) + 'ل' (2) + 'ا' (2) + 'م' (2) + 'ت' (2) = 10 bytes
      expect(new TextEncoder().encode(fivePersianChars).length).toBe(10);
      expect(PasswordSchema.safeParse(fivePersianChars).success).toBe(true);

      // Exactly 36 Persian chars = 72 bytes
      const thirtySixPersianChars = 'رمزعبور'.repeat(5) + 'ت'; // 7*5 + 1 = 36 chars * 2 = 72 bytes
      expect(new TextEncoder().encode(thirtySixPersianChars).length).toBe(72);
      expect(PasswordSchema.safeParse(thirtySixPersianChars).success).toBe(true);

      // 37 Persian chars = 74 bytes (exceeds 72 bytes)
      const thirtySevenPersianChars = thirtySixPersianChars + 'ی';
      expect(new TextEncoder().encode(thirtySevenPersianChars).length).toBe(74);
      expect(PasswordSchema.safeParse(thirtySevenPersianChars).success).toBe(false);
    });
  });

  describe('RegisterBodySchema', () => {
    it('accepts valid registration payload with default language fa', () => {
      const payload = {
        email: 'Resident@Hospital.com',
        password: 'securePassword123',
        displayName: '  Dr. Sarah  ',
      };
      const parsed = RegisterBodySchema.parse(payload);
      expect(parsed.email).toBe('resident@hospital.com');
      expect(parsed.displayName).toBe('Dr. Sarah');
      expect(parsed.language).toBe('fa');
    });

    it('rejects registration when password equals email', () => {
      const payload = {
        email: 'same@example.com',
        password: 'same@example.com',
        displayName: 'Same User',
      };
      const result = RegisterBodySchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Password must differ from email');
    });

    it('enforces displayName length between 2 and 60 characters', () => {
      const base = { email: 'doc@example.com', password: 'password123' };

      expect(RegisterBodySchema.safeParse({ ...base, displayName: 'A' }).success).toBe(false); // too short
      expect(RegisterBodySchema.safeParse({ ...base, displayName: 'AB' }).success).toBe(true);
      expect(RegisterBodySchema.safeParse({ ...base, displayName: 'A'.repeat(60) }).success).toBe(
        true,
      );
      expect(RegisterBodySchema.safeParse({ ...base, displayName: 'A'.repeat(61) }).success).toBe(
        false,
      ); // too long
    });
  });

  describe('LoginBodySchema', () => {
    it('validates correct email and password', () => {
      const parsed = LoginBodySchema.parse({
        email: '  USER@EXAMPLE.COM ',
        password: 'myPassword!',
      });
      expect(parsed.email).toBe('user@example.com');
      expect(parsed.password).toBe('myPassword!');
    });

    it('rejects empty password or invalid email', () => {
      expect(LoginBodySchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(
        false,
      );
      expect(
        LoginBodySchema.safeParse({ email: 'invalid-email', password: 'secret' }).success,
      ).toBe(false);
    });
  });

  describe('UserPublicSchema', () => {
    it('validates public projection of a user with string or Date createdAt', () => {
      const userWithStringDate = {
        id: 'usr_12345',
        email: 'doc@example.com',
        displayName: 'Dr. John',
        role: 'resident',
        language: 'fa',
        createdAt: '2026-10-31T20:00:00.000Z',
      };
      expect(UserPublicSchema.safeParse(userWithStringDate).success).toBe(true);

      const userWithDateObject = {
        ...userWithStringDate,
        createdAt: new Date(),
      };
      expect(UserPublicSchema.safeParse(userWithDateObject).success).toBe(true);
    });
  });
});
