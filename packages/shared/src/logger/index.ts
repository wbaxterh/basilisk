/**
 * Structured JSON logger for all Basilisk services.
 * Lightweight — no dependencies beyond Node builtins.
 * Outputs one JSON object per line (for log aggregation / Grafana Loki / etc.).
 */

import type { LogLevel } from "../config/index.js";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  level: LogLevel;
  msg: string;
  service: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Create a structured logger for a service.
 *
 * @example
 * const log = createLogger("ingestion");
 * log.info("block ingested", { height: 12345, txCount: 3 });
 * // => {"level":"info","msg":"block ingested","service":"ingestion","height":12345,"txCount":3,"timestamp":"..."}
 */
export function createLogger(
  service: string,
  opts?: { level?: LogLevel; bindings?: Record<string, unknown> },
): Logger {
  const minLevel = opts?.level ?? (process.env["LOG_LEVEL"] as LogLevel) ?? "info";
  const baseBindings = opts?.bindings ?? {};

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
  }

  function write(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      msg,
      service,
      ...baseBindings,
      ...data,
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(entry);

    if (level === "error" || level === "warn") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }

  return {
    debug: (msg, data) => write("debug", msg, data),
    info: (msg, data) => write("info", msg, data),
    warn: (msg, data) => write("warn", msg, data),
    error: (msg, data) => write("error", msg, data),
    child(bindings) {
      return createLogger(service, {
        level: minLevel,
        bindings: { ...baseBindings, ...bindings },
      });
    },
  };
}
