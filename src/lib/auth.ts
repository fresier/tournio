import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { getPrisma } from './database/client';
import { trustedOrigins } from './origins';
import { authBaseURL, googleProvider, passwordLoginEnabled } from './auth-config';

function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET est requise.');
  const google = googleProvider();
  return betterAuth({
    appName: 'Tournio', baseURL: authBaseURL(), secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(getPrisma(), { provider: 'postgresql' }),
    socialProviders: google ? { google } : {},
    emailAndPassword: { enabled: passwordLoginEnabled(), disableSignUp: true, minPasswordLength: 12 },
    account: { encryptOAuthTokens: true, accountLinking: { enabled: true, trustedProviders: [], allowDifferentEmails: false } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 10 } } },
    trustedOrigins: trustedOrigins(),
    advanced: { cookiePrefix: 'tournio', database: { generateId: () => crypto.randomUUID() } },
    plugins: [nextCookies()],
    onAPIError: { errorURL: '/login' },
    logger: { disabled: true },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
