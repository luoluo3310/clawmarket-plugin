/**
 * ClawMarket 卖家节点
 * 
 * 王小宝作为卖家，出售 Claude Opus 算力
 */

import WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import { generateKeyPair, encrypt, decrypt } from './src/crypto/e2ee.js';

const REGISTRY_URL = 'http://192.210.193.110:9080';
const RELAY_WS = 'ws://192.210.193.110:9081';
const RELAY_TOKEN = 'clawmarket2026';

// 卖家配置
const SELLER_CONFIG = {
  name: 'xiaobao-opus',
  models: [{
    model: 'claude-opus-4',
    input_per_1m: 10,    // 比官方便宜
    output_per_1m: 50,
    daily_quota_usd: 400
  }],
  region: 'asia'
};

// 生成持久密钥对
const sellerKeys = generateKeyPair();
const sellerPubKeyHex = Buffer.from(sellerKeys.publicKey).toString('hex');

let sellerId: string;
let ws: WebSocket;
let anthropic: Anthropic;

async function register() {
  console.log('[注册] 向 Registry 注册...');
  
  const res = await fetch(`${REGISTRY_URL}/v1/sellers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: sellerPubKeyHex,
      endpoint: RELAY_WS,
      ...SELLER_CONFIG
    })
  });
  
  const seller = await res.json() as any;
  sellerId = seller.id;
  console.log('[注册] 成功! ID:', sellerId);
  console.log('[注册] 公钥:', sellerPubKeyHex.slice(0, 30) + '...');
}

async function connectRelay() {
  console.log('[Relay] 连接中...');
  
  ws = new WebSocket(`${RELAY_WS}/relay?seller_id=${sellerId}&token=${RELAY_TOKEN}`);
  
  ws.on('open', () => {
    console.log('[Relay] 连接成功!');
  });
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'request') {
        console.log('\n[请求] 收到请求:', msg.request_id.slice(0, 8) + '...');
        
        // 解密请求 (需要买家公钥，这里简化处理)
        // 实际应该从请求中获取买家公钥
        const prompt = msg.payload; // 简化：直接使用明文
        
        console.log('[请求] 内容:', typeof prompt === 'string' ? prompt.slice(0, 50) : '(encrypted)');
        
        // 调用 Claude API
        console.log('[AI] 调用 Claude Opus...');
        const response = await callClaude(prompt);
        console.log('[AI] 响应长度:', response.length);
        
        // 发送响应
        ws.send(JSON.stringify({
          type: 'response',
          request_id: msg.request_id,
          payload: response
        }));
        console.log('[响应] 已发送');
      }
    } catch (err: any) {
      console.error('[错误]', err.message);
    }
  });
  
  ws.on('close', () => {
    console.log('[Relay] 连接断开，5秒后重连...');
    setTimeout(connectRelay, 5000);
  });
  
  ws.on('error', (err) => {
    console.error('[Relay] 错误:', err.message);
  });
}

async function callClaude(prompt: string): Promise<string> {
  if (!anthropic) {
    // 使用环境变量中的 API key
    anthropic = new Anthropic();
  }
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',  // 先用 sonnet 测试
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });
  
  return (message.content[0] as any).text;
}

function startHeartbeat() {
  setInterval(async () => {
    try {
      await fetch(`${REGISTRY_URL}/v1/sellers/${sellerId}/heartbeat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latency_ms: 100 })
      });
      console.log('[心跳] OK');
    } catch (err: any) {
      console.error('[心跳] 失败:', err.message);
    }
  }, 20000); // 每 20 秒
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ClawMarket 卖家节点 - 王小宝        ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  await register();
  await connectRelay();
  startHeartbeat();
  
  console.log('\n[状态] 卖家节点运行中...');
  console.log('[状态] 出售模型: claude-opus-4');
  console.log('[状态] 价格: $10/1M input, $50/1M output');
  console.log('[状态] 等待买家请求...\n');
}

main().catch(console.error);
