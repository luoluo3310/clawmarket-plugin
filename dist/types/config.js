import { z } from 'zod';
/**
 * Model pricing configuration
 */
export const ModelPricingSchema = z.object({
    inputPer1m: z.number().positive().describe('Price per 1M input tokens in USD'),
    outputPer1m: z.number().positive().describe('Price per 1M output tokens in USD'),
});
/**
 * Model configuration for sellers
 */
export const ModelConfigSchema = z.object({
    model: z.string().describe('Model identifier (e.g., claude-opus-4)'),
    pricing: ModelPricingSchema,
    dailyQuotaUsd: z.number().positive().optional().describe('Daily quota limit in USD'),
    upstreamProvider: z.string().optional().describe('Upstream provider name'),
});
/**
 * Seller mode configuration
 */
export const SellerConfigSchema = z.object({
    models: z.array(ModelConfigSchema).min(1).describe('Models to sell'),
    registryUrl: z.string().url().describe('Registry service URL'),
    relayUrl: z.string().url().describe('Relay WebSocket URL'),
    upstreamBaseUrl: z.string().url().describe('Upstream API base URL'),
    upstreamApiKey: z.string().describe('Upstream API key'),
    heartbeatIntervalMs: z.number().positive().default(30000).describe('Heartbeat interval in ms'),
    region: z.string().optional().describe('Geographic region'),
});
/**
 * Selection strategy for buyers
 */
export const SelectionStrategySchema = z.enum([
    'lowest_price',
    'lowest_latency',
    'highest_reputation',
]);
/**
 * Buyer mode configuration
 */
export const BuyerConfigSchema = z.object({
    registryUrl: z.string().url().describe('Registry service URL'),
    relayUrl: z.string().url().describe('Relay WebSocket URL'),
    strategy: SelectionStrategySchema.default('lowest_price').describe('Seller selection strategy'),
    maxPriceMultiplier: z.number().positive().default(1.5).describe('Max price vs official'),
    fallbackProvider: z.string().optional().describe('Fallback provider if no sellers'),
    minReputation: z.number().min(0).max(100).default(50).describe('Minimum seller reputation'),
});
/**
 * Wallet configuration for payments
 */
export const WalletConfigSchema = z.object({
    privateKey: z.string().optional().describe('Private key (hex) - auto-generated if not provided'),
    keyStorePath: z.string().optional().describe('Path to encrypted keystore file'),
    channelContractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('ClawChannel contract address'),
    chainId: z.number().positive().default(84532).describe('Chain ID (default: Base Sepolia)'),
    rpcUrl: z.string().url().describe('RPC endpoint URL'),
    paymasterUrl: z.string().url().optional().describe('Paymaster service URL'),
});
/**
 * Main plugin configuration
 */
export const ClawMarketConfigSchema = z.object({
    enabled: z.boolean().default(true).describe('Enable ClawMarket plugin'),
    role: z.enum(['seller', 'buyer', 'both']).describe('Operating mode'),
    seller: SellerConfigSchema.optional().describe('Seller configuration (required if role is seller/both)'),
    buyer: BuyerConfigSchema.optional().describe('Buyer configuration (required if role is buyer/both)'),
    wallet: WalletConfigSchema.describe('Wallet and payment configuration'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
}).refine((data) => {
    if (data.role === 'seller' || data.role === 'both') {
        return data.seller !== undefined;
    }
    return true;
}, { message: 'Seller config required when role is seller or both' }).refine((data) => {
    if (data.role === 'buyer' || data.role === 'both') {
        return data.buyer !== undefined;
    }
    return true;
}, { message: 'Buyer config required when role is buyer or both' });
//# sourceMappingURL=config.js.map