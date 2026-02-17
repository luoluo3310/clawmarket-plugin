/**
 * Seller information from Registry
 */
export interface SellerInfo {
    id: string;
    publicKey: string;
    endpoint: string;
    models: SellerModel[];
    stakeUsd: number;
    reputation: ReputationInfo;
    region: string;
    status: 'active' | 'offline' | 'suspended';
    lastHeartbeat: string;
}
export interface SellerModel {
    model: string;
    pricing: {
        inputPer1m: number;
        outputPer1m: number;
    };
    dailyQuotaUsd?: number;
    availableQuotaUsd?: number;
}
export interface ReputationInfo {
    score: number;
    totalTransactions: number;
    successRate: number;
    avgLatencyMs: number;
}
/**
 * Heartbeat payload
 */
export interface HeartbeatPayload {
    sellerId: string;
    timestamp: number;
    availableQuota: Record<string, number>;
    latencyMs?: number;
}
/**
 * Registry API responses
 */
export interface RegisterResponse {
    sellerId: string;
    token: string;
    expiresAt: string;
}
export interface SellersListResponse {
    sellers: SellerInfo[];
    total: number;
    page: number;
    pageSize: number;
}
/**
 * Relay protocol messages
 */
export interface RelayMessage {
    type: 'request' | 'response' | 'error' | 'ping' | 'pong';
    requestId: string;
    payload?: string;
    error?: string;
    timestamp: number;
}
export interface RelayRequest extends RelayMessage {
    type: 'request';
    buyerPublicKey: string;
    model: string;
    ticketSignature: string;
    ticketAmount: string;
    ticketNonce: number;
    channelId: string;
}
export interface RelayResponse extends RelayMessage {
    type: 'response';
}
/**
 * API request/response types
 */
export interface ChatCompletionRequest {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}
export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
/**
 * Payment ticket (EIP-712)
 */
export interface Ticket {
    channelId: `0x${string}`;
    amount: bigint;
    nonce: bigint;
}
export interface SignedTicket extends Ticket {
    signature: `0x${string}`;
}
/**
 * Channel state
 */
export interface ChannelState {
    channelId: `0x${string}`;
    buyer: `0x${string}`;
    seller: `0x${string}`;
    deposit: bigint;
    settledAmount: bigint;
    expiresAt: number;
    isActive: boolean;
    currentNonce: bigint;
}
//# sourceMappingURL=protocol.d.ts.map