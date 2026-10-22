export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
}

/** Platform implementations can keep refresh credentials in memory or native secure storage. */
export interface TokenStore {
  read(): Promise<TokenSet | null>;
  write(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

/** Default web/client store: tokens never leave this JavaScript process. */
export class MemoryTokenStore implements TokenStore {
  private tokens: TokenSet | null = null;

  async read(): Promise<TokenSet | null> {
    return this.tokens ? { ...this.tokens } : null;
  }

  async write(tokens: TokenSet): Promise<void> {
    this.tokens = { ...tokens };
  }

  async clear(): Promise<void> {
    this.tokens = null;
  }
}
