import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from 'crypto';
/**
 * Generate a new secp256k1 key pair
 */
export function generateKeyPair() {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = secp256k1.getPublicKey(privateKey, false); // uncompressed
    return { privateKey, publicKey, secretKey: privateKey };
}
/**
 * Derive public key from private key
 */
export function getPublicKey(privateKey) {
    return secp256k1.getPublicKey(privateKey, false);
}
/**
 * Compute shared secret using ECDH
 */
export function computeSharedSecret(privateKey, publicKey) {
    const shared = secp256k1.getSharedSecret(privateKey, publicKey);
    // Hash the shared secret to get a 32-byte key
    return sha256(shared);
}
/**
 * Encrypt data using AES-256-GCM with ECDH shared secret
 */
export async function encrypt(plaintext, senderPrivateKey, recipientPublicKey) {
    const sharedSecret = computeSharedSecret(senderPrivateKey, recipientPublicKey);
    // Generate random IV (12 bytes for GCM)
    const iv = randomBytes(12);
    // Import key for Web Crypto API
    const key = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['encrypt']);
    // Encrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return Buffer.from(combined).toString('base64');
}
/**
 * Decrypt data using AES-256-GCM with ECDH shared secret
 */
export async function decrypt(encryptedBase64, recipientPrivateKey, senderPublicKey) {
    const sharedSecret = computeSharedSecret(recipientPrivateKey, senderPublicKey);
    // Decode base64
    const combined = Buffer.from(encryptedBase64, 'base64');
    // Extract IV and ciphertext
    const iv = combined.subarray(0, 12);
    const ciphertext = combined.subarray(12);
    // Import key
    const key = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt']);
    // Decrypt
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
}
/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex) {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    return new Uint8Array(Buffer.from(cleanHex, 'hex'));
}
/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes) {
    return '0x' + Buffer.from(bytes).toString('hex');
}
/**
 * Serialize public key for transmission
 */
export function serializePublicKey(publicKey) {
    return bytesToHex(publicKey);
}
/**
 * Deserialize public key from transmission
 */
export function deserializePublicKey(serialized) {
    return hexToBytes(serialized);
}
//# sourceMappingURL=e2ee.js.map