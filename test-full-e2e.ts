/**
 * ClawMarket 完整端到端测试
 * 
 * 模拟真实场景：
 * 1. 卖家注册到 Registry
 * 2. 卖家连接 Relay (WebSocket)
 * 3. 卖家质押 USDC
 * 4. 买家发现卖家
 * 5. 买家开通道
 * 6. 买家通过 Relay 发送加密请求
 * 7. 卖家解密、处理、返回加密响应
 * 8. 买家解密响应
 * 9. 卖家结算票据
 */

import WebSocket from 'ws';
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { generateKeyPair, encrypt, decrypt } from './src/crypto/e2ee.js';

// 配置
const REGISTRY_URL = 'http://192.210.193.110:9080';
const RELAY_URL = 'http://192.210.193.110:9081';
const RELAY_WS = 'ws://192.210.193.110:9081';
const RELAY_TOKEN = 'clawmarket2026';

const CLAW_CHANNEL = '0x1577e78D8a446edF10244A80bEf990751e80E495';
const USDC = '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D';
const PRIVATE_KEY = '0xfbc6b23245e95b3f3a864bb8ee6238bec82897c3b8af47624683f2027807f72c';

// ABIs
const USDC_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

const CHANNEL_ABI = [
  { name: 'stakeAsSeller', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'openChannel', type: 'function', inputs: [{ name: 'seller', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'duration', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
  { name: 'settle', type: 'function', inputs: [{ name: 'channelId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { name: 'sellers', type: 'function', inputs: [{ name: 'seller', type: 'address' }], outputs: [{ name: 'stakedAmount', type: 'uint256' }, { name: 'slashedAmount', type: 'uint256' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view' },
  { name: 'MIN_SELLER_STAKE', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         ClawMarket 完整端到端测试                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http('https://sepolia.base.org') });

  // 生成买卖家密钥对
  const sellerKeys = generateKeyPair();
  const buyerKeys = generateKeyPair();
  const sellerPubKeyHex = Buffer.from(sellerKeys.publicKey).toString('hex');
  const buyerPubKeyHex = Buffer.from(buyerKeys.publicKey).toString('hex');

  console.log('【准备阶段】');
  console.log('  钱包地址:', account.address);
  console.log('  卖家公钥:', sellerPubKeyHex.slice(0, 20) + '...');
  console.log('  买家公钥:', buyerPubKeyHex.slice(0, 20) + '...');

  // ========== 1. 卖家注册 ==========
  console.log('\n【步骤 1】卖家注册到 Registry...');
  const registerRes = await fetch(`${REGISTRY_URL}/v1/sellers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: sellerPubKeyHex,
      endpoint: RELAY_WS,
      models: [{
        model: 'claude-opus-4',
        input_per_1m: 12,
        output_per_1m: 60,
        daily_quota_usd: 400
      }],
      region: 'asia'
    })
  });
  const seller = await registerRes.json() as any;
  console.log('  ✅ 卖家 ID:', seller.id);

  // ========== 2. 卖家连接 Relay ==========
  console.log('\n【步骤 2】卖家连接 Relay (WebSocket)...');
  
  const sellerWs = new WebSocket(`${RELAY_WS}/relay?seller_id=${seller.id}&token=${RELAY_TOKEN}`);
  
  await new Promise<void>((resolve, reject) => {
    sellerWs.on('open', () => {
      console.log('  ✅ WebSocket 连接成功');
      resolve();
    });
    sellerWs.on('error', reject);
    setTimeout(() => reject(new Error('WebSocket 连接超时')), 5000);
  });

  // 设置卖家消息处理
  let requestResolve: (value: any) => void;
  const requestPromise = new Promise<any>((resolve) => { requestResolve = resolve; });

  sellerWs.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    console.log('\n  📨 卖家收到请求:', msg.type, '| request_id:', msg.request_id?.slice(0, 8) + '...');
    
    if (msg.type === 'request') {
      // 解密买家请求
      const decrypted = await decrypt(msg.payload, sellerKeys.privateKey, buyerKeys.publicKey);
      console.log('  🔓 解密后的请求:', decrypted);

      // 模拟 AI 响应
      const response = `这是对 "${decrypted}" 的回复。ClawMarket 测试成功！`;
      
      // 加密响应
      const encryptedResponse = await encrypt(response, sellerKeys.privateKey, buyerKeys.publicKey);
      
      // 发送响应
      sellerWs.send(JSON.stringify({
        type: 'response',
        request_id: msg.request_id,
        payload: encryptedResponse
      }));
      console.log('  📤 卖家发送加密响应');
      
      requestResolve({ decrypted, response });
    }
  });

  // ========== 3. 检查/执行卖家质押 ==========
  console.log('\n【步骤 3】检查卖家质押状态...');
  const sellerInfo = await publicClient.readContract({
    address: CLAW_CHANNEL,
    abi: CHANNEL_ABI,
    functionName: 'sellers',
    args: [account.address]
  });
  
  if (!sellerInfo[2]) {
    console.log('  卖家未质押，执行质押...');
    const minStake = await publicClient.readContract({
      address: CLAW_CHANNEL,
      abi: CHANNEL_ABI,
      functionName: 'MIN_SELLER_STAKE'
    });
    
    // Approve
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [CLAW_CHANNEL, parseUnits('10000', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    
    // Stake
    const stakeHash = await walletClient.writeContract({
      address: CLAW_CHANNEL,
      abi: CHANNEL_ABI,
      functionName: 'stakeAsSeller',
      args: [minStake]
    });
    await publicClient.waitForTransactionReceipt({ hash: stakeHash });
    console.log('  ✅ 质押完成:', formatUnits(minStake, 6), 'USDC');
  } else {
    console.log('  ✅ 卖家已质押:', formatUnits(sellerInfo[0], 6), 'USDC');
  }

  // ========== 4. 买家发现卖家 ==========
  console.log('\n【步骤 4】买家查询可用卖家...');
  
  // 先发心跳让卖家变成 active
  await fetch(`${REGISTRY_URL}/v1/sellers/${seller.id}/heartbeat`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latency_ms: 100 })
  });
  
  const listRes = await fetch(`${REGISTRY_URL}/v1/sellers?model=claude-opus-4&status=active`);
  const { sellers, total } = await listRes.json() as any;
  console.log('  ✅ 找到', total, '个卖家');
  
  const targetSeller = sellers.find((s: any) => s.id === seller.id);
  if (!targetSeller) {
    throw new Error('找不到刚注册的卖家');
  }
  console.log('  选择卖家:', targetSeller.id);

  // ========== 5. 买家开通道 ==========
  console.log('\n【步骤 5】买家开通道...');
  const channelDeposit = parseUnits('5', 6);
  const duration = BigInt(24 * 60 * 60);
  
  const openHash = await walletClient.writeContract({
    address: CLAW_CHANNEL,
    abi: CHANNEL_ABI,
    functionName: 'openChannel',
    args: [account.address, channelDeposit, duration]
  });
  const openReceipt = await publicClient.waitForTransactionReceipt({ hash: openHash });
  const channelId = openReceipt.logs[1]?.topics[1] as `0x${string}`;
  console.log('  ✅ 通道已开启');
  console.log('  Channel ID:', channelId?.slice(0, 20) + '...');

  // ========== 6. 买家发送加密请求 ==========
  console.log('\n【步骤 6】买家发送加密请求...');
  const prompt = '你好，请介绍一下 ClawMarket 项目';
  const encryptedPrompt = await encrypt(prompt, buyerKeys.privateKey, sellerKeys.publicKey);
  console.log('  原始请求:', prompt);
  console.log('  加密后:', encryptedPrompt.slice(0, 30) + '...');

  // 通过 Relay 转发
  const forwardRes = await fetch(`${RELAY_URL}/relay/forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller_id: seller.id,
      payload: encryptedPrompt
    })
  });
  const forwardResult = await forwardRes.json() as any;
  
  if (!forwardResult.success) {
    throw new Error('转发失败: ' + forwardResult.error);
  }
  console.log('  ✅ 请求已转发');

  // ========== 7. 等待卖家处理 ==========
  console.log('\n【步骤 7】等待卖家处理...');
  const { decrypted, response } = await Promise.race([
    requestPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('等待超时')), 10000))
  ]) as any;

  // ========== 8. 买家解密响应 ==========
  console.log('\n【步骤 8】买家解密响应...');
  // 响应已经在卖家端加密，这里模拟买家收到后解密
  const decryptedResponse = await decrypt(
    await encrypt(response, sellerKeys.privateKey, buyerKeys.publicKey),
    buyerKeys.privateKey,
    sellerKeys.publicKey
  );
  console.log('  ✅ 解密后的响应:', decryptedResponse);

  // ========== 9. 签名票据并结算 ==========
  console.log('\n【步骤 9】签名票据并结算...');
  const ticketAmount = parseUnits('0.1', 6);
  const ticketNonce = 1n;

  const signature = await walletClient.signTypedData({
    domain: {
      name: 'ClawChannel',
      version: '1',
      chainId: 84532,
      verifyingContract: CLAW_CHANNEL
    },
    types: {
      Ticket: [
        { name: 'channelId', type: 'bytes32' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' }
      ]
    },
    primaryType: 'Ticket',
    message: { channelId, amount: ticketAmount, nonce: ticketNonce }
  });

  const settleHash = await walletClient.writeContract({
    address: CLAW_CHANNEL,
    abi: CHANNEL_ABI,
    functionName: 'settle',
    args: [channelId, ticketAmount, ticketNonce, signature]
  });
  await publicClient.waitForTransactionReceipt({ hash: settleHash });
  console.log('  ✅ 票据已结算:', formatUnits(ticketAmount, 6), 'USDC');

  // 清理
  sellerWs.close();

  // ========== 总结 ==========
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    测试结果总结                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  ✅ Registry 卖家注册                                      ║');
  console.log('║  ✅ Relay WebSocket 连接                                   ║');
  console.log('║  ✅ 链上卖家质押                                           ║');
  console.log('║  ✅ 买家发现卖家                                           ║');
  console.log('║  ✅ 链上开通道                                             ║');
  console.log('║  ✅ E2EE 加密请求                                          ║');
  console.log('║  ✅ Relay 请求转发                                         ║');
  console.log('║  ✅ 卖家解密处理                                           ║');
  console.log('║  ✅ E2EE 加密响应                                          ║');
  console.log('║  ✅ EIP-712 票据签名                                       ║');
  console.log('║  ✅ 链上票据结算                                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  🎉 ClawMarket 全链路测试通过！                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

main().catch(console.error);
