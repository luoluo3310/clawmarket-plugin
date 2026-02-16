import type { SellerConfig, ModelConfig } from '../types/config.js';
import type { RegisterResponse, HeartbeatPayload } from '../types/protocol.js';
import { serializePublicKey, type KeyPair } from '../crypto/e2ee.js';

/**
 * Registry client for seller operations
 */
export class RegistryClient {
  private config: SellerConfig;
  private sellerId: string | null = null;
  private token: string | null = null;

  constructor(config: SellerConfig) {
    this.config = config;
  }

  /**
   * Register as a seller with the Registry
   */
  async register(keyPair: KeyPair, walletAddress: string): Promise<RegisterResponse> {
    const payload = {
      publicKey: serializePublicKey(keyPair.publicKey),
      walletAddress,
      models: this.config.models.map((m: ModelConfig) => ({
        model: m.model,
        pricing: m.pricing,
        dailyQuotaUsd: m.dailyQuotaUsd,
      })),
      region: this.config.region,
      relayEndpoint: this.config.relayUrl,
    };

    const response = await fetch(`${this.config.registryUrl}/v1/sellers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Registration failed: ${response.status} - ${error}`);
    }

    const result = await response.json() as RegisterResponse;
    this.sellerId = result.sellerId;
    this.token = result.token;
    
    return result;
  }

  /**
   * Send heartbeat to Registry
   */
  async heartbeat(availableQuota: Record<string, number>, latencyMs?: number): Promise<void> {
    if (!this.sellerId || !this.token) {
      throw new Error('Not registered. Call register() first.');
    }

    const payload: HeartbeatPayload = {
      sellerId: this.sellerId,
      timestamp: Date.now(),
      availableQuota,
      latencyMs,
    };

    const response = await fetch(
      `${this.config.registryUrl}/v1/sellers/${this.sellerId}/heartbeat`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Heartbeat failed: ${response.status} - ${error}`);
    }
  }

  /**
   * Unregister from Registry
   */
  async unregister(): Promise<void> {
    if (!this.sellerId || !this.token) {
      return;
    }

    try {
      await fetch(`${this.config.registryUrl}/v1/sellers/${this.sellerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` },
      });
    } catch {
      // Ignore errors during unregister
    }

    this.sellerId = null;
    this.token = null;
  }

  get id(): string | null {
    return this.sellerId;
  }

  get authToken(): string | null {
    return this.token;
  }
}
