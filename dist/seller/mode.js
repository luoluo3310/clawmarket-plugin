import { EventEmitter } from 'events';
import { RegistryClient } from './registry.js';
import { RelayConnection } from './relay.js';
import { generateKeyPair, encrypt, decrypt, deserializePublicKey, } from '../crypto/e2ee.js';
import { getDefaultDomain, calculateTicketAmount, } from '../crypto/ticket.js';
/**
 * Seller mode handler
 * - Registers with Registry
 * - Connects to Relay
 * - Handles incoming requests
 * - Forwards to upstream API
 */
export class SellerMode extends EventEmitter {
    config;
    walletAddress;
    contractAddress;
    keyPair;
    registry;
    relay = null;
    heartbeatTimer = null;
    isRunning = false;
    quotaUsed = {};
    constructor(config, walletAddress, contractAddress, keyPair) {
        super();
        this.config = config;
        this.walletAddress = walletAddress;
        this.contractAddress = contractAddress;
        this.keyPair = keyPair || generateKeyPair();
        this.registry = new RegistryClient(config);
    }
    /**
     * Start seller mode
     */
    async start() {
        if (this.isRunning) {
            return;
        }
        try {
            // Register with Registry
            const registration = await this.registry.register(this.keyPair, this.walletAddress);
            // Connect to Relay
            this.relay = new RelayConnection(this.config.relayUrl, registration.sellerId, registration.token);
            this.relay.on('connected', () => {
                this.startHeartbeat();
            });
            this.relay.on('request', (request) => {
                this.handleRequest(request).catch((err) => {
                    this.emit('error', err);
                });
            });
            this.relay.on('error', (err) => {
                this.emit('error', err);
            });
            this.relay.connect();
            this.isRunning = true;
            this.emit('started');
        }
        catch (err) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }
    /**
     * Stop seller mode
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        this.stopHeartbeat();
        this.relay?.disconnect();
        await this.registry.unregister();
        this.isRunning = false;
        this.emit('stopped');
    }
    /**
     * Handle incoming request from buyer
     */
    async handleRequest(request) {
        const { requestId, payload, buyerPublicKey, model } = request;
        this.emit('request', requestId, model);
        try {
            // Verify ticket signature
            const ticket = {
                channelId: request.channelId,
                amount: BigInt(request.ticketAmount),
                nonce: BigInt(request.ticketNonce),
                signature: request.ticketSignature,
            };
            // Get buyer address from channel (in production, query from contract)
            // For now, we trust the signature verification
            const domain = getDefaultDomain(this.contractAddress);
            // Note: In production, we'd verify against the actual buyer address from the channel
            // const isValid = await verifyTicketSignature(ticket, buyerAddress, domain);
            // Decrypt the request
            const buyerPubKey = deserializePublicKey(buyerPublicKey);
            const decryptedPayload = await decrypt(payload, this.keyPair.privateKey, buyerPubKey);
            const chatRequest = JSON.parse(decryptedPayload);
            // Forward to upstream API
            const upstreamResponse = await this.forwardToUpstream(chatRequest);
            // Calculate cost and update quota
            const modelConfig = this.config.models.find((m) => m.model === model);
            if (modelConfig && upstreamResponse.usage) {
                const cost = calculateTicketAmount(upstreamResponse.usage.prompt_tokens, upstreamResponse.usage.completion_tokens, modelConfig.pricing);
                this.quotaUsed[model] = (this.quotaUsed[model] || 0) + cost;
            }
            // Encrypt response
            const encryptedResponse = await encrypt(JSON.stringify(upstreamResponse), this.keyPair.privateKey, buyerPubKey);
            // Send response back through Relay
            this.relay?.sendResponse(requestId, encryptedResponse);
            this.emit('response', requestId, true);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.relay?.sendError(requestId, errorMessage);
            this.emit('response', requestId, false);
            this.emit('error', err instanceof Error ? err : new Error(errorMessage));
        }
    }
    /**
     * Forward request to upstream API
     */
    async forwardToUpstream(request) {
        const response = await fetch(`${this.config.upstreamBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.upstreamApiKey}`,
            },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upstream API error: ${response.status} - ${error}`);
        }
        return response.json();
    }
    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(async () => {
            try {
                const availableQuota = {};
                for (const model of this.config.models) {
                    const used = this.quotaUsed[model.model] || 0;
                    const quota = model.dailyQuotaUsd || Infinity;
                    availableQuota[model.model] = Math.max(0, quota - used);
                }
                await this.registry.heartbeat(availableQuota);
            }
            catch (err) {
                this.emit('error', err instanceof Error ? err : new Error(String(err)));
            }
        }, this.config.heartbeatIntervalMs);
    }
    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * Get public key for buyers
     */
    get publicKey() {
        return this.keyPair.publicKey;
    }
    /**
     * Check if running
     */
    get running() {
        return this.isRunning;
    }
}
//# sourceMappingURL=mode.js.map