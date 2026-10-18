// Encrypts Square tokens before they are stored in Supabase (AES-256-GCM).
// SQUARE_TOKEN_KEY must be 32 random bytes, base64-encoded:
//   openssl rand -base64 32
import crypto from 'crypto';

function key() {
  const raw = process.env.SQUARE_TOKEN_KEY;
  if (!raw) throw new Error('SQUARE_TOKEN_KEY is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('SQUARE_TOKEN_KEY must be 32 bytes (base64)');
  return buf;
}

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, enc] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
