export function encodeToBase64(input) {
    return Buffer.from(input).toString('base64');
}
