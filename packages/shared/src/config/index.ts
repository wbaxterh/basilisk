/**
 * Config loader — reads environment variables with typed defaults.
 * Each service calls `loadConfig()` at startup. Missing required vars throw immediately.
 */

/** All known config keys and their types. */
export interface BasiliskConfig {
  // Cardano data layer
  demeterProjectId: string;
  demeterOgmiosUrl: string;
  demeterKupoUrl: string;
  demeterDbsyncUrl: string;
  demeterApiKey: string;
  blockfrostProjectId: string;
  blockfrostNetwork: "mainnet" | "preprod" | "preview";

  // Datastores
  databaseUrl: string;
  timescaleUrl: string;
  redisUrl: string;

  // Auth
  jwtSecret: string;
  sessionSecret: string;

  // Service ports
  portApiGateway: number;
  portPricing: number;
  portPortfolio: number;
  portAlerts: number;
  portNotifications: number;

  // Observability
  sentryDsn: string;
  logLevel: LogLevel;

  // General
  nodeEnv: "development" | "production" | "test";
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Mapping from config keys to env var names.
 * Keeps the translation in one place.
 */
const ENV_MAP: Record<keyof BasiliskConfig, string> = {
  demeterProjectId: "DEMETER_PROJECT_ID",
  demeterOgmiosUrl: "DEMETER_OGMIOS_URL",
  demeterKupoUrl: "DEMETER_KUPO_URL",
  demeterDbsyncUrl: "DEMETER_DBSYNC_URL",
  demeterApiKey: "DEMETER_API_KEY",
  blockfrostProjectId: "BLOCKFROST_PROJECT_ID",
  blockfrostNetwork: "BLOCKFROST_NETWORK",
  databaseUrl: "DATABASE_URL",
  timescaleUrl: "TIMESCALE_URL",
  redisUrl: "REDIS_URL",
  jwtSecret: "JWT_SECRET",
  sessionSecret: "SESSION_SECRET",
  portApiGateway: "PORT_API_GATEWAY",
  portPricing: "PORT_PRICING",
  portPortfolio: "PORT_PORTFOLIO",
  portAlerts: "PORT_ALERTS",
  portNotifications: "PORT_NOTIFICATIONS",
  sentryDsn: "SENTRY_DSN",
  logLevel: "LOG_LEVEL",
  nodeEnv: "NODE_ENV",
};

/** Defaults for optional config values. */
const DEFAULTS: Partial<Record<keyof BasiliskConfig, string>> = {
  blockfrostNetwork: "mainnet",
  portApiGateway: "4000",
  portPricing: "4010",
  portPortfolio: "4020",
  portAlerts: "4030",
  portNotifications: "4040",
  logLevel: "info",
  nodeEnv: "development",
};

/**
 * Load a subset of config from environment variables.
 * Only the keys you ask for are required (unless they have defaults).
 *
 * @example
 * const cfg = loadConfig("databaseUrl", "blockfrostProjectId", "logLevel");
 * // cfg.databaseUrl is string, cfg.blockfrostProjectId is string, etc.
 */
export function loadConfig<K extends keyof BasiliskConfig>(
  ...keys: K[]
): Pick<BasiliskConfig, K> {
  const result: Partial<BasiliskConfig> = {};
  const missing: string[] = [];

  for (const key of keys) {
    const envVar = ENV_MAP[key];
    const raw = process.env[envVar] ?? DEFAULTS[key];

    if (raw === undefined || raw === "") {
      missing.push(`${envVar} (config key: ${key})`);
      continue;
    }

    // Parse numbers for port keys
    if (key.startsWith("port")) {
      const num = parseInt(raw, 10);
      if (Number.isNaN(num)) {
        throw new Error(`Config ${envVar} must be a number, got: "${raw}"`);
      }
      (result as Record<string, unknown>)[key] = num;
    } else {
      (result as Record<string, unknown>)[key] = raw;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join("\n  ")}\n\nSee .env.example for the full list.`,
    );
  }

  return result as Pick<BasiliskConfig, K>;
}

/**
 * Get a single env var with an optional default. Throws if missing and no default.
 */
export function envOrThrow(name: string, defaultValue?: string): string {
  const val = process.env[name] ?? defaultValue;
  if (val === undefined || val === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}
