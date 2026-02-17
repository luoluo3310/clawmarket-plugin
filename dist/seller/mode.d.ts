import { EventEmitter } from 'events';
import type { SellerConfig } from '../types/config.js';
import { type KeyPair } from '../crypto/e2ee.js';
export interface SellerModeEvents {
    started: () => void;
    stopped: () => void;
    request: (requestId: string, model: string) => void;
    response: (requestId: string, success: boolean) => void;
    error: (error: Error) => void;
}
/**
 * Seller mode handler
 * - Registers with Registry
 * - Connects to Relay
 * - Handles incoming requests
 * - Forwards to upstream API
 */
export declare class SellerMode extends EventEmitter {
    private config;
    private walletAddress;
    private contractAddress;
    private keyPair;
    private registry;
    private relay;
    private heartbeatTimer;
    private isRunning;
    private quotaUsed;
    constructor(config: SellerConfig, walletAddress: `0x${string}`, contractAddress: `0x${string}`, keyPair?: KeyPair);
    /**
     * Start seller mode
     */
    start(): Promise<void>;
    /**
     * Stop seller mode
     */
    stop(): Promise<void>;
    /**
     * Handle incoming request from buyer
     */
    private handleRequest;
    /**
     * Forward request to upstream API
     */
    private forwardToUpstream;
    /**
     * Start heartbeat timer
     */
    private startHeartbeat;
    /**
     * Stop heartbeat timer
     */
    private stopHeartbeat;
    /**
     * Get public key for buyers
     */
    get publicKey(): Uint8Array;
    /**
     * Check if running
     */
    get running(): boolean;
}
//# sourceMappingURL=mode.d.ts.map