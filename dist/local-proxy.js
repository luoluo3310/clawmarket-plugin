#!/usr/bin/env node
/**
 * ClawMarket 本地代理 v2
 *
 * 完整支付通道流程：
 * 1. 管理本地钱包（私钥不出本地）
 * 2. 从 Gateway 获取卖家地址
 * 3. 自动开通道（首次使用时）
 * 4. 每次请求签 ticket
 * 5. 转发到 ClawMarket Gateway
 */
import http from 'http';
import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWalletClient, createPublicClient, http as viemHttp, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
// ============ 配置 ============
const LOCAL_PORT = 19082;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://shenjige.xyz:9082';
const RPC_URL = 'https://sepolia.base.org';
const USDC_CONTRACT = '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D';
const CHANNEL_CONTRACT = '0x1577e78D8a446edF10244A80bEf990751e80E495';
const MIN_BALANCE = 1000000n; // 1 USDC
const CHANNEL_DEPOSIT = 10000000n; // 10 USDC
const CHANNEL_DURATION = BigInt(7 * 24 * 60 * 60); // 7 days
const COST_PER_REQUEST = 100000n; // 0.1 USDC 估算
// ============ ABI ============
const USDC_ABI = [
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
    { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];
const CHANNEL_ABI = [
    { name: 'openChannel', type: 'function', inputs: [{ name: 'seller', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'duration', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
    { name: 'channels', type: 'function', inputs: [{ name: 'channelId', type: 'bytes32' }], outputs: [{ name: 'buyer', type: 'address' }, { name: 'seller', type: 'address' }, { name: 'deposit', type: 'uint256' }, { name: 'settledAmount', type: 'uint256' }, { name: 'expiresAt', type: 'uint256' }, { name: 'closingRequestedAt', type: 'uint256' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view' },
    { name: 'sellers', type: 'function', inputs: [{ name: 'seller', type: 'address' }], outputs: [{ name: 'stakedAmount', type: 'uint256' }, { name: 'slashedAmount', type: 'uint256' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view' },
];
// ============ 路径 ============
const DATA_DIR = path.join(os.homedir(), '.clawmarket');
const WALLET_PATH = path.join(DATA_DIR, 'wallet.json');
const CHANNELS_PATH = path.join(DATA_DIR, 'channels.json');
// ============ 全局状态 ============
let wallet = null;
let walletClient = null;
let publicClient = null;
let channels = new Map();
let defaultSeller = '0x3137cE5612af147f1BA17eBba7e8B46594ed3e26'; // 默认卖家
// ============ 钱包管理 ============
function loadOrCreateWallet() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(WALLET_PATH)) {
        const data = fs.readFileSync(WALLET_PATH, 'utf-8');
        return JSON.parse(data);
    }
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const newWallet = {
        address: account.address,
        privateKey: privateKey,
        createdAt: new Date().toISOString()
    };
    fs.writeFileSync(WALLET_PATH, JSON.stringify(newWallet, null, 2), { mode: 0o600 });
    console.log('[钱包] 已创建新钱包:', newWallet.address);
    return newWallet;
}
function loadChannels() {
    if (fs.existsSync(CHANNELS_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(CHANNELS_PATH, 'utf-8'));
            for (const [key, value] of Object.entries(data)) {
                const ch = value;
                channels.set(key, {
                    ...ch,
                    deposit: BigInt(ch.deposit),
                    spent: BigInt(ch.spent),
                    nonce: BigInt(ch.nonce),
                });
            }
            console.log('[通道] 已加载', channels.size, '个通道');
        }
        catch (e) {
            console.error('[通道] 加载失败:', e);
        }
    }
}
function saveChannels() {
    const data = {};
    for (const [key, value] of channels.entries()) {
        data[key] = {
            ...value,
            deposit: value.deposit.toString(),
            spent: value.spent.toString(),
            nonce: value.nonce.toString(),
        };
    }
    fs.writeFileSync(CHANNELS_PATH, JSON.stringify(data, null, 2));
}
// ============ Gateway 交互 ============
async function fetchSellerAddress() {
    return new Promise((resolve, reject) => {
        const url = new URL(GATEWAY_URL);
        http.get(`${GATEWAY_URL}/v1/seller`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.seller);
                }
                catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}
// ============ 链上操作 ============
async function getBalance() {
    return await publicClient.readContract({
        address: USDC_CONTRACT,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [wallet.address]
    });
}
async function getETHBalance() {
    return await publicClient.getBalance({
        address: wallet.address
    });
}
async function checkSellerActive(sellerAddress) {
    try {
        const result = await publicClient.readContract({
            address: CHANNEL_CONTRACT,
            abi: CHANNEL_ABI,
            functionName: 'sellers',
            args: [sellerAddress]
        });
        return result[2]; // isActive
    }
    catch (e) {
        console.error('[链上] 查询卖家状态失败:', e);
        return false;
    }
}
async function ensureApproval() {
    const allowance = await publicClient.readContract({
        address: USDC_CONTRACT,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [wallet.address, CHANNEL_CONTRACT]
    });
    if (allowance < CHANNEL_DEPOSIT) {
        console.log('[链上] Approving USDC...');
        const hash = await walletClient.writeContract({
            address: USDC_CONTRACT,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [CHANNEL_CONTRACT, CHANNEL_DEPOSIT * 100n]
        });
        console.log('[链上] Approve tx:', hash);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('[链上] Approved!');
    }
}
async function openChannel(sellerAddress) {
    console.log('[链上] 开通道到卖家:', sellerAddress);
    // 检查 ETH 余额（gas）
    const ethBalance = await getETHBalance();
    if (ethBalance < parseUnits('0.001', 18)) {
        throw new Error(`ETH 不足支付 gas。当前: ${formatUnits(ethBalance, 18)} ETH。请充值少量 ETH 到: ${wallet.address}`);
    }
    // 检查 USDC 余额
    const usdcBalance = await getBalance();
    if (usdcBalance < CHANNEL_DEPOSIT) {
        throw new Error(`USDC 不足开通道。需要: ${formatUnits(CHANNEL_DEPOSIT, 6)} USDC，当前: ${formatUnits(usdcBalance, 6)} USDC`);
    }
    // 检查卖家是否激活
    const sellerActive = await checkSellerActive(sellerAddress);
    if (!sellerActive) {
        console.log('[警告] 卖家未在合约注册，跳过开通道（使用余额验证模式）');
        return null;
    }
    await ensureApproval();
    console.log('[链上] 发送 openChannel 交易...');
    const hash = await walletClient.writeContract({
        address: CHANNEL_CONTRACT,
        abi: CHANNEL_ABI,
        functionName: 'openChannel',
        args: [sellerAddress, CHANNEL_DEPOSIT, CHANNEL_DURATION]
    });
    console.log('[链上] Tx hash:', hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('[链上] 交易确认! Block:', receipt.blockNumber);
    // 从事件中获取 channelId
    // ChannelOpened 事件来自 CHANNEL_CONTRACT，topic[1] 是 channelId
    let channelId = `0x${'0'.repeat(64)}`;
    for (const log of receipt.logs) {
        // 找 CHANNEL_CONTRACT 发出的事件（不是 USDC Transfer）
        if (log.address.toLowerCase() === CHANNEL_CONTRACT.toLowerCase() && log.topics.length > 1) {
            channelId = log.topics[1];
            console.log('[链上] 找到 ChannelOpened 事件, channelId:', channelId);
            break;
        }
    }
    const expiresAt = Math.floor(Date.now() / 1000) + Number(CHANNEL_DURATION);
    const channel = {
        channelId,
        seller: sellerAddress,
        deposit: CHANNEL_DEPOSIT,
        spent: 0n,
        nonce: 0n,
        expiresAt
    };
    channels.set(sellerAddress.toLowerCase(), channel);
    saveChannels();
    console.log('[链上] 通道已开启!');
    console.log('  Channel ID:', channelId.slice(0, 18) + '...');
    console.log('  存款:', formatUnits(CHANNEL_DEPOSIT, 6), 'USDC');
    console.log('  有效期:', new Date(expiresAt * 1000).toLocaleString());
    return channel;
}
// ============ Ticket 签名 ============
async function signTicket(channel, amount) {
    channel.nonce += 1n;
    channel.spent += amount;
    const signature = await walletClient.signTypedData({
        domain: {
            name: 'ClawChannel',
            version: '1',
            chainId: 84532,
            verifyingContract: CHANNEL_CONTRACT
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
            channelId: channel.channelId,
            amount: channel.spent,
            nonce: channel.nonce
        }
    });
    saveChannels();
    return signature;
}
// ============ 代理转发 ============
function proxyRequest(req, res, body, ticket) {
    const url = new URL(GATEWAY_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': wallet.address,
        'anthropic-version': '2023-06-01'
    };
    if (ticket) {
        headers['x-clawmarket-channel'] = ticket.channelId;
        headers['x-clawmarket-amount'] = ticket.amount;
        headers['x-clawmarket-nonce'] = ticket.nonce;
        headers['x-clawmarket-signature'] = ticket.signature;
    }
    const proxyReq = httpModule.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/v1/messages',
        method: 'POST',
        headers
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
        console.error('[代理] 错误:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { message: err.message } }));
    });
    proxyReq.write(body);
    proxyReq.end();
}
// ============ HTTP 服务器 ============
async function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    const url = req.url || '/';
    // GET /v1/models
    if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            object: 'list',
            data: [{ id: 'claude-opus-4-5', object: 'model', created: Date.now(), owned_by: 'clawmarket' }]
        }));
        return;
    }
    // POST /v1/messages
    if (req.method === 'POST' && (url === '/v1/messages' || url === '/messages')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const request = JSON.parse(body);
                console.log(`[请求] Model: ${request.model}, Stream: ${request.stream || false}`);
                // 检查余额
                const balance = await getBalance();
                if (balance < MIN_BALANCE) {
                    res.writeHead(402, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'error',
                        error: {
                            type: 'payment_required',
                            message: `余额不足: ${formatUnits(balance, 6)} USDC。请充值到: ${wallet.address}`
                        }
                    }));
                    return;
                }
                // 获取卖家地址
                if (!defaultSeller) {
                    try {
                        defaultSeller = await fetchSellerAddress();
                        console.log('[Gateway] 卖家地址:', defaultSeller);
                    }
                    catch (e) {
                        console.error('[Gateway] 获取卖家地址失败，使用默认');
                        defaultSeller = '0x3137cE5612af147f1BA17eBba7e8B46594ed3e26';
                    }
                }
                const sellerAddress = defaultSeller.toLowerCase();
                // 获取或创建通道
                let channel = channels.get(sellerAddress);
                // 检查通道是否过期
                if (channel && channel.expiresAt < Date.now() / 1000) {
                    console.log('[通道] 已过期，需要重新开通道');
                    channels.delete(sellerAddress);
                    channel = undefined;
                }
                // 检查通道余额是否足够
                if (channel && channel.spent + COST_PER_REQUEST > channel.deposit) {
                    console.log('[通道] 余额不足，需要重新开通道');
                    channels.delete(sellerAddress);
                    channel = undefined;
                }
                // 尝试开通道
                if (!channel) {
                    try {
                        channel = await openChannel(sellerAddress);
                    }
                    catch (e) {
                        console.log('[通道] 开通道失败:', e.message);
                        console.log('[通道] 回退到余额验证模式');
                        // 不开通道，直接转发（Gateway 会用余额验证）
                    }
                }
                // 签 ticket
                let ticket = undefined;
                if (channel) {
                    const signature = await signTicket(channel, COST_PER_REQUEST);
                    ticket = {
                        channelId: channel.channelId,
                        amount: channel.spent.toString(),
                        nonce: channel.nonce.toString(),
                        signature
                    };
                    console.log(`[Ticket] #${channel.nonce} 累计: ${formatUnits(channel.spent, 6)} USDC`);
                }
                // 转发请求
                proxyRequest(req, res, body, ticket);
            }
            catch (err) {
                console.error('[错误]', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ type: 'error', error: { message: err.message } }));
            }
        });
        return;
    }
    // GET /status
    if (url === '/status') {
        try {
            const balance = await getBalance();
            const ethBalance = await getETHBalance();
            const channelList = Array.from(channels.entries()).map(([seller, ch]) => ({
                seller,
                channelId: ch.channelId.slice(0, 18) + '...',
                deposit: formatUnits(ch.deposit, 6) + ' USDC',
                spent: formatUnits(ch.spent, 6) + ' USDC',
                remaining: formatUnits(ch.deposit - ch.spent, 6) + ' USDC',
                nonce: ch.nonce.toString(),
                expiresAt: new Date(ch.expiresAt * 1000).toISOString(),
                expired: ch.expiresAt < Date.now() / 1000
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                wallet: wallet.address,
                balance: {
                    usdc: formatUnits(balance, 6) + ' USDC',
                    eth: formatUnits(ethBalance, 18) + ' ETH'
                },
                channels: channelList,
                gateway: GATEWAY_URL,
                ready: balance >= MIN_BALANCE
            }, null, 2));
        }
        catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }
    // GET /open-channel - 手动开通道
    if (url === '/open-channel') {
        try {
            if (!defaultSeller) {
                try {
                    defaultSeller = await fetchSellerAddress();
                }
                catch (e) {
                    console.error('[Gateway] 获取卖家地址失败:', e);
                    defaultSeller = '0x3137cE5612af147f1BA17eBba7e8B46594ed3e26';
                }
            }
            if (!defaultSeller || !defaultSeller.match(/^0x[a-fA-F0-9]{40}$/)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无法获取有效的卖家地址' }));
                return;
            }
            const channel = await openChannel(defaultSeller);
            if (!channel) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '卖家未在合约注册，使用余额验证模式',
                    seller: defaultSeller
                }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                channelId: channel.channelId,
                seller: channel.seller,
                deposit: formatUnits(channel.deposit, 6) + ' USDC',
                expiresAt: new Date(channel.expiresAt * 1000).toISOString()
            }));
        }
        catch (e) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        }
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Not found' } }));
}
// ============ 启动 ============
async function main() {
    // 全局错误处理
    process.on('uncaughtException', (err) => {
        console.error('[致命错误] uncaughtException:', err);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('[致命错误] unhandledRejection:', reason);
    });
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           ClawMarket 本地代理 v2                           ║');
    console.log('║           支付通道 + Ticket 签名                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    // 加载钱包
    wallet = loadOrCreateWallet();
    console.log('[钱包] 地址:', wallet.address);
    // 初始化客户端
    const account = privateKeyToAccount(wallet.privateKey);
    publicClient = createPublicClient({
        chain: baseSepolia,
        transport: viemHttp(RPC_URL)
    });
    walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: viemHttp(RPC_URL)
    });
    // 加载通道
    loadChannels();
    // 检查余额
    try {
        const balance = await getBalance();
        const ethBalance = await getETHBalance();
        console.log('[余额] USDC:', formatUnits(balance, 6));
        console.log('[余额] ETH:', formatUnits(ethBalance, 18));
        if (balance < MIN_BALANCE) {
            console.log('');
            console.log('⚠️  USDC 余额不足！请充值到:');
            console.log('   ', wallet.address);
            console.log('');
            console.log('获取测试币: https://faucet.circle.com/');
        }
        if (ethBalance < parseUnits('0.001', 18)) {
            console.log('');
            console.log('⚠️  ETH 余额不足（用于 gas）！请充值少量 ETH 到:');
            console.log('   ', wallet.address);
            console.log('');
            console.log('获取测试 ETH: https://www.alchemy.com/faucets/base-sepolia');
        }
    }
    catch (e) {
        console.error('[余额] 查询失败:', e.message);
    }
    // 启动服务器
    const server = http.createServer((req, res) => {
        // 包装 async handler，捕获错误
        handleRequest(req, res).catch((err) => {
            console.error('[请求错误]', err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    });
    server.on('error', (err) => {
        console.error('[服务器错误]', err);
    });
    server.listen(LOCAL_PORT, '127.0.0.1', () => {
        console.log('');
        console.log(`[代理] 运行在 http://127.0.0.1:${LOCAL_PORT}`);
        console.log('');
        console.log('端点:');
        console.log('  POST /v1/messages  - API 请求（自动签 ticket）');
        console.log('  GET  /status       - 查看钱包和通道状态');
        console.log('  GET  /open-channel - 手动开通道');
        console.log('');
        console.log('OpenClaw 配置:');
        console.log('  baseUrl: http://127.0.0.1:' + LOCAL_PORT);
        console.log('  apiKey: (任意)');
        console.log('  api: anthropic-messages');
        console.log('');
        console.log('[服务器] 等待请求...');
    });
    // 保持进程运行
    setInterval(() => { }, 1000 * 60 * 60); // 每小时空循环
}
main().catch((err) => {
    console.error('[启动失败]', err);
    process.exit(1);
});
//# sourceMappingURL=local-proxy.js.map