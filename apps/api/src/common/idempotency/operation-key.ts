export function scopedOperationKey(
  scope: string,
  ownerOrResourceId: string,
  clientKey: string,
): string {
  return `${scope}:${ownerOrResourceId}:${clientKey}`;
}
