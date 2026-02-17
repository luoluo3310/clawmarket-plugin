import type { RelayResponse } from '../types/protocol.js';
/**
 * Relay client for buyers to send requests
 */
export declare class RelayClient {
    private relayUrl;
    private pendingRequests;
    private defaultTimeoutMs;
    constructor(relayUrl: string);
    /**
     * Send encrypted request to seller through Relay
     */
    sendRequest(sellerId: string, payload: string, buyerPublicKey: string, model: string, channelId: string, ticketAmount: string, ticketNonce: number, ticketSignature: string, timeoutMs?: number): Promise<RelayResponse>;
    /**
     * Generate unique request ID
     */
    private generateRequestId;
    /**
     * Cancel a pending request
     */
    cancelRequest(requestId: string): void;
    /**
     * Cancel all pending requests
     */
    cancelAll(): void;
}
//# sourceMappingURL=relay.d.ts.map