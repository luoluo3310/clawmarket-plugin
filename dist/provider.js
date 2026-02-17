/**
 * ClawMarket OpenClaw Provider
 *
 * 自动化流程：
 * 1. 首次启动自动生成钱包
 * 2. 显示充值地址
 * 3. 检测到 USDC 后自动激活
 * 4. 自动发现卖家、开通道、签票据
 */
import { createWalletClient, createPublicClient, http, formatUnits } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateKeyPair, encrypt, decrypt } from './crypto/e2ee.js';
// 默认配置
const DEFAULT_CONFIG = {
    registryUrl: 'http://shenjige.xyz:9080',
    relayUrl: 'http://shenjige.xyz:9081',
    relayWs: 'ws://shenjige.xyz:9081',
    rpcUrl: 'https://sepolia.base.org',
    channelContract: '0x1577e78D8a446edF10244A80bEf990751e80E495',
    usdcContract: '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D',
    chainId: 84532,
    minBalance: 1000000n, // 1 USDC minimum to start
    channelDeposit: 10000000n, // 10 USDC per channel
};
// ABIs
const USDC_ABI = [
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];
const CHANNEL_ABI = [
    { name: 'openChannel', type: 'function', inputs: [{ name: 'seller', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'duration', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
    { name: 'channels', type: 'function', inputs: [{ name: 'channelId', type: 'bytes32' }], outputs: [{ name: 'buyer', type: 'address' }, { name: 'seller', type: 'address' }, { name: 'deposit', type: 'uint256' }, { name: 'settledAmount', type: 'uint256' }, { name: 'expiresAt', type: 'uint256' }, { name: 'closingRequestedAt', type: 'uint256' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view' },
    { name: 'sellers', type: 'function', inputs: [{ name: 'seller', type: 'address' }], outputs: [{ name: 'stakedAmount', type: 'uint256' }, { name: 'slashedAmount', type: 'uint256' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view' },
];
export class ClawMarketProvider {
    config;
    walletPath;
    wallet = null;
    publicClient;
    walletClient = null;
    channels = new Map();
    sellers = [];
    isReady = false;
    onStatusChange;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.walletPath = path.join(os.homedir(), '.clawmarket', 'wallet.json');
        this.publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(this.config.rpcUrl)
        });
    }
    /**
     * 初始化 Provider
     */
    async initialize() {
        // 1. 加载或创建钱包
        await this.loadOrCreateWallet();
        // 2. 检查余额
        const balance = await this.getBalance();
        const balanceNum = parseFloat(formatUnits(balance, 6));
        // 3. 判断是否就绪
        this.isReady = balance >= this.config.minBalance;
        if (!this.isReady) {
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              ClawMarket - 需要充值                         ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log(`║  钱包地址: ${this.wallet.address}  ║`);
            console.log(`║  当前余额: ${balanceNum.toFixed(2)} USDC                                      ║`);
            console.log(`║  最低要求: ${formatUnits(this.config.minBalance, 6)} USDC                                       ║`);
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  请充值 USDC (Base Sepolia) 到上述地址                     ║');
            console.log('║  充值后插件将自动激活                                      ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');
        }
        else {
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              ClawMarket - 已就绪                           ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log(`║  钱包地址: ${this.wallet.address}  ║`);
            console.log(`║  当前余额: ${balanceNum.toFixed(2)} USDC                                      ║`);
            console.log('╚════════════════════════════════════════════════════════════╝\n');
            // 初始化钱包客户端
            const account = privateKeyToAccount(this.wallet.privateKey);
            this.walletClient = createWalletClient({
                account,
                chain: baseSepolia,
                transport: http(this.config.rpcUrl)
            });
            // 加载卖家列表
            await this.refreshSellers();
        }
        return {
            address: this.wallet.address,
            balance: balanceNum.toFixed(2),
            ready: this.isReady
        };
    }
    /**
     * 加载或创建钱包
     */
    async loadOrCreateWallet() {
        const dir = path.dirname(this.walletPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(this.walletPath)) {
            const data = fs.readFileSync(this.walletPath, 'utf-8');
            this.wallet = JSON.parse(data);
            console.log('[ClawMarket] 已加载钱包:', this.wallet.address);
        }
        else {
            // 生成新钱包
            const privateKey = generatePrivateKey();
            const account = privateKeyToAccount(privateKey);
            const encKeys = generateKeyPair();
            this.wallet = {
                address: account.address,
                privateKey: privateKey,
                encryptionKeys: {
                    publicKey: Buffer.from(encKeys.publicKey).toString('hex'),
                    secretKey: Buffer.from(encKeys.secretKey).toString('hex')
                },
                createdAt: new Date().toISOString()
            };
            fs.writeFileSync(this.walletPath, JSON.stringify(this.wallet, null, 2), { mode: 0o600 });
            console.log('[ClawMarket] 已创建新钱包:', this.wallet.address);
        }
    }
    /**
     * 获取 USDC 余额
     */
    async getBalance() {
        return await this.publicClient.readContract({
            address: this.config.usdcContract,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [this.wallet.address]
        });
    }
    /**
     * 刷新卖家列表
     */
    async refreshSellers() {
        try {
            const res = await fetch(`${this.config.registryUrl}/v1/sellers?status=active`);
            const data = await res.json();
            this.sellers = data.sellers || [];
            console.log(`[ClawMarket] 发现 ${this.sellers.length} 个在线卖家`);
        }
        catch (err) {
            console.error('[ClawMarket] 获取卖家列表失败:', err);
        }
    }
    /**
     * 选择最优卖家
     */
    selectSeller(model) {
        const candidates = this.sellers.filter(s => s.models.some(m => m.model === model));
        if (candidates.length === 0)
            return null;
        // 按价格排序
        candidates.sort((a, b) => {
            const aModel = a.models.find(m => m.model === model);
            const bModel = b.models.find(m => m.model === model);
            return (aModel.input_per_1m + aModel.output_per_1m) - (bModel.input_per_1m + bModel.output_per_1m);
        });
        return candidates[0] || null;
    }
    /**
     * 确保与卖家有通道
     */
    async ensureChannel(seller) {
        const existing = this.channels.get(seller.id);
        if (existing)
            return existing;
        console.log('[ClawMarket] 开通道到卖家:', seller.id.slice(0, 8) + '...');
        // 获取卖家链上地址 (简化：用公钥前20字节)
        const sellerAddress = ('0x' + seller.public_key.slice(2, 42));
        // Approve USDC
        const approveHash = await this.walletClient.writeContract({
            address: this.config.usdcContract,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [this.config.channelContract, this.config.channelDeposit]
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
        // Open channel
        const duration = BigInt(7 * 24 * 60 * 60); // 7 days
        const openHash = await this.walletClient.writeContract({
            address: this.config.channelContract,
            abi: CHANNEL_ABI,
            functionName: 'openChannel',
            args: [sellerAddress, this.config.channelDeposit, duration]
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: openHash });
        const channelId = receipt.logs[1]?.topics[1];
        const channel = {
            id: channelId,
            seller: seller.id,
            sellerAddress,
            deposit: this.config.channelDeposit,
            spent: 0n,
            nonce: 0n
        };
        this.channels.set(seller.id, channel);
        console.log('[ClawMarket] 通道已开启:', channelId.slice(0, 16) + '...');
        return channel;
    }
    /**
     * 签名票据
     */
    async signTicket(channel, amount) {
        channel.nonce += 1n;
        channel.spent += amount;
        const signature = await this.walletClient.signTypedData({
            domain: {
                name: 'ClawChannel',
                version: '1',
                chainId: this.config.chainId,
                verifyingContract: this.config.channelContract
            },
            types: {
                Ticket: [
                    { name: 'channelId', type: 'bytes32' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' }
                ]
            },
            primaryType: 'Ticket',
            message: {
                channelId: channel.id,
                amount: channel.spent,
                nonce: channel.nonce
            }
        });
        return signature;
    }
    /**
     * 发送聊天请求 (OpenClaw Provider 接口)
     */
    async chat(params) {
        if (!this.isReady) {
            throw new Error('ClawMarket 未就绪，请先充值 USDC');
        }
        // 1. 选择卖家
        const seller = this.selectSeller(params.model);
        if (!seller) {
            throw new Error(`没有找到提供 ${params.model} 的卖家`);
        }
        // 2. 确保通道
        const channel = await this.ensureChannel(seller);
        // 3. 估算费用并签票据
        const estimatedTokens = params.messages.reduce((sum, m) => sum + m.content.length / 4, 0);
        const modelPricing = seller.models.find(m => m.model === params.model);
        const estimatedCost = BigInt(Math.ceil(estimatedTokens * (modelPricing.input_per_1m + modelPricing.output_per_1m) / 1000));
        const ticket = await this.signTicket(channel, estimatedCost);
        // 4. 加密请求
        const sellerPubKey = new Uint8Array(Buffer.from(seller.public_key, 'hex'));
        const mySecretKey = new Uint8Array(Buffer.from(this.wallet.encryptionKeys.secretKey, 'hex'));
        const payload = JSON.stringify({
            model: params.model,
            messages: params.messages,
            ticket: {
                channelId: channel.id,
                amount: channel.spent.toString(),
                nonce: channel.nonce.toString(),
                signature: ticket
            }
        });
        const encrypted = await encrypt(payload, mySecretKey, sellerPubKey);
        // 5. 发送到 Relay
        const res = await fetch(`${this.config.relayUrl}/relay/forward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seller_id: seller.id,
                payload: encrypted,
                buyer_public_key: this.wallet.encryptionKeys.publicKey
            })
        });
        const result = await res.json();
        if (!result.success) {
            throw new Error('请求失败: ' + result.error);
        }
        // 6. 解密响应
        const decrypted = await decrypt(result.payload, mySecretKey, sellerPubKey);
        return decrypted;
    }
    /**
     * 获取状态
     */
    getStatus() {
        return {
            address: this.wallet?.address || '',
            ready: this.isReady,
            sellers: this.sellers.length,
            channels: this.channels.size
        };
    }
    /**
     * 等待余额充足
     */
    async waitForBalance(intervalMs = 10000) {
        console.log('[ClawMarket] 等待充值...');
        while (true) {
            const balance = await this.getBalance();
            if (balance >= this.config.minBalance) {
                console.log('[ClawMarket] 检测到充值，余额:', formatUnits(balance, 6), 'USDC');
                await this.initialize();
                break;
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }
    }
}
// 导出默认实例
export const clawmarket = new ClawMarketProvider();
// 导出便捷函数
export async function initClawMarket(config) {
    const provider = new ClawMarketProvider(config);
    return await provider.initialize();
}
//# sourceMappingURL=provider.js.map