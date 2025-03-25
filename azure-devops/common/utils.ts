export function encodeToBase64(input: string): string {
  return Buffer.from(input).toString('base64');
}
