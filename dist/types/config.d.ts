import { z } from 'zod';
/**
 * Model pricing configuration
 */
export declare const ModelPricingSchema: z.ZodObject<{
    inputPer1m: z.ZodNumber;
    outputPer1m: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    inputPer1m: number;
    outputPer1m: number;
}, {
    inputPer1m: number;
    outputPer1m: number;
}>;
/**
 * Model configuration for sellers
 */
export declare const ModelConfigSchema: z.ZodObject<{
    model: z.ZodString;
    pricing: z.ZodObject<{
        inputPer1m: z.ZodNumber;
        outputPer1m: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        inputPer1m: number;
        outputPer1m: number;
    }, {
        inputPer1m: number;
        outputPer1m: number;
    }>;
    dailyQuotaUsd: z.ZodOptional<z.ZodNumber>;
    upstreamProvider: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    model: string;
    pricing: {
        inputPer1m: number;
        outputPer1m: number;
    };
    dailyQuotaUsd?: number | undefined;
    upstreamProvider?: string | undefined;
}, {
    model: string;
    pricing: {
        inputPer1m: number;
        outputPer1m: number;
    };
    dailyQuotaUsd?: number | undefined;
    upstreamProvider?: string | undefined;
}>;
/**
 * Seller mode configuration
 */
export declare const SellerConfigSchema: z.ZodObject<{
    models: z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        pricing: z.ZodObject<{
            inputPer1m: z.ZodNumber;
            outputPer1m: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            inputPer1m: number;
            outputPer1m: number;
        }, {
            inputPer1m: number;
            outputPer1m: number;
        }>;
        dailyQuotaUsd: z.ZodOptional<z.ZodNumber>;
        upstreamProvider: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        pricing: {
            inputPer1m: number;
            outputPer1m: number;
        };
        dailyQuotaUsd?: number | undefined;
        upstreamProvider?: string | undefined;
    }, {
        model: string;
        pricing: {
            inputPer1m: number;
            outputPer1m: number;
        };
        dailyQuotaUsd?: number | undefined;
        upstreamProvider?: string | undefined;
    }>, "many">;
    registryUrl: z.ZodString;
    relayUrl: z.ZodString;
    upstreamBaseUrl: z.ZodString;
    upstreamApiKey: z.ZodString;
    heartbeatIntervalMs: z.ZodDefault<z.ZodNumber>;
    region: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    registryUrl: string;
    relayUrl: string;
    models: {
        model: string;
        pricing: {
            inputPer1m: number;
            outputPer1m: number;
        };
        dailyQuotaUsd?: number | undefined;
        upstreamProvider?: string | undefined;
    }[];
    upstreamBaseUrl: string;
    upstreamApiKey: string;
    heartbeatIntervalMs: number;
    region?: string | undefined;
}, {
    registryUrl: string;
    relayUrl: string;
    models: {
        model: string;
        pricing: {
            inputPer1m: number;
            outputPer1m: number;
        };
        dailyQuotaUsd?: number | undefined;
        upstreamProvider?: string | undefined;
    }[];
    upstreamBaseUrl: string;
    upstreamApiKey: string;
    heartbeatIntervalMs?: number | undefined;
    region?: string | undefined;
}>;
/**
 * Selection strategy for buyers
 */
export declare const SelectionStrategySchema: z.ZodEnum<["lowest_price", "lowest_latency", "highest_reputation"]>;
/**
 * Buyer mode configuration
 */
export declare const BuyerConfigSchema: z.ZodObject<{
    registryUrl: z.ZodString;
    relayUrl: z.ZodString;
    strategy: z.ZodDefault<z.ZodEnum<["lowest_price", "lowest_latency", "highest_reputation"]>>;
    maxPriceMultiplier: z.ZodDefault<z.ZodNumber>;
    fallbackProvider: z.ZodOptional<z.ZodString>;
    minReputation: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    registryUrl: string;
    relayUrl: string;
    strategy: "lowest_price" | "lowest_latency" | "highest_reputation";
    maxPriceMultiplier: number;
    minReputation: number;
    fallbackProvider?: string | undefined;
}, {
    registryUrl: string;
    relayUrl: string;
    strategy?: "lowest_price" | "lowest_latency" | "highest_reputation" | undefined;
    maxPriceMultiplier?: number | undefined;
    fallbackProvider?: string | undefined;
    minReputation?: number | undefined;
}>;
/**
 * Wallet configuration for payments
 */
