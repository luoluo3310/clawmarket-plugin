import { createWalletClient, http, parseUnits, } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
/**
 * Default domain for Base Sepolia
 */
export function getDefaultDomain(contractAddress) {
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
};
/**
 * Ticket signer for buyers
 */
export class TicketSigner {
    walletClient;
    account;
    domain;
    constructor(privateKey, contractAddress, rpcUrl, chainId = 84532) {
        this.account = privateKeyToAccount(privateKey);
        const chain = chainId === 84532 ? baseSepolia : {
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
    get address() {
        return this.account.address;
    }
    /**
     * Sign a payment ticket
     */
    async signTicket(ticket) {
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
    async createTicket(channelId, amountUsd, nonce) {
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
export async function verifyTicketSignature(ticket, expectedSigner, domain) {
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
    }
    catch {
        return false;
    }
}
/**
 * Calculate ticket amount based on token usage
 */
export function calculateTicketAmount(inputTokens, outputTokens, pricing) {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1m;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1m;
    return inputCost + outputCost;
}
//# sourceMappingURL=ticket.js.map