/**
 * Relay client for buyers to send requests
 */
export class RelayClient {
    relayUrl;
    pendingRequests = new Map();
    defaultTimeoutMs = 60000; // 60 seconds
    constructor(relayUrl) {
        this.relayUrl = relayUrl;
    }
    /**
     * Send encrypted request to seller through Relay
     */
    async sendRequest(sellerId, payload, buyerPublicKey, model, channelId, ticketAmount, ticketNonce, ticketSignature, timeoutMs) {
        const requestId = this.generateRequestId();
        const timeout = timeoutMs ?? this.defaultTimeoutMs;
        const requestBody = {
            sellerId,
            requestId,
            payload,
            buyerPublicKey,
            model,
            channelId,
            ticketAmount,
            ticketNonce,
            ticketSignature,
            timestamp: Date.now(),
        };
        // Create promise for response
        const responsePromise = new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request ${requestId} timed out after ${timeout}ms`));
            }, timeout);
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout: timeoutHandle,
            });
        });
        try {
            // Send request to Relay via HTTP
            const response = await fetch(`${this.relayUrl}/relay/forward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Relay forward failed: ${response.status} - ${error}`);
            }
            // For HTTP-based relay, response comes back directly
            const relayResponse = await response.json();
            if (relayResponse.type === 'error') {
                throw new Error(relayResponse.error || 'Unknown relay error');
            }
            // Clear timeout and resolve
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(requestId);
            }
            return relayResponse;
        }
        catch (err) {
            // Clean up pending request
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(requestId);
            }
            throw err;
        }
    }
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
    /**
     * Cancel a pending request
     */
    cancelRequest(requestId) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Request cancelled'));
            this.pendingRequests.delete(requestId);
        }
    }
    /**
     * Cancel all pending requests
     */
    cancelAll() {
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('All requests cancelled'));
        }
        this.pendingRequests.clear();
    }
}
//# sourceMappingURL=relay.js.map