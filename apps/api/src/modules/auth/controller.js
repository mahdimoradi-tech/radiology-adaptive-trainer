import {
  registerUser,
  loginUser,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from './service.js';
import { toPublicUser } from './mapper.js';

/**
 * Auth controller factory
 * @param {any} config
 */
export function createAuthController(config) {
  return {
    async register(req, res) {
      const { user, token } = await registerUser(req.valid.body, config);
      res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(config));
      res.status(201).json({ data: { user } });
    },

    async login(req, res) {
      const { user, token } = await loginUser(req.valid.body, config);
      res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(config));
      res.status(200).json({ data: { user } });
    },

    logout(_req, res) {
      res.clearCookie(SESSION_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: config.COOKIE_SECURE,
      });
      res.status(204).end();
    },

    me(req, res) {
      res.status(200).json({ data: { user: toPublicUser(req.user) } });
    },
  };
}
