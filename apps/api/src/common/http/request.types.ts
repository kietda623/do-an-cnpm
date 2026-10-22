export type ApiRequest = {
  method: string;
  originalUrl?: string;
  path?: string;
  requestId?: string;
  headers: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
  once(event: "finish", listener: () => void): void;
};

export type Next = (error?: Error) => void;
