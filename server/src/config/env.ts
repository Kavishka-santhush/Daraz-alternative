import dotenv from 'dotenv';
dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    // Fail fast in production; in dev we allow placeholders so the app can boot for inspection.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return `dev-${name}`;
  }
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const parsed = Number(v);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num('PORT', 5000),
  webUrl: req('WEB_URL', 'http://localhost:3000'),
  apiUrl: req('API_URL', 'http://localhost:5000'),

  databaseUrl: req('DATABASE_URL'),

  jwt: {
    accessSecret: req('JWT_SECRET'),
    refreshSecret: req('JWT_REFRESH_SECRET'),
    accessExpires: req('JWT_ACCESS_EXPIRES', '15m'),
    refreshExpires: req('JWT_REFRESH_EXPIRES', '30d'),
  },

  stripe: {
    secretKey: req('STRIPE_SECRET_KEY', 'sk_test_placeholder'),
    webhookSecret: req('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder'),
  },

  openrouter: {
    apiKey: req('OPENROUTER_API_KEY', ''),
    baseUrl: req('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
    model: req('OPENROUTER_MODEL', 'openai/gpt-4o'),
  },

  upload: {
    dir: req('UPLOAD_DIR', 'uploads'),
    maxFileSizeMb: num('MAX_FILE_SIZE_MB', 10),
  },

  smtp: {
    host: req('SMTP_HOST', 'smtp.mailtrap.io'),
    port: num('SMTP_PORT', 2525),
    user: req('SMTP_USER', ''),
    pass: req('SMTP_PASS', ''),
    from: req('EMAIL_FROM', 'Marketplace <no-reply@marketplace.local>'),
  },

  vapid: {
    publicKey: req('VAPID_PUBLIC_KEY', ''),
    privateKey: req('VAPID_PRIVATE_KEY', ''),
    subject: req('VAPID_SUBJECT', 'mailto:admin@marketplace.local'),
  },

  business: {
    defaultCommissionPercent: num('DEFAULT_COMMISSION_PERCENT', 8),
    sellerConfirmTimeoutHours: num('SELLER_CONFIRM_TIMEOUT_HOURS', 24),
    returnWindowDays: num('RETURN_WINDOW_DAYS', 7),
    currency: req('CURRENCY', 'LKR'),
    lowStockThreshold: num('LOW_STOCK_ALERT_THRESHOLD', 5),
  },
} as const;
