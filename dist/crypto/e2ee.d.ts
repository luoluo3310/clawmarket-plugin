/**
 * Key pair for E2EE communication
 */
export interface KeyPair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
/**
 * Generate a new secp256k1 key pair
 */
export declare function generateKeyPair(): KeyPair;
/**
 * Derive public key from private key
 */
export declare function getPublicKey(privateKey: Uint8Array): Uint8Array;
/**
 * Compute shared secret using ECDH
 */
export declare function computeSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array;
/**
 * Encrypt data using AES-256-GCM with ECDH shared secret
 */
export declare function encrypt(plaintext: string, senderPrivateKey: Uint8Array, recipientPublicKey: Uint8Array): Promise<string>;
/**
 * Decrypt data using AES-256-GCM with ECDH shared secret
 */
export declare function decrypt(encryptedBase64: string, recipientPrivateKey: Uint8Array, senderPublicKey: Uint8Array): Promise<string>;
/**
 * Convert hex string to Uint8Array
 */
export declare function hexToBytes(hex: string): Uint8Array;
/**
 * Convert Uint8Array to hex string
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Serialize public key for transmission
 */
export declare function serializePublicKey(publicKey: Uint8Array): string;
/**
 * Deserialize public key from transmission
 */
export declare function deserializePublicKey(serialized: string): Uint8Array;
//# sourceMappingURL=e2ee.d.ts.map