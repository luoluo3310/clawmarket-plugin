import type { BuyerConfig, SelectionStrategy } from '../types/config.js';
import type { SellerInfo, SellersListResponse } from '../types/protocol.js';

/**
 * Discovery client for buyers to find sellers
 */
export class DiscoveryClient {
  private config: BuyerConfig;
  private sellersCache: SellerInfo[] = [];
  private lastFetch = 0;
  private cacheTtlMs = 30000; // 30 seconds

  constructor(config: BuyerConfig) {
    this.config = config;
  }

  /**
   * Fetch available sellers from Registry
   */
  async fetchSellers(model?: string, forceRefresh = false): Promise<SellerInfo[]> {
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

    const response = await fetch(
      `${this.config.registryUrl}/v1/sellers?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sellers: ${response.status}`);
    }

    const data = await response.json() as SellersListResponse;
    this.sellersCache = data.sellers;
    this.lastFetch = now;

    return this.filterSellers(data.sellers, model);
  }

  /**
   * Filter sellers by model
   */
  private filterSellers(sellers: SellerInfo[], model?: string): SellerInfo[] {
    if (!model) {
      return sellers;
    }

    return sellers.filter((s) =>
      s.models.some((m) => m.model === model && (m.availableQuotaUsd ?? Infinity) > 0)
    );
  }

  /**
   * Select best seller based on strategy
   */
  async selectSeller(model: string): Promise<SellerInfo | null> {
    const sellers = await this.fetchSellers(model);
    
    if (sellers.length === 0) {
      return null;
    }

    return this.applyStrategy(sellers, model, this.config.strategy) ?? null;
  }

  /**
   * Apply selection strategy
   */
  private applyStrategy(
    sellers: SellerInfo[],
    model: string,
    strategy: SelectionStrategy
  ): SellerInfo | undefined {
    if (sellers.length === 0) return undefined;
    
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
  private selectLowestPrice(sellers: SellerInfo[], model: string): SellerInfo {
    return sellers.reduce((best, current) => {
      const bestModel = best.models.find((m) => m.model === model);
      const currentModel = current.models.find((m) => m.model === model);

      if (!bestModel) return current;
      if (!currentModel) return best;

      const bestPrice = bestModel.pricing.inputPer1m + bestModel.pricing.outputPer1m;
      const currentPrice = currentModel.pricing.inputPer1m + currentModel.pricing.outputPer1m;

      return currentPrice < bestPrice ? current : best;
    });
  }

  /**
   * Select seller with lowest latency
   */
  private selectLowestLatency(sellers: SellerInfo[]): SellerInfo {
    return sellers.reduce((best, current) => {
      const bestLatency = best.reputation.avgLatencyMs;
      const currentLatency = current.reputation.avgLatencyMs;
      return currentLatency < bestLatency ? current : best;
    });
  }

  /**
   * Select seller with highest reputation
   */
  private selectHighestReputation(sellers: SellerInfo[]): SellerInfo {
    return sellers.reduce((best, current) => {
      return current.reputation.score > best.reputation.score ? current : best;
    });
  }

  /**
   * Get pricing for a model from a seller
   */
  getModelPricing(seller: SellerInfo, model: string): { inputPer1m: number; outputPer1m: number } | null {
    const modelInfo = seller.models.find((m) => m.model === model);
    return modelInfo?.pricing ?? null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.sellersCache = [];
    this.lastFetch = 0;
  }
}
