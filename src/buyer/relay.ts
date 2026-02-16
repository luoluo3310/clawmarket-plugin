import type { RelayMessage, RelayResponse } from '../types/protocol.js';

interface PendingRequest {
  resolve: (response: RelayResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Relay client for buyers to send requests
 */
export class RelayClient {
  private relayUrl: string;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private defaultTimeoutMs = 60000; // 60 seconds

  constructor(relayUrl: string) {
    this.relayUrl = relayUrl;
  }

  /**
   * Send encrypted request to seller through Relay
   */
  async sendRequest(
    sellerId: string,
    payload: string,
    buyerPublicKey: string,
    model: string,
    channelId: string,
    ticketAmount: string,
    ticketNonce: number,
    ticketSignature: string,
    timeoutMs?: number
  ): Promise<RelayResponse> {
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
    const responsePromise = new Promise<RelayResponse>((resolve, reject) => {
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
      const relayResponse = await response.json() as RelayMessage;

      if (relayResponse.type === 'error') {
        throw new Error(relayResponse.error || 'Unknown relay error');
      }

      // Clear timeout and resolve
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
      }

      return relayResponse as RelayResponse;
    } catch (err) {
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
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): void {
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
  cancelAll(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('All requests cancelled'));
    }
    this.pendingRequests.clear();
  }
}
