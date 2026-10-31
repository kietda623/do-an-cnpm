export type WriteIntent = {
  idempotencyKey: string;
  eventId: string;
};

function createUuidV4(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function")
    return cryptoApi.randomUUID();

  if (typeof cryptoApi?.getRandomValues !== "function")
    throw new Error("Secure random number generation is unavailable.");

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";

  if (Array.isArray(value))
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(",")}}`;
}

export class WriteIntentRegistry {
  private readonly intents = new Map<string, WriteIntent>();

  constructor(private readonly createId: () => string = createUuidV4) {}

  clear(): void {
    this.intents.clear();
  }

  getOrCreate(scope: string, body: unknown): WriteIntent {
    const fingerprint = JSON.stringify([scope, canonicalize(body)]);
    const existing = this.intents.get(fingerprint);
    if (existing) return existing;

    const intent = {
      idempotencyKey: this.createId(),
      eventId: this.createId(),
    };
    this.intents.set(fingerprint, intent);
    return intent;
  }

  complete(scope: string, body: unknown): void {
    this.intents.delete(JSON.stringify([scope, canonicalize(body)]));
  }
}

export const writeIntentRegistry = new WriteIntentRegistry();