export declare const WalletConfigSchema: z.ZodObject<{
    privateKey: z.ZodOptional<z.ZodString>;
    keyStorePath: z.ZodOptional<z.ZodString>;
    channelContractAddress: z.ZodString;
    chainId: z.ZodDefault<z.ZodNumber>;
    rpcUrl: z.ZodString;
    paymasterUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rpcUrl: string;
    chainId: number;
    channelContractAddress: string;
    privateKey?: string | undefined;
    keyStorePath?: string | undefined;
    paymasterUrl?: string | undefined;
}, {
    rpcUrl: string;
    channelContractAddress: string;
    chainId?: number | undefined;
    privateKey?: string | undefined;
    keyStorePath?: string | undefined;
    paymasterUrl?: string | undefined;
}>;
/**
 * Main plugin configuration
 */
export declare const ClawMarketConfigSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    role: z.ZodEnum<["seller", "buyer", "both"]>;
    seller: z.ZodOptional<z.ZodObject<{
        models: z.ZodArray<z.ZodObject<{
            model: z.ZodString;
            pricing: z.ZodObject<{
                inputPer1m: z.ZodNumber;
                outputPer1m: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                inputPer1m: number;
                outputPer1m: number;
            }, {
                inputPer1m: number;
                outputPer1m: number;
            }>;
            dailyQuotaUsd: z.ZodOptional<z.ZodNumber>;
            upstreamProvider: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }, {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }>, "many">;
        registryUrl: z.ZodString;
        relayUrl: z.ZodString;
        upstreamBaseUrl: z.ZodString;
        upstreamApiKey: z.ZodString;
        heartbeatIntervalMs: z.ZodDefault<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs: number;
        region?: string | undefined;
    }, {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs?: number | undefined;
        region?: string | undefined;
    }>>;
    buyer: z.ZodOptional<z.ZodObject<{
        registryUrl: z.ZodString;
        relayUrl: z.ZodString;
        strategy: z.ZodDefault<z.ZodEnum<["lowest_price", "lowest_latency", "highest_reputation"]>>;
        maxPriceMultiplier: z.ZodDefault<z.ZodNumber>;
        fallbackProvider: z.ZodOptional<z.ZodString>;
        minReputation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        registryUrl: string;
        relayUrl: string;
        strategy: "lowest_price" | "lowest_latency" | "highest_reputation";
        maxPriceMultiplier: number;
        minReputation: number;
        fallbackProvider?: string | undefined;
    }, {
        registryUrl: string;
        relayUrl: string;
        strategy?: "lowest_price" | "lowest_latency" | "highest_reputation" | undefined;
        maxPriceMultiplier?: number | undefined;
        fallbackProvider?: string | undefined;
        minReputation?: number | undefined;
    }>>;
    wallet: z.ZodObject<{
        privateKey: z.ZodOptional<z.ZodString>;
        keyStorePath: z.ZodOptional<z.ZodString>;
        channelContractAddress: z.ZodString;
        chainId: z.ZodDefault<z.ZodNumber>;
        rpcUrl: z.ZodString;
        paymasterUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rpcUrl: string;
        chainId: number;
        channelContractAddress: string;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    }, {
        rpcUrl: string;
        channelContractAddress: string;
        chainId?: number | undefined;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    }>;
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    role: "seller" | "buyer" | "both";
    wallet: {
        rpcUrl: string;
        chainId: number;
        channelContractAddress: string;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    };
    logLevel: "error" | "debug" | "info" | "warn";
    seller?: {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs: number;
        region?: string | undefined;
    } | undefined;
    buyer?: {
        registryUrl: string;
        relayUrl: string;
        strategy: "lowest_price" | "lowest_latency" | "highest_reputation";
        maxPriceMultiplier: number;
        minReputation: number;
        fallbackProvider?: string | undefined;
    } | undefined;
}, {
    role: "seller" | "buyer" | "both";
    wallet: {
        rpcUrl: string;
        channelContractAddress: string;
        chainId?: number | undefined;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    };
    seller?: {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs?: number | undefined;
        region?: string | undefined;
    } | undefined;
    buyer?: {
        registryUrl: string;
        relayUrl: string;
        strategy?: "lowest_price" | "lowest_latency" | "highest_reputation" | undefined;
        maxPriceMultiplier?: number | undefined;
        fallbackProvider?: string | undefined;
        minReputation?: number | undefined;
    } | undefined;
    enabled?: boolean | undefined;
    logLevel?: "error" | "debug" | "info" | "warn" | undefined;
}>, {
    enabled: boolean;
    role: "seller" | "buyer" | "both";
    wallet: {
        rpcUrl: string;
        chainId: number;
        channelContractAddress: string;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    };
    logLevel: "error" | "debug" | "info" | "warn";
    seller?: {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs: number;
        region?: string | undefined;
    } | undefined;
    buyer?: {
        registryUrl: string;
        relayUrl: string;
        strategy: "lowest_price" | "lowest_latency" | "highest_reputation";
        maxPriceMultiplier: number;
        minReputation: number;
        fallbackProvider?: string | undefined;
    } | undefined;
}, {
    role: "seller" | "buyer" | "both";
    wallet: {
        rpcUrl: string;
        channelContractAddress: string;
        chainId?: number | undefined;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    };
    seller?: {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs?: number | undefined;
        region?: string | undefined;
    } | undefined;
    buyer?: {
        registryUrl: string;
        relayUrl: string;
        strategy?: "lowest_price" | "lowest_latency" | "highest_reputation" | undefined;
        maxPriceMultiplier?: number | undefined;
        fallbackProvider?: string | undefined;
        minReputation?: number | undefined;
    } | undefined;
    enabled?: boolean | undefined;
    logLevel?: "error" | "debug" | "info" | "warn" | undefined;
}>, {
    enabled: boolean;
    role: "seller" | "buyer" | "both";
    wallet: {
        rpcUrl: string;
        chainId: number;
        channelContractAddress: string;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    };
    logLevel: "error" | "debug" | "info" | "warn";
    seller?: {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs: number;
        region?: string | undefined;
    } | undefined;
    buyer?: {
        registryUrl: string;
        relayUrl: string;
        strategy: "lowest_price" | "lowest_latency" | "highest_reputation";
        maxPriceMultiplier: number;
        minReputation: number;
        fallbackProvider?: string | undefined;
    } | undefined;
}, {
    role: "seller" | "buyer" | "both";
    wallet: {
        rpcUrl: string;
        channelContractAddress: string;
        chainId?: number | undefined;
        privateKey?: string | undefined;
        keyStorePath?: string | undefined;
        paymasterUrl?: string | undefined;
    };
    seller?: {
        registryUrl: string;
        relayUrl: string;
        models: {
            model: string;
            pricing: {
                inputPer1m: number;
                outputPer1m: number;
            };
            dailyQuotaUsd?: number | undefined;
            upstreamProvider?: string | undefined;
        }[];
        upstreamBaseUrl: string;
        upstreamApiKey: string;
        heartbeatIntervalMs?: number | undefined;
        region?: string | undefined;
    } | undefined;
    buyer?: {
        registryUrl: string;
        relayUrl: string;
        strategy?: "lowest_price" | "lowest_latency" | "highest_reputation" | undefined;
        maxPriceMultiplier?: number | undefined;
        fallbackProvider?: string | undefined;
        minReputation?: number | undefined;
    } | undefined;
    enabled?: boolean | undefined;
    logLevel?: "error" | "debug" | "info" | "warn" | undefined;
}>;
export type ModelPricing = z.infer<typeof ModelPricingSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type SellerConfig = z.infer<typeof SellerConfigSchema>;
export type SelectionStrategy = z.infer<typeof SelectionStrategySchema>;
export type BuyerConfig = z.infer<typeof BuyerConfigSchema>;
export type WalletConfig = z.infer<typeof WalletConfigSchema>;
export type ClawMarketConfig = z.infer<typeof ClawMarketConfigSchema>;
//# sourceMappingURL=config.d.ts.map