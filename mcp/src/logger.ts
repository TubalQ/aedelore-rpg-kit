import pino from "pino";
import { config } from "./config.js";

const TOKEN_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function redactTokens(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(TOKEN_PATTERN, "[REDACTED]");
  }
  return value;
}

/**
 * Errors without personal data (M7). jose's JWT errors (JWTExpired and
 * friends) carry the decoded `payload`, with e-mail, name and roles, and the
 * standard serializer logged all of it. Token-looking strings in the message
 * and stack are redacted too.
 */
const OMITTED_ERROR_KEYS = ["payload"];
export function serializeError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  const out: Record<string, unknown> = { ...pino.stdSerializers.err(err) };
  for (const key of OMITTED_ERROR_KEYS) delete out[key];
  if (typeof out.message === "string") out.message = redactTokens(out.message);
  if (typeof out.stack === "string") out.stack = redactTokens(out.stack);
  return out;
}

export const logger = pino({
  level: config.LOG_LEVEL,
  // A serializer only runs on object keys, never on the message string: token
  // redaction of messages happens here (it never ran before, M7).
  hooks: {
    logMethod(args, method) {
      method.apply(this, args.map((a) => (typeof a === "string" ? redactTokens(a) : a)) as Parameters<typeof method>);
    },
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        ...req.headers,
        authorization: req.headers?.authorization ? "[REDACTED]" : undefined,
      },
    }),
    err: serializeError,
  },
});

export function childLogger(context: {
  toolName?: string;
  userId?: string;
  correlationId?: string;
}) {
  return logger.child(context);
}
