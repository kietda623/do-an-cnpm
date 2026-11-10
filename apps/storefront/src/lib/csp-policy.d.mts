export type CspPolicyOptions = {
  nonce: string;
  requestUrl: string;
  apiUrl: string;
  assetUrl?: string;
  development: boolean;
};

export function createCspPolicy(options: CspPolicyOptions): string;
