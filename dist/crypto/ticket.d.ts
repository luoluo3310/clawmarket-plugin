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
export declare function getDefaultDomain(contractAddress: `0x${string}`): EIP712Domain;
/**
 * EIP-712 types for Ticket
 */
export declare const TICKET_TYPES: {
    readonly Ticket: readonly [{
        readonly name: "channelId";
        readonly type: "bytes32";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
    }];
};
/**
 * Ticket signer for buyers
 */
export declare class TicketSigner {
    private walletClient;
    private account;
    private domain;
    constructor(privateKey: `0x${string}`, contractAddress: `0x${string}`, rpcUrl: string, chainId?: number);
    /**
     * Get the signer's address
     */
    get address(): `0x${string}`;
    /**
     * Sign a payment ticket
     */
    signTicket(ticket: Ticket): Promise<SignedTicket>;
    /**
     * Create and sign a ticket with USD amount
     */
    createTicket(channelId: `0x${string}`, amountUsd: number, nonce: bigint): Promise<SignedTicket>;
}
/**
 * Verify a ticket signature (for sellers)
 */
export declare function verifyTicketSignature(ticket: SignedTicket, expectedSigner: `0x${string}`, domain: EIP712Domain): Promise<boolean>;
/**
 * Calculate ticket amount based on token usage
 */
export declare function calculateTicketAmount(inputTokens: number, outputTokens: number, pricing: {
    inputPer1m: number;
    outputPer1m: number;
}): number;
//# sourceMappingURL=ticket.d.ts.map