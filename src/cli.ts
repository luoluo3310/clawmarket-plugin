#!/usr/bin/env node
/**
 * ClawMarket CLI - 一键配置 + 启动代理
 * 
 * 用法：
 *   clawmarket          - 配置 OpenClaw + 启动代理
 *   clawmarket setup    - 只配置，不启动代理
 *   clawmarket status   - 查看状态
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { createPublicClient, http as viemHttp, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sellerMain } from './seller-cli.js';

const LOCAL_PORT = 19082;
const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const CLAWMARKET_DIR = path.join(os.homedir(), '.clawmarket');
const WALLET_PATH = path.join(CLAWMARKET_DIR, 'wallet.json');
const PID_PATH = path.join(CLAWMARKET_DIR, 'proxy.pid');

const USDC_CONTRACT = '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D';
const USDC_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

// ============ 钱包管理 ============
interface WalletData {
  address: string;
  privateKey: string;
  createdAt: string;
}

function loadOrCreateWallet(): WalletData {
  if (!fs.existsSync(CLAWMARKET_DIR)) {
    fs.mkdirSync(CLAWMARKET_DIR, { recursive: true });
  }

  if (fs.existsSync(WALLET_PATH)) {
    return JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  const wallet: WalletData = {
    address: account.address,
    privateKey: privateKey,
    createdAt: new Date().toISOString()
  };
  
  fs.writeFileSync(WALLET_PATH, JSON.stringify(wallet, null, 2), { mode: 0o600 });
  return wallet;
}

async function getBalance(address: string): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: viemHttp('https://sepolia.base.org')
  });
  
  return await publicClient.readContract({
    address: USDC_CONTRACT,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`]
  });
}

// ============ OpenClaw 配置 ============
function configureOpenClaw() {
  const dir = path.dirname(OPENCLAW_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let config: any = {};
  if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
  }
  
  // 确保结构存在
  if (!config.models) config.models = {};
  if (!config.models.providers) config.models.providers = {};
  if (!config.gateway) config.gateway = {};
  
  config.gateway.mode = 'local';
  
  // 指向本地代理
  config.models.providers.clawmarket = {
    baseUrl: `http://127.0.0.1:${LOCAL_PORT}`,
    apiKey: 'clawmarket',
    api: 'anthropic-messages',
    models: [
      {
        id: 'claude-opus-4-5',
        name: 'Claude Opus 4.5 (ClawMarket)',
        reasoning: false,
        input: ['text', 'image'],
        contextWindow: 200000,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
      }
    ]
  };
  
  // 删除可能存在的无效 routing 字段
  if (config.models.routing) delete config.models.routing;
  
  // 备份并保存
  if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    fs.copyFileSync(OPENCLAW_CONFIG_PATH, OPENCLAW_CONFIG_PATH + '.bak');
  }
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
  
  return true;
}

// ============ 代理管理 ============
function isProxyRunning(): boolean {
  if (!fs.existsSync(PID_PATH)) return false;
  
  const pid = parseInt(fs.readFileSync(PID_PATH, 'utf-8').trim());
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    fs.unlinkSync(PID_PATH);
    return false;
  }
}

function startProxy(): boolean {
  if (isProxyRunning()) {
    console.log('[代理] 已在运行中');
    return true;
  }

  // 找到 local-proxy.js 的路径
  const proxyPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'local-proxy.js');
  
  const child = spawn('node', [proxyPath], {
    detached: true,
    stdio: 'ignore',
    cwd: CLAWMARKET_DIR
  });
  
  child.unref();
  
  if (child.pid) {
    fs.writeFileSync(PID_PATH, child.pid.toString());
    return true;
  }
  return false;
}

function stopProxy(): boolean {
  if (!fs.existsSync(PID_PATH)) return true;
  
  const pid = parseInt(fs.readFileSync(PID_PATH, 'utf-8').trim());
  try {
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(PID_PATH);
    return true;
  } catch {
    return false;
  }
}

// ============ 主逻辑 ============
async function showStatus() {
  const wallet = loadOrCreateWallet();
  const balance = await getBalance(wallet.address);
  const running = isProxyRunning();
  
  console.log('');
  console.log('ClawMarket 状态');
  console.log('─'.repeat(50));
  console.log(`钱包地址:  ${wallet.address}`);
  console.log(`USDC 余额: ${formatUnits(balance, 6)} USDC`);
  console.log(`代理状态:  ${running ? '✅ 运行中' : '❌ 未运行'}`);
  console.log(`代理地址:  http://127.0.0.1:${LOCAL_PORT}`);
  console.log('─'.repeat(50));
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   ClawMarket - 去中心化 AI 算力市场                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // 卖家命令
  if (command === 'sell') {
    await sellerMain(args[1]);
    return;
  }

  if (command === 'status') {
    await showStatus();
    return;
  }

  if (command === 'stop') {
    if (stopProxy()) {
      console.log('[代理] 已停止');
    }
    return;
  }

  // setup 或 start
  const wallet = loadOrCreateWallet();
  console.log('[钱包] 地址:', wallet.address);

  // 检查余额
  const balance = await getBalance(wallet.address);
  console.log('[余额]', formatUnits(balance, 6), 'USDC');

  if (balance < 1_000_000n) {
    console.log('');
    console.log('⚠️  余额不足！请充值 USDC (Base Sepolia) 到:');
    console.log('');
    console.log(`    ${wallet.address}`);
    console.log('');
    console.log('获取测试币: https://faucet.circle.com/');
    console.log('');
  }

  // 配置 OpenClaw
  console.log('[配置] 更新 OpenClaw 配置...');
  configureOpenClaw();
  console.log('[配置] ✅ 完成');

  if (command === 'setup') {
    console.log('');
    console.log('配置完成！运行 clawmarket 启动代理。');
    return;
  }

  // 启动代理
  console.log('[代理] 启动中...');
  if (startProxy()) {
    console.log('[代理] ✅ 已在后台启动');
  } else {
    console.log('[代理] ❌ 启动失败');
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  ✅ 配置完成！');
  console.log('');
  console.log('  现在可以直接使用 OpenClaw，模型会自动走 ClawMarket。');
  console.log('');
  console.log('  常用命令:');
  console.log('    clawmarket status  - 查看状态');
  console.log('    clawmarket stop    - 停止代理');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

main().catch(console.error);
