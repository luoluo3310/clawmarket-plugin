/**
 * ClawMarket 默认配置
 *
 * 用户无需配置，开箱即用
 */
export declare const DEFAULT_CONFIG: {
    registryUrl: string;
    relayUrl: string;
    relayWs: string;
    rpcUrl: string;
    chainId: number;
    channelContract: `0x${string}`;
    usdcContract: `0x${string}`;
    minBalance: bigint;
    channelDeposit: bigint;
    strategy: "lowest_price";
};
/**
 * OpenClaw 自动配置
 *
 * 插件安装后自动注入到 OpenClaw 配置
 */
export declare const OPENCLAW_PROVIDER_CONFIG: {
    name: string;
    type: string;
    models: string[];
    default: boolean;
};
//# sourceMappingURL=config.d.ts.map