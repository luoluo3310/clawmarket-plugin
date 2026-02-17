/**
 * ClawMarket OpenClaw Provider
 *
 * 自动化流程：
 * 1. 首次启动自动生成钱包
 * 2. 显示充值地址
 * 3. 检测到 USDC 后自动激活
 * 4. 自动发现卖家、开通道、签票据
 */
declare const DEFAULT_CONFIG: {
    registryUrl: string;
    relayUrl: string;
    relayWs: string;
    rpcUrl: string;
    channelContract: `0x${string}`;
    usdcContract: `0x${string}`;
    chainId: number;
    minBalance: bigint;
    channelDeposit: bigint;
};
interface SellerInfo {
    id: string;
    public_key: string;
    endpoint: string;
    models: Array<{
        model: string;
        input_per_1m: number;
        output_per_1m: number;
    }>;
    reputation: {
        score: number;
    };
}
interface Channel {
    id: `0x${string}`;
    seller: string;
    sellerAddress: `0x${string}`;
    deposit: bigint;
    spent: bigint;
    nonce: bigint;
}
export declare class ClawMarketProvider {
    private config;
    private walletPath;
    private wallet;
    private publicClient;
    private walletClient;
    private channels;
    private sellers;
    private isReady;
    private onStatusChange?;
    constructor(config?: Partial<typeof DEFAULT_CONFIG>);
    /**
     * 初始化 Provider
     */
    initialize(): Promise<{
        address: string;
        balance: string;
        ready: boolean;
    }>;
    /**
     * 加载或创建钱包
     */
    private loadOrCreateWallet;
    /**
     * 获取 USDC 余额
     */
    getBalance(): Promise<bigint>;
    /**
     * 刷新卖家列表
     */
    refreshSellers(): Promise<void>;
    /**
     * 选择最优卖家
     */
    selectSeller(model: string): SellerInfo | null;
    /**
     * 确保与卖家有通道
     */
    ensureChannel(seller: SellerInfo): Promise<Channel>;
    /**
     * 签名票据
     */
    signTicket(channel: Channel, amount: bigint): Promise<string>;
    /**
     * 发送聊天请求 (OpenClaw Provider 接口)
     */
    chat(params: {
        model: string;
        messages: Array<{
            role: string;
            content: string;
        }>;
    }): Promise<string>;
    /**
     * 获取状态
     */
    getStatus(): {
        address: string;
        ready: boolean;
        sellers: number;
        channels: number;
    };
    /**
     * 等待余额充足
     */
    waitForBalance(intervalMs?: number): Promise<void>;
}
export declare const clawmarket: ClawMarketProvider;
export declare function initClawMarket(config?: Partial<typeof DEFAULT_CONFIG>): Promise<{
    address: string;
    balance: string;
    ready: boolean;
}>;
export {};
//# sourceMappingURL=provider.d.ts.map