/**
 * Discovery client for buyers to find sellers
 */
export class DiscoveryClient {
    config;
    sellersCache = [];
    lastFetch = 0;
    cacheTtlMs = 30000; // 30 seconds
    constructor(config) {
        this.config = config;
    }
    /**
     * Fetch available sellers from Registry
     */
    async fetchSellers(model, forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.sellersCache.length > 0 && now - this.lastFetch < this.cacheTtlMs) {
            return this.filterSellers(this.sellersCache, model);
        }
        const params = new URLSearchParams({
            status: 'active',
            minReputation: this.config.minReputation.toString(),
        });
        if (model) {
            params.set('model', model);
        }
        const response = await fetch(`${this.config.registryUrl}/v1/sellers?${params}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to fetch sellers: ${response.status}`);
        }
        const data = await response.json();
        this.sellersCache = data.sellers;
        this.lastFetch = now;
        return this.filterSellers(data.sellers, model);
    }
    /**
     * Filter sellers by model
     */
    filterSellers(sellers, model) {
        if (!model) {
            return sellers;
        }
        return sellers.filter((s) => s.models.some((m) => m.model === model && (m.availableQuotaUsd ?? Infinity) > 0));
    }
    /**
     * Select best seller based on strategy
     */
    async selectSeller(model) {
        const sellers = await this.fetchSellers(model);
        if (sellers.length === 0) {
            return null;
        }
        return this.applyStrategy(sellers, model, this.config.strategy) ?? null;
    }
    /**
     * Apply selection strategy
     */
    applyStrategy(sellers, model, strategy) {
        if (sellers.length === 0)
            return undefined;
        switch (strategy) {
            case 'lowest_price':
                return this.selectLowestPrice(sellers, model);
            case 'lowest_latency':
                return this.selectLowestLatency(sellers);
            case 'highest_reputation':
                return this.selectHighestReputation(sellers);
            default:
                return sellers[0];
        }
    }
    /**
     * Select seller with lowest price for the model
     */
    selectLowestPrice(sellers, model) {
        return sellers.reduce((best, current) => {
            const bestModel = best.models.find((m) => m.model === model);
            const currentModel = current.models.find((m) => m.model === model);
            if (!bestModel)
                return current;
            if (!currentModel)
                return best;
            const bestPrice = bestModel.pricing.inputPer1m + bestModel.pricing.outputPer1m;
            const currentPrice = currentModel.pricing.inputPer1m + currentModel.pricing.outputPer1m;
            return currentPrice < bestPrice ? current : best;
        });
    }
    /**
     * Select seller with lowest latency
     */
    selectLowestLatency(sellers) {
        return sellers.reduce((best, current) => {
            const bestLatency = best.reputation.avgLatencyMs;
            const currentLatency = current.reputation.avgLatencyMs;
            return currentLatency < bestLatency ? current : best;
        });
    }
    /**
     * Select seller with highest reputation
     */
    selectHighestReputation(sellers) {
        return sellers.reduce((best, current) => {
            return current.reputation.score > best.reputation.score ? current : best;
        });
    }
    /**
     * Get pricing for a model from a seller
     */
    getModelPricing(seller, model) {
        const modelInfo = seller.models.find((m) => m.model === model);
        return modelInfo?.pricing ?? null;
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.sellersCache = [];
        this.lastFetch = 0;
    }
}
//# sourceMappingURL=discovery.js.map