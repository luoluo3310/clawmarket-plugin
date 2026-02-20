#!/usr/bin/env node
/**
 * ClawMarket 本地代理 v3 - 流式微支付版
 *
 * 改动：
 * - 直接 WebSocket 连 Relay（跳过 Gateway）
 * - 流式接收 AI 响应，SSE 推给 OpenClaw
 * - 收到 stream_end 后按实际 token 用量签最终 ticket
 * - 保留 HTTP 兼容模式（非 stream 请求走旧路径）
 */
import http from 'http';
import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWalletClient, createPublicClient, http as viemHttp, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import WebSocket from 'ws';
// ============ 配置 ============
const LOCAL_PORT = 19082;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://shenjige.xyz:9082';
const RELAY_WS_URL = process.env.RELAY_WS_URL || 'ws://shenjige.xyz:9081';
const RPC_URL = 'https://sepolia.base.org';
const USDC_CONTRACT = '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D';
const CHANNEL_CONTRACT = '0x1577e78D8a446edF10244A80bEf990751e80E495';
const MIN_BALANCE = 1000000n;
const CHANNEL_DEPOSIT = 10000000n;
const CHANNEL_DURATION = BigInt(7 * 24 * 60 * 60);
const COST_PER_REQUEST = 100000n; // 初始 ticket 0.1 USDC（预授权）
const SKIP_SELLER_STAKE_CHECK = true;
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
let defaultSeller = '0x3137cE5612af147f1BA17eBba7e8B46594ed3e26';
// 默认卖家在 Registry 的 ID（启动时获取）
let defaultSellerRegistryId = null;
// ============ 钱包管理 ============
function loadOrCreateWallet() {
    if (!fs.existsSync(DATA_DIR))
        fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(WALLET_PATH))
        return JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const w = { address: account.address, privateKey, createdAt: new Date().toISOString() };
    fs.writeFileSync(WALLET_PATH, JSON.stringify(w, null, 2), { mode: 0o600 });
    console.log('[钱包] 已创建:', w.address);
    return w;
}
function loadChannels() {
    if (!fs.existsSync(CHANNELS_PATH))
        return;
    try {
        const data = JSON.parse(fs.readFileSync(CHANNELS_PATH, 'utf-8'));
        for (const [key, value] of Object.entries(data)) {
            const ch = value;
            channels.set(key, { ...ch, deposit: BigInt(ch.deposit), spent: BigInt(ch.spent), nonce: BigInt(ch.nonce) });
        }
        console.log('[通道] 已加载', channels.size, '个');
    }
    catch { }
}
function saveChannels() {
    const data = {};
    for (const [key, value] of channels.entries()) {
        data[key] = { ...value, deposit: value.deposit.toString(), spent: value.spent.toString(), nonce: value.nonce.toString() };
    }
    fs.writeFileSync(CHANNELS_PATH, JSON.stringify(data, null, 2));
}
// ============ 链上操作 ============
async function getBalance() {
    return publicClient.readContract({ address: USDC_CONTRACT, abi: USDC_ABI, functionName: 'balanceOf', args: [wallet.address] });
}
async function getETHBalance() {
    return publicClient.getBalance({ address: wallet.address });
}
async function ensureApproval() {
    const allowance = await publicClient.readContract({ address: USDC_CONTRACT, abi: USDC_ABI, functionName: 'allowance', args: [wallet.address, CHANNEL_CONTRACT] });
    if (allowance < CHANNEL_DEPOSIT) {
        console.log('[链上] Approving USDC...');
        const hash = await walletClient.writeContract({ address: USDC_CONTRACT, abi: USDC_ABI, functionName: 'approve', args: [CHANNEL_CONTRACT, CHANNEL_DEPOSIT * 100n] });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('[链上] Approved!');
    }
}
async function recoverChannelFromChain(sellerAddress) {
    try {
        const buyerAddress = wallet.address.toLowerCase();
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock - 10000n > 0n ? latestBlock - 10000n : 0n;
        const logs = await publicClient.getLogs({ address: CHANNEL_CONTRACT, fromBlock, toBlock: latestBlock });
        for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];
            if (log.topics.length < 4)
                continue;
            const logBuyer = '0x' + (log.topics[2]?.slice(26) || '');
            const logSeller = '0x' + (log.topics[3]?.slice(26) || '');
            if (logBuyer.toLowerCase() === buyerAddress && logSeller.toLowerCase() === sellerAddress.toLowerCase()) {
                const channelId = log.topics[1];
                const channelData = await publicClient.readContract({ address: CHANNEL_CONTRACT, abi: CHANNEL_ABI, functionName: 'channels', args: [channelId] });
                if (!channelData[6])
                    continue;
                const expiresAt = Number(channelData[4]);
                if (expiresAt < Math.floor(Date.now() / 1000))
                    continue;
                const channel = { channelId, seller: sellerAddress, deposit: channelData[2], spent: channelData[3], nonce: 0n, expiresAt };
                channels.set(sellerAddress.toLowerCase(), channel);
                saveChannels();
                console.log('[恢复] 通道:', channelId.slice(0, 18) + '...');
                return channel;
            }
        }
    }
    catch (e) {
        console.log('[恢复] 失败:', e.message);
    }
    return null;
}
async function openChannel(sellerAddress) {
    console.log('[链上] 开通道到:', sellerAddress);
    const recovered = await recoverChannelFromChain(sellerAddress);
    if (recovered)
        return recovered;
    const ethBalance = await getETHBalance();
    if (ethBalance < parseUnits('0.001', 18))
        throw new Error('ETH 不足');
    const usdcBalance = await getBalance();
    if (usdcBalance < CHANNEL_DEPOSIT)
        throw new Error(`USDC 不足: ${formatUnits(usdcBalance, 6)}`);
    if (SKIP_SELLER_STAKE_CHECK)
        console.log('[测试] 跳过 stake 检查');
    await ensureApproval();
    const hash = await walletClient.writeContract({ address: CHANNEL_CONTRACT, abi: CHANNEL_ABI, functionName: 'openChannel', args: [sellerAddress, CHANNEL_DEPOSIT, CHANNEL_DURATION] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    let channelId = `0x${'0'.repeat(64)}`;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === CHANNEL_CONTRACT.toLowerCase() && log.topics.length > 1) {
            channelId = log.topics[1];
            break;
        }
    }
    const expiresAt = Math.floor(Date.now() / 1000) + Number(CHANNEL_DURATION);
    const channel = { channelId, seller: sellerAddress, deposit: CHANNEL_DEPOSIT, spent: 0n, nonce: 0n, expiresAt };
    channels.set(sellerAddress.toLowerCase(), channel);
    saveChannels();
    console.log('[链上] 通道开启:', channelId.slice(0, 18) + '...');
    return channel;
}
// ============ Ticket 签名 ============
async function signTicket(channel, amount) {
    channel.nonce += 1n;
    channel.spent += amount;
    const signature = await walletClient.signTypedData({
        domain: { name: 'ClawChannel', version: '1', chainId: 84532, verifyingContract: CHANNEL_CONTRACT },
        types: { Ticket: [{ name: 'channelId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] },
        primaryType: 'Ticket',
        message: { channelId: channel.channelId, amount: channel.spent, nonce: channel.nonce }
    });
    saveChannels();
    return { channelId: channel.channelId, amount: channel.spent.toString(), nonce: channel.nonce.toString(), signature, buyer: wallet.address };
}
// ============ 获取卖家 Registry ID ============
async function fetchSellerRegistryId() {
    return new Promise((resolve) => {
        http.get(`${GATEWAY_URL}/api/market`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.sellers?.length > 0)
                        resolve(result.sellers[0].id);
                    else
                        resolve(null);
                }
                catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}
// ============ 流式请求处理 ============
/**
 * 通过 WebSocket 连 Relay 发送流式请求
 * 返回 SSE 给 OpenClaw
 */
async function handleStreamRequest(req, res, body) {
    const request = JSON.parse(body);
    console.log(`[请求] Model: ${request.model}, Stream: true`);
    // 确保有通道和 ticket
    const sellerAddress = defaultSeller.toLowerCase();
    let channel = channels.get(sellerAddress);
    if (channel && (channel.expiresAt < Date.now() / 1000 || channel.spent + COST_PER_REQUEST > channel.deposit)) {
        channels.delete(sellerAddress);
        channel = undefined;
    }
    if (!channel) {
        try {
            channel = await openChannel(sellerAddress);
        }
        catch (e) {
            res.writeHead(402, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ type: 'error', error: { message: e.message } }));
            return;
        }
    }
    // 签初始 ticket
    const ticket = await signTicket(channel, COST_PER_REQUEST);
    console.log(`[Ticket] 初始 #${ticket.nonce} 累计: ${formatUnits(BigInt(ticket.amount), 6)} USDC`);
    // 注入 ticket 到请求体
    request._clawmarket = ticket;
    // 获取卖家 Registry ID
    if (!defaultSellerRegistryId) {
        defaultSellerRegistryId = await fetchSellerRegistryId();
    }
    if (!defaultSellerRegistryId) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { message: '无在线卖家' } }));
        return;
    }
    // WebSocket 连 Relay
    const wsUrl = `${RELAY_WS_URL}/relay/stream?seller_id=${defaultSellerRegistryId}`;
    const ws = new WebSocket(wsUrl);
    let responded = false;
    let fullText = '';
    // Anthropic SSE 格式
    const messageId = 'msg_' + Math.random().toString(36).slice(2, 12);
    ws.on('open', () => {
        // 发送请求
        ws.send(JSON.stringify({ type: 'request', payload: JSON.stringify(request) }));
    });
    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'response' && msg.payload?.includes('accepted')) {
                // 请求被接受，开始 SSE
                return;
            }
            if (msg.type === 'stream_start') {
                // 开始流式响应 — 发送 SSE headers
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });
                responded = true;
                // message_start event
                res.write(`event: message_start\ndata: ${JSON.stringify({
                    type: 'message_start',
                    message: { id: messageId, type: 'message', role: 'assistant', content: [], model: request.model || 'claude-opus-4-5', usage: { input_tokens: 0, output_tokens: 0 } }
                })}\n\n`);
                // content_block_start
                res.write(`event: content_block_start\ndata: ${JSON.stringify({
                    type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' }
                })}\n\n`);
                return;
            }
            if (msg.type === 'stream_chunk') {
                fullText += msg.payload;
                // content_block_delta
                res.write(`event: content_block_delta\ndata: ${JSON.stringify({
                    type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: msg.payload }
                })}\n\n`);
                return;
            }
            if (msg.type === 'stream_end') {
                // 收到最终 token 用量，签最终 ticket
                const usage = JSON.parse(msg.payload);
                const inputTokens = usage.usage?.input_tokens || 0;
                const outputTokens = usage.usage?.output_tokens || 0;
                const pricing = { input_per_1m: 1, output_per_1m: 5 };
                const actualCostUsd = (inputTokens / 1_000_000) * pricing.input_per_1m + (outputTokens / 1_000_000) * pricing.output_per_1m;
                const actualCostUsdc = BigInt(Math.ceil(actualCostUsd * 1_000_000)); // 转成 6 decimals
                // 如果实际费用 > 初始 ticket，签补充 ticket
                const initialAmount = COST_PER_REQUEST;
                if (actualCostUsdc > initialAmount && channel) {
                    const extra = actualCostUsdc - initialAmount;
                    const finalTicket = await signTicket(channel, extra);
                    console.log(`[Ticket] 最终 #${finalTicket.nonce} 累计: ${formatUnits(BigInt(finalTicket.amount), 6)} USDC (实际: $${actualCostUsd.toFixed(6)})`);
                    // 发送最终 ticket 给卖家
                    ws.send(JSON.stringify({ type: 'ticket', payload: JSON.stringify(finalTicket) }));
                }
                else {
                    console.log(`[计费] 实际 $${actualCostUsd.toFixed(6)} ≤ 初始 ticket，无需补签`);
                }
                // 发送 SSE 结束事件
                res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);
                res.write(`event: message_delta\ndata: ${JSON.stringify({
                    type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
                    usage: { output_tokens: outputTokens }
                })}\n\n`);
                res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
                res.end();
                ws.close();
                return;
            }
            if (msg.type === 'error') {
                const errPayload = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload);
                if (!responded) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ type: 'error', error: { message: errPayload } }));
                }
                else {
                    res.end();
                }
                ws.close();
                return;
            }
        }
        catch (e) {
            console.error('[WS] 解析错误:', e.message);
        }
    });
    ws.on('error', (err) => {
        console.error('[WS] 错误:', err.message);
        if (!responded) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ type: 'error', error: { message: 'Relay 连接失败' } }));
        }
    });
    ws.on('close', () => {
        if (!res.writableEnded)
            res.end();
    });
}
// ============ 非流式兼容（走 Gateway HTTP） ============
function proxyRequestHTTP(req, res, body, ticket) {
    const url = new URL(GATEWAY_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json', 'x-api-key': wallet.address, 'anthropic-version': '2023-06-01' };
    if (ticket) {
        headers['x-clawmarket-channel'] = ticket.channelId;
        headers['x-clawmarket-amount'] = ticket.amount;
        headers['x-clawmarket-nonce'] = ticket.nonce;
        headers['x-clawmarket-signature'] = ticket.signature;
    }
    const proxyReq = mod.request({ hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: '/v1/messages', method: 'POST', headers }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
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
    if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'claude-opus-4-5', object: 'model', created: Date.now(), owned_by: 'clawmarket' }] }));
        return;
    }
    if (req.method === 'POST' && (url === '/v1/messages' || url === '/messages')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const request = JSON.parse(body);
                // 流式请求走 WebSocket
                if (request.stream) {
                    await handleStreamRequest(req, res, body);
                    return;
                }
                // 非流式走旧路径
                const sellerAddress = defaultSeller.toLowerCase();
                let channel = channels.get(sellerAddress);
                if (channel && (channel.expiresAt < Date.now() / 1000 || channel.spent + COST_PER_REQUEST > channel.deposit)) {
                    channels.delete(sellerAddress);
                    channel = undefined;
                }
                if (!channel) {
                    try {
                        channel = await openChannel(sellerAddress);
                    }
                    catch { }
                }
                let ticket = undefined;
                if (channel) {
                    ticket = await signTicket(channel, COST_PER_REQUEST);
                    console.log(`[Ticket] #${ticket.nonce} 累计: ${formatUnits(BigInt(ticket.amount), 6)} USDC`);
                }
                proxyRequestHTTP(req, res, body, ticket);
            }
            catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ type: 'error', error: { message: err.message } }));
            }
        });
        return;
    }
    if (url === '/status') {
        try {
            const balance = await getBalance();
            const ethBalance = await getETHBalance();
            const channelList = Array.from(channels.entries()).map(([seller, ch]) => ({
                seller, channelId: ch.channelId.slice(0, 18) + '...', deposit: formatUnits(ch.deposit, 6) + ' USDC',
                spent: formatUnits(ch.spent, 6) + ' USDC', remaining: formatUnits(ch.deposit - ch.spent, 6) + ' USDC',
                nonce: ch.nonce.toString(), expiresAt: new Date(ch.expiresAt * 1000).toISOString()
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ wallet: wallet.address, balance: { usdc: formatUnits(balance, 6), eth: formatUnits(ethBalance, 18) }, channels: channelList, gateway: GATEWAY_URL, relay: RELAY_WS_URL, ready: balance >= MIN_BALANCE }, null, 2));
        }
        catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }
    if (url === '/open-channel') {
        try {
            const channel = await openChannel(defaultSeller);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, channelId: channel.channelId, deposit: formatUnits(channel.deposit, 6) + ' USDC' }));
        }
        catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
}
// ============ 启动 ============
async function main() {
    process.on('uncaughtException', (err) => console.error('[致命]', err));
    process.on('unhandledRejection', (reason) => console.error('[致命]', reason));
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   ClawMarket 本地代理 v3 - 流式微支付版                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    wallet = loadOrCreateWallet();
    console.log('[钱包]', wallet.address);
    const account = privateKeyToAccount(wallet.privateKey);
    publicClient = createPublicClient({ chain: baseSepolia, transport: viemHttp(RPC_URL) });
    walletClient = createWalletClient({ account, chain: baseSepolia, transport: viemHttp(RPC_URL) });
    loadChannels();
    try {
        const balance = await getBalance();
        const ethBalance = await getETHBalance();
        console.log('[余额] USDC:', formatUnits(balance, 6), '| ETH:', formatUnits(ethBalance, 18));
        if (balance < MIN_BALANCE)
            console.log('⚠️  USDC 不足，请充值到:', wallet.address);
    }
    catch (e) {
        console.error('[余额] 查询失败:', e.message);
    }
    // 预获取卖家 Registry ID
    defaultSellerRegistryId = await fetchSellerRegistryId();
    if (defaultSellerRegistryId)
        console.log('[卖家] Registry ID:', defaultSellerRegistryId);
    else
        console.log('[卖家] ⚠️ 未找到在线卖家');
    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
            if (!res.headersSent) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    });
    server.listen(LOCAL_PORT, '127.0.0.1', () => {
        console.log(`\n[代理] http://127.0.0.1:${LOCAL_PORT}`);
        console.log('[模式] stream → WebSocket (Relay), 非 stream → HTTP (Gateway)');
        console.log('[Relay]', RELAY_WS_URL);
        console.log('');
    });
    setInterval(() => { }, 3600000);
}
main().catch((err) => { console.error('[启动失败]', err); process.exit(1); });
//# sourceMappingURL=local-proxy.js.map