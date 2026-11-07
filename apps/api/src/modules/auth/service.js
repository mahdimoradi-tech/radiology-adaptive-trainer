import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from './model.js';
import { toPublicUser } from './mapper.js';
import { ConflictError, InvalidCredentialsError } from '../../lib/httpErrors.js';

export const SESSION_COOKIE_NAME = 'rt_session';

// Dummy hash for constant-time comparison when email is not found
const DUMMY_HASH = '$2a$12$e8r1xPq8hB7vU8Zq6Wb9eO3gV0kL7mY2rT1wX4zN6pQ8sD0fH2jK';

/**
 * Generate cookie options for session token
 * @param {any} config
 */
export function getSessionCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(config.COOKIE_SECURE || config.NODE_ENV === 'production'),
    maxAge: config.JWT_TTL_HOURS * 3600 * 1000,
    path: '/',
  };
}

/**
 * Sign JWT session token
 * @param {{ id: string, role: string }} payload
 * @param {any} config
 * @returns {string}
 */
export function signSessionToken(payload, config) {
  return jwt.sign(
    {
      sub: payload.id,
      role: payload.role,
    },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: `${config.JWT_TTL_HOURS}h`,
    },
  );
}

/**
 * Register a new resident user
 * @param {import('@radiology/contracts').RegisterBody} data
 * @param {any} config
 */
export async function registerUser(data, config) {
  const existing = await UserModel.findOne({ email: data.email });
  if (existing) {
    throw new ConflictError('Email is already registered', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(data.password, config.BCRYPT_COST);

  const user = await UserModel.create({
    email: data.email,
    passwordHash,
    displayName: data.displayName,
    language: data.language || 'fa',
    role: 'resident', // Public registration is strictly resident
  });

  const publicUser = toPublicUser(user);
  const token = signSessionToken({ id: publicUser.id, role: publicUser.role }, config);

  return { user: publicUser, token };
}

/**
 * Authenticate user with email and password
 * @param {import('@radiology/contracts').LoginBody} credentials
 * @param {any} config
 */
export async function loginUser({ email, password }, config) {
  const user = await UserModel.findOne({ email });

  if (!user) {
    // Perform dummy comparison to prevent timing-based user enumeration
    await bcrypt.compare(password, DUMMY_HASH);
    throw new InvalidCredentialsError('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new InvalidCredentialsError('Invalid email or password');
  }

  const publicUser = toPublicUser(user);
  const token = signSessionToken({ id: publicUser.id, role: publicUser.role }, config);

  return { user: publicUser, token };
}

/**
 * Find user document by ID
 * @param {string} id
 */
export async function findUserById(id) {
  return UserModel.findById(id);
}

/**
 * Create a new instructor or promote an existing user to instructor
 * @param {{ email: string, password?: string, displayName?: string }} data
 * @param {any} config
 * @returns {Promise<import('@radiology/contracts').UserPublic>}
 */
export async function createOrPromoteInstructor(data, config) {
  const normalizedEmail = data.email.trim().toLowerCase();
  let user = await UserModel.findOne({ email: normalizedEmail });

  if (user) {
    user.role = 'instructor';
    if (data.displayName) {
      user.displayName = data.displayName.trim();
    }
    if (data.password) {
      user.passwordHash = await bcrypt.hash(data.password, config.BCRYPT_COST);
    }
    await user.save();
    return toPublicUser(user);
  }

  if (!data.password) {
    throw new Error('Password is required when creating a new instructor');
  }

  const passwordHash = await bcrypt.hash(data.password, config.BCRYPT_COST);
  user = await UserModel.create({
    email: normalizedEmail,
    passwordHash,
    displayName: data.displayName ? data.displayName.trim() : 'Instructor',
    language: 'fa',
    role: 'instructor',
  });

  return toPublicUser(user);
}
