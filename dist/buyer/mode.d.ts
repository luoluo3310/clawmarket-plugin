import { EventEmitter } from 'events';
import type { BuyerConfig } from '../types/config.js';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../types/protocol.js';
import { type KeyPair } from '../crypto/e2ee.js';
export interface BuyerModeEvents {
    request: (model: string, sellerId: string) => void;
    response: (model: string, sellerId: string, success: boolean) => void;
    fallback: (model: string, reason: string) => void;
    error: (error: Error) => void;
}
/**
 * Buyer mode handler
 * - Discovers sellers
 * - Selects best seller
 * - Sends encrypted requests
 * - Handles payments
 */
export declare class BuyerMode extends EventEmitter {
    private config;
    private discovery;
    private relay;
    private keyPair;
    private ticketSigner;
    private channels;
    private nonceCounters;
    constructor(config: BuyerConfig, privateKey: `0x${string}`, contractAddress: `0x${string}`, rpcUrl: string, chainId?: number, keyPair?: KeyPair);
    /**
     * Send a chat completion request through ClawMarket
     */
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    /**
     * Handle fallback to direct provider
     */
    private handleFallback;
    /**
     * Get or create payment channel with seller
     */
    private getOrCreateChannel;
    /**
     * Get next nonce for a channel
     */
    private getNextNonce;
    /**
     * Estimate token usage for a request
     */
    private estimateTokens;
    /**
     * Get buyer's public key
     */
    get publicKey(): Uint8Array;
    /**
     * Get buyer's wallet address
     */
    get address(): `0x${string}`;
    /**
     * Refresh seller cache
     */
    refreshSellers(): Promise<void>;
}
//# sourceMappingURL=mode.d.ts.map