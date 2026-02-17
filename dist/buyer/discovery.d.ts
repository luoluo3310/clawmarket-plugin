import type { BuyerConfig } from '../types/config.js';
import type { SellerInfo } from '../types/protocol.js';
/**
 * Discovery client for buyers to find sellers
 */
export declare class DiscoveryClient {
    private config;
    private sellersCache;
    private lastFetch;
    private cacheTtlMs;
    constructor(config: BuyerConfig);
    /**
     * Fetch available sellers from Registry
     */
    fetchSellers(model?: string, forceRefresh?: boolean): Promise<SellerInfo[]>;
    /**
     * Filter sellers by model
     */
    private filterSellers;
    /**
     * Select best seller based on strategy
     */
    selectSeller(model: string): Promise<SellerInfo | null>;
    /**
     * Apply selection strategy
     */
    private applyStrategy;
    /**
     * Select seller with lowest price for the model
     */
    private selectLowestPrice;
    /**
     * Select seller with lowest latency
     */
    private selectLowestLatency;
    /**
     * Select seller with highest reputation
     */
    private selectHighestReputation;
    /**
     * Get pricing for a model from a seller
     */
    getModelPricing(seller: SellerInfo, model: string): {
        inputPer1m: number;
        outputPer1m: number;
    } | null;
    /**
     * Clear cache
     */
    clearCache(): void;
}
//# sourceMappingURL=discovery.d.ts.map