import { EventEmitter } from 'events';
import type { BuyerConfig } from '../types/config.js';
import type {
  SellerInfo,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChannelState,
} from '../types/protocol.js';
import { DiscoveryClient } from './discovery.js';
import { RelayClient } from './relay.js';
import {
  generateKeyPair,
  encrypt,
  decrypt,
  deserializePublicKey,
  serializePublicKey,
  type KeyPair,
} from '../crypto/e2ee.js';
import { TicketSigner, calculateTicketAmount } from '../crypto/ticket.js';

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
export class BuyerMode extends EventEmitter {
  private config: BuyerConfig;
  private discovery: DiscoveryClient;
  private relay: RelayClient;
  private keyPair: KeyPair;
  private ticketSigner: TicketSigner;
  private channels: Map<string, ChannelState> = new Map(); // sellerId -> channel
  private nonceCounters: Map<string, bigint> = new Map(); // channelId -> nonce

  constructor(
    config: BuyerConfig,
    privateKey: `0x${string}`,
    contractAddress: `0x${string}`,
    rpcUrl: string,
    chainId?: number,
    keyPair?: KeyPair
  ) {
    super();
    this.config = config;
    this.discovery = new DiscoveryClient(config);
    this.relay = new RelayClient(config.relayUrl);
    this.keyPair = keyPair || generateKeyPair();
    this.ticketSigner = new TicketSigner(privateKey, contractAddress, rpcUrl, chainId);
  }

  /**
   * Send a chat completion request through ClawMarket
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const { model } = request;

    try {
      // Find best seller
      const seller = await this.discovery.selectSeller(model);
      
      if (!seller) {
        return this.handleFallback(request, 'No sellers available');
      }

      // Check price multiplier
      const pricing = this.discovery.getModelPricing(seller, model);
      if (!pricing) {
        return this.handleFallback(request, 'Model pricing not found');
      }

      // Get or create channel
      const channel = await this.getOrCreateChannel(seller);
      if (!channel) {
        return this.handleFallback(request, 'Failed to establish payment channel');
      }

      this.emit('request', model, seller.id);

      // Estimate cost and create ticket
      const estimatedTokens = this.estimateTokens(request);
      const estimatedCost = calculateTicketAmount(
        estimatedTokens.input,
        estimatedTokens.output,
        pricing
      );

      const nonce = this.getNextNonce(channel.channelId);
      const cumulativeAmount = Number(channel.settledAmount) / 1e6 + estimatedCost;
      
      const ticket = await this.ticketSigner.createTicket(
        channel.channelId,
        cumulativeAmount,
        nonce
      );

      // Encrypt request
      const sellerPubKey = deserializePublicKey(seller.publicKey);
      const encryptedPayload = await encrypt(
        JSON.stringify(request),
        this.keyPair.privateKey,
        sellerPubKey
      );

      // Send through relay
      const response = await this.relay.sendRequest(
        seller.id,
        encryptedPayload,
        serializePublicKey(this.keyPair.publicKey),
        model,
        channel.channelId,
        ticket.amount.toString(),
        Number(ticket.nonce),
        ticket.signature
      );

      // Decrypt response
      const decryptedResponse = await decrypt(
        response.payload!,
        this.keyPair.privateKey,
        sellerPubKey
      );

      const chatResponse = JSON.parse(decryptedResponse) as ChatCompletionResponse;
      
      this.emit('response', model, seller.id, true);
      return chatResponse;
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      return this.handleFallback(request, err instanceof Error ? err.message : 'Unknown error');
    }
  }

  /**
   * Handle fallback to direct provider
   */
  private async handleFallback(
    request: ChatCompletionRequest,
    reason: string
  ): Promise<ChatCompletionResponse> {
    this.emit('fallback', request.model, reason);

    if (!this.config.fallbackProvider) {
      throw new Error(`No sellers available and no fallback configured: ${reason}`);
    }

    // In production, this would call the fallback provider directly
    throw new Error(`Fallback not implemented: ${reason}`);
  }

  /**
   * Get or create payment channel with seller
   */
  private async getOrCreateChannel(seller: SellerInfo): Promise<ChannelState | null> {
    const existing = this.channels.get(seller.id);
    
    if (existing && existing.isActive && existing.expiresAt > Date.now() / 1000) {
      return existing;
    }

    // In production, this would:
    // 1. Check if channel exists on-chain
    // 2. If not, call openChannel() on the contract
    // 3. Store channel state locally
    
    // For now, return a mock channel for development
    const mockChannel: ChannelState = {
      channelId: `0x${'0'.repeat(64)}` as `0x${string}`,
      buyer: this.ticketSigner.address,
      seller: seller.id as `0x${string}`,
      deposit: BigInt(10e6), // 10 USDC
      settledAmount: BigInt(0),
      expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      isActive: true,
      currentNonce: BigInt(0),
    };

    this.channels.set(seller.id, mockChannel);
    return mockChannel;
  }

  /**
   * Get next nonce for a channel
   */
  private getNextNonce(channelId: `0x${string}`): bigint {
    const current = this.nonceCounters.get(channelId) ?? BigInt(0);
    const next = current + BigInt(1);
    this.nonceCounters.set(channelId, next);
    return next;
  }

  /**
   * Estimate token usage for a request
   */
  private estimateTokens(request: ChatCompletionRequest): { input: number; output: number } {
    // Rough estimation: 4 chars per token
    const inputChars = request.messages.reduce((sum, m) => sum + m.content.length, 0);
    const inputTokens = Math.ceil(inputChars / 4);
    
    // Estimate output based on max_tokens or default
    const outputTokens = request.max_tokens ?? 1000;

    return { input: inputTokens, output: outputTokens };
  }

  /**
   * Get buyer's public key
   */
  get publicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  /**
   * Get buyer's wallet address
   */
  get address(): `0x${string}` {
    return this.ticketSigner.address;
  }

  /**
   * Refresh seller cache
   */
  async refreshSellers(): Promise<void> {
    this.discovery.clearCache();
    await this.discovery.fetchSellers(undefined, true);
  }
}
