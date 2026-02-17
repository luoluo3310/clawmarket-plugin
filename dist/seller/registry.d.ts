import type { SellerConfig } from '../types/config.js';
import type { RegisterResponse } from '../types/protocol.js';
import { type KeyPair } from '../crypto/e2ee.js';
/**
 * Registry client for seller operations
 */
export declare class RegistryClient {
    private config;
    private sellerId;
    private token;
    constructor(config: SellerConfig);
    /**
     * Register as a seller with the Registry
     */
    register(keyPair: KeyPair, walletAddress: string): Promise<RegisterResponse>;
    /**
     * Send heartbeat to Registry
     */
    heartbeat(availableQuota: Record<string, number>, latencyMs?: number): Promise<void>;
    /**
     * Unregister from Registry
     */
    unregister(): Promise<void>;
    get id(): string | null;
    get authToken(): string | null;
}
//# sourceMappingURL=registry.d.ts.map