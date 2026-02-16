import {
  createWalletClient,
  http,
  type WalletClient,
  type Account,
  type Chain,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import type { Ticket, SignedTicket } from '../types/protocol.js';

/**
 * EIP-712 domain for ClawChannel contract
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

/**
 * Default domain for Base Sepolia
 */
export function getDefaultDomain(contractAddress: `0x${string}`): EIP712Domain {
  return {
    name: 'ClawChannel',
    version: '1',
    chainId: 84532, // Base Sepolia
    verifyingContract: contractAddress,
  };
}

/**
 * EIP-712 types for Ticket
 */
export const TICKET_TYPES = {
  Ticket: [
    { name: 'channelId', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

/**
 * Ticket signer for buyers
 */
export class TicketSigner {
  private walletClient: WalletClient;
  private account: Account;
  private domain: EIP712Domain;

  constructor(
    privateKey: `0x${string}`,
    contractAddress: `0x${string}`,
    rpcUrl: string,
    chainId: number = 84532
  ) {
    this.account = privateKeyToAccount(privateKey);
    
    const chain: Chain = chainId === 84532 ? baseSepolia : {
      id: chainId,
      name: 'Custom',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    };

    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(rpcUrl),
    });

    this.domain = {
      name: 'ClawChannel',
      version: '1',
      chainId,
      verifyingContract: contractAddress,
    };
  }

  /**
   * Get the signer's address
   */
  get address(): `0x${string}` {
    return this.account.address;
  }

  /**
   * Sign a payment ticket
   */
  async signTicket(ticket: Ticket): Promise<SignedTicket> {
    const signature = await this.walletClient.signTypedData({
      account: this.account,
      domain: this.domain,
      types: TICKET_TYPES,
      primaryType: 'Ticket',
      message: {
        channelId: ticket.channelId,
        amount: ticket.amount,
        nonce: ticket.nonce,
      },
    });

    return {
      ...ticket,
      signature,
    };
  }

  /**
   * Create and sign a ticket with USD amount
   */
  async createTicket(
    channelId: `0x${string}`,
    amountUsd: number,
    nonce: bigint
  ): Promise<SignedTicket> {
    // Convert USD to USDC (6 decimals)
    const amount = parseUnits(amountUsd.toFixed(6), 6);
    
    return this.signTicket({
      channelId,
      amount,
      nonce,
    });
  }
}

/**
 * Verify a ticket signature (for sellers)
 */
export async function verifyTicketSignature(
  ticket: SignedTicket,
  expectedSigner: `0x${string}`,
  domain: EIP712Domain
): Promise<boolean> {
  const { verifyTypedData } = await import('viem');
  
  try {
    const isValid = await verifyTypedData({
      address: expectedSigner,
      domain,
      types: TICKET_TYPES,
      primaryType: 'Ticket',
      message: {
        channelId: ticket.channelId,
        amount: ticket.amount,
        nonce: ticket.nonce,
      },
      signature: ticket.signature,
    });
    
    return isValid;
  } catch {
    return false;
  }
}

/**
 * Calculate ticket amount based on token usage
 */
export function calculateTicketAmount(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputPer1m: number; outputPer1m: number }
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1m;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1m;
  return inputCost + outputCost;
}
