import { Injectable, LoggerService } from "@nestjs/common";

const sensitiveKey =
  /password|authorization|cookie|token|secret|api[_-]?key|refresh|email|phone|address|recipient|display[_-]?name|full[_-]?name/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /((?:password|token|secret|authorization|cookie|api[_-]?key|email|phone|address|recipient|display[_-]?name|full[_-]?name)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(postgres(?:ql)?:\/\/)[^\s:/@]+(?::[^\s/@]*)?@/gi, "$1[REDACTED]@")
    .replace(/(?<![A-Z0-9])\+?\d[\d ().-]{7,}\d(?![A-Z0-9])/gi, "[REDACTED_PHONE]")
    .replace(emailPattern, "[REDACTED_EMAIL]");
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactText(value);
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactValue(item, seen),
    ]),
  );
}

@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("info", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("error", message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("verbose", message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", message, optionalParams);
  }

  request(event: {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }): void {
    this.write("info", { event: "http.request", ...event }, []);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      message: redactValue(message),
      ...(optionalParams.length ? { context: redactValue(optionalParams) } : {}),
    };
    const output = `${JSON.stringify(record)}\n`;
    if (level === "error" || level === "fatal") {
      process.stderr.write(output);
      return;
    }
    process.stdout.write(output);
  }
}
