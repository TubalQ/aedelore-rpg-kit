import pino from "pino";
import { config } from "./config.js";

const TOKEN_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function redactTokens(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(TOKEN_PATTERN, "[REDACTED]");
  }
  return value;
}

export const logger = pino({
  level: config.LOG_LEVEL,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        ...req.headers,
        authorization: req.headers?.authorization ? "[REDACTED]" : undefined,
      },
    }),
    err: pino.stdSerializers.err,
    msg: redactTokens,
  },
});

export function childLogger(context: {
  toolName?: string;
  userId?: string;
  correlationId?: string;
}) {
  return logger.child(context);
}
