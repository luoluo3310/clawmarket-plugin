#!/usr/bin/env node
/**
 * ClawMarket Seller CLI
 *
 * 一键启动卖家模式，把闲置 AI 额度卖出去赚钱
 */
export interface SellerConfigData {
    sourceType: string;
    model: string;
    apiBaseUrl: string;
    apiKey: string;
    pricing: {
        inputPer1m: number;
        outputPer1m: number;
    };
    dailyLimitUsd: number;
    region: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * 卖家 CLI 主入口
 */
export declare function sellerMain(subcommand?: string): Promise<void>;
//# sourceMappingURL=seller-cli.d.ts.map