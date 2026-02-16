import { EventEmitter } from 'events';
import { ClawMarketConfigSchema, type ClawMarketConfig } from './types/config.js';
import type { ChatCompletionRequest, ChatCompletionResponse } from './types/protocol.js';
import { SellerMode } from './seller/mode.js';
import { BuyerMode } from './buyer/mode.js';
import { generateKeyPair, hexToBytes, bytesToHex, type KeyPair } from './crypto/e2ee.js';

export interface ClawMarketPluginEvents {
  started: (role: string) => void;
  stopped: () => void;
  error: (error: Error) => void;
}

/**
 * ClawMarket Gateway Plugin
 * 
 * Integrates ClawMarket decentralized API marketplace with OpenClaw Gateway.
 * Supports both seller and buyer modes.
 */
export class ClawMarketPlugin extends EventEmitter {
  private config: ClawMarketConfig;
  private keyPair: KeyPair;
  private sellerMode: SellerMode | null = null;
  private buyerMode: BuyerMode | null = null;
  private isStarted = false;

  constructor(config: unknown) {
    super();
    
    // Validate and parse config
    const parsed = ClawMarketConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(`Invalid config: ${parsed.error.message}`);
    }
    
    this.config = parsed.data;
    
    // Initialize or load key pair
    if (this.config.wallet.privateKey) {
      const privateKeyBytes = hexToBytes(this.config.wallet.privateKey);
      const { getPublicKey } = require('./crypto/e2ee.js');
      this.keyPair = {
        privateKey: privateKeyBytes,
        publicKey: getPublicKey(privateKeyBytes),
      };
    } else {
      this.keyPair = generateKeyPair();
    }
  }

  /**
   * Start the plugin
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    if (!this.config.enabled) {
      return;
    }

    const { role, seller, buyer, wallet } = this.config;
    const privateKey = wallet.privateKey 
      ? (wallet.privateKey.startsWith('0x') ? wallet.privateKey : `0x${wallet.privateKey}`) as `0x${string}`
      : bytesToHex(this.keyPair.privateKey) as `0x${string}`;

    try {
      // Start seller mode
      if ((role === 'seller' || role === 'both') && seller) {
        this.sellerMode = new SellerMode(
          seller,
          privateKey.slice(0, 42) as `0x${string}`, // Derive address in production
          wallet.channelContractAddress as `0x${string}`,
          this.keyPair
        );

        this.sellerMode.on('error', (err) => this.emit('error', err));
        await this.sellerMode.start();
      }

      // Start buyer mode
      if ((role === 'buyer' || role === 'both') && buyer) {
        this.buyerMode = new BuyerMode(
          buyer,
          privateKey,
          wallet.channelContractAddress as `0x${string}`,
          wallet.rpcUrl,
          wallet.chainId,
          this.keyPair
        );

        this.buyerMode.on('error', (err) => this.emit('error', err));
      }

      this.isStarted = true;
      this.emit('started', role);
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Stop the plugin
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.sellerMode?.stop();
    this.sellerMode = null;
    this.buyerMode = null;
    
    this.isStarted = false;
    this.emit('stopped');
  }

  /**
   * Send a chat completion request (buyer mode)
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.buyerMode) {
      throw new Error('Buyer mode not enabled');
    }

    return this.buyerMode.chatCompletion(request);
  }

  /**
   * Check if plugin is running
   */
  get running(): boolean {
    return this.isStarted;
  }

  /**
   * Get current role
   */
  get role(): string {
    return this.config.role;
  }

  /**
   * Get public key (hex)
   */
  get publicKey(): string {
    return bytesToHex(this.keyPair.publicKey);
  }
}

// Re-export types and utilities
export * from './types/index.js';
export * from './crypto/index.js';
export * from './seller/index.js';
export * from './buyer/index.js';
