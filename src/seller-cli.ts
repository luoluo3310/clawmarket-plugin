#!/usr/bin/env node
/**
 * ClawMarket Seller CLI
 * 
 * 一键启动卖家模式，把闲置 AI 额度卖出去赚钱
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn } from 'child_process';
import { DEFAULT_CONFIG } from './config.js';

const CLAWMARKET_DIR = path.join(os.homedir(), '.clawmarket');
const SELLER_CONFIG_PATH = path.join(CLAWMARKET_DIR, 'seller.json');
const SELLER_PID_PATH = path.join(CLAWMARKET_DIR, 'seller.pid');
const SELLER_STATS_PATH = path.join(CLAWMARKET_DIR, 'seller-stats.json');

// 默认市场价格
const DEFAULT_PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5': { input: 1, output: 5 },
  'claude-sonnet-4': { input: 0.5, output: 2.5 },
  'gpt-4o': { input: 0.5, output: 2 },
  'gpt-4o-mini': { input: 0.05, output: 0.2 },
};

// 每日上限档位
const DAILY_LIMITS = [
  { name: '轻度 / Light', usd: 5, desc: '适合偶尔用 AI 的人 / For casual users' },
  { name: '中度 / Medium', usd: 20, desc: '适合中度使用者 / For moderate users' },
  { name: '重度 / Heavy', usd: 50, desc: '适合有多个订阅的人 / For power users' },
];

// 模型来源
const SOURCE_TYPES = [
  { name: 'Claude Pro/Max (包月 / Subscription)', key: 'claude-sub', defaultModel: 'claude-opus-4-5' },
  { name: 'OpenAI Plus/Pro (包月 / Subscription)', key: 'openai-sub', defaultModel: 'gpt-4o' },
  { name: 'API Key (中转站 / Relay)', key: 'api-key', defaultModel: 'claude-opus-4-5' },
];

export interface SellerConfigData {
  sourceType: string;
  model: string;
  apiBaseUrl: string;
  apiKey: string;
  pricing: { inputPer1m: number; outputPer1m: number };
  dailyLimitUsd: number;
  region: string;
  createdAt: string;
  updatedAt: string;
}

function rl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(r: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => r.question(question, resolve));
}

function loadSellerConfig(): SellerConfigData | null {
  if (fs.existsSync(SELLER_CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(SELLER_CONFIG_PATH, 'utf-8'));
  }
  return null;
}

function saveSellerConfig(config: SellerConfigData) {
  if (!fs.existsSync(CLAWMARKET_DIR)) fs.mkdirSync(CLAWMARKET_DIR, { recursive: true });
  fs.writeFileSync(SELLER_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function isSellerRunning(): boolean {
  if (!fs.existsSync(SELLER_PID_PATH)) return false;
  const pid = parseInt(fs.readFileSync(SELLER_PID_PATH, 'utf-8').trim());
  try { process.kill(pid, 0); return true; } catch { fs.unlinkSync(SELLER_PID_PATH); return false; }
}

/**
 * 交互式配置卖家
 */
async function setupSeller(): Promise<SellerConfigData> {
  const r = rl();
  console.log('');
  console.log('🛒 卖家配置 / Seller Setup');
  console.log('─'.repeat(50));

  // 选模型来源
  console.log('');
  console.log('选择你的 AI 来源 / Choose your AI source:');
  SOURCE_TYPES.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
  const sourceIdx = parseInt(await ask(r, '\n选择 (1-3): ')) - 1;
  const source = SOURCE_TYPES[Math.max(0, Math.min(sourceIdx, 2))]!;

  // API 地址
  console.log('');
  const defaultUrl = source.key === 'openai-sub'
    ? 'https://api.openai.com'
    : 'https://api.anthropic.com';
  const apiBaseUrl = (await ask(r, `API 地址 (默认 ${defaultUrl}): `)).trim() || defaultUrl;

  // API Key
  const apiKey = (await ask(r, 'API Key: ')).trim();
  if (!apiKey) { console.log('❌ API Key 不能为空'); r.close(); process.exit(1); }

  // 模型
  const defaultModel = source.defaultModel;
  const model = (await ask(r, `模型名称 (默认 ${defaultModel}): `)).trim() || defaultModel;

  // 定价
  const defaultPrice = DEFAULT_PRICES[model] || { input: 1, output: 5 };
  console.log('');
  console.log(`当前市场推荐价 / Market price: $${defaultPrice.input}/M 输入, $${defaultPrice.output}/M 输出`);
  const useDefault = (await ask(r, '使用推荐价格？(Y/n): ')).trim().toLowerCase();
  let pricing = { inputPer1m: defaultPrice.input, outputPer1m: defaultPrice.output };
  if (useDefault === 'n') {
    const inp = parseFloat(await ask(r, `输入价格 $/M (默认 ${defaultPrice.input}): `)) || defaultPrice.input;
    const out = parseFloat(await ask(r, `输出价格 $/M (默认 ${defaultPrice.output}): `)) || defaultPrice.output;
    pricing = { inputPer1m: inp, outputPer1m: out };
  }

  // 每日上限
  console.log('');
  console.log('每日出售上限 / Daily limit:');
  DAILY_LIMITS.forEach((l, i) => console.log(`  ${i + 1}. ${l.name} — $${l.usd}/天 (${l.desc})`));
  const limitIdx = parseInt(await ask(r, '\n选择 (1-3): ')) - 1;
  const dailyLimitUsd = DAILY_LIMITS[Math.max(0, Math.min(limitIdx, 2))]!.usd;

  r.close();

  const config: SellerConfigData = {
    sourceType: source.key,
    model,
    apiBaseUrl,
    apiKey,
    pricing,
    dailyLimitUsd,
    region: 'auto',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveSellerConfig(config);
  return config;
}

/**
 * 注册到 Registry
 */
async function registerSeller(config: SellerConfigData): Promise<string> {
  const crypto = await import('crypto');
  const publicKey = crypto.randomBytes(32).toString('hex');

  const payload = {
    public_key: publicKey,
    endpoint: DEFAULT_CONFIG.relayWs,
    models: [{
      model: config.model,
      input_per_1m: config.pricing.inputPer1m,
      output_per_1m: config.pricing.outputPer1m,
      daily_quota_usd: config.dailyLimitUsd,
    }],
    region: config.region,
  };

  const res = await fetch(`${DEFAULT_CONFIG.registryUrl}/v1/sellers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`注册失败: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  return data.id;
}

/**
 * 启动卖家节点（后台）
 */
function startSellerDaemon(): boolean {
  if (isSellerRunning()) {
    console.log('[卖家] 已在运行中');
    return true;
  }

  const sellerScript = path.join(path.dirname(new URL(import.meta.url).pathname), 'seller-daemon.js');
  const child = spawn('node', [sellerScript], {
    detached: true,
    stdio: 'ignore',
    cwd: CLAWMARKET_DIR,
  });
  child.unref();

  if (child.pid) {
    fs.writeFileSync(SELLER_PID_PATH, child.pid.toString());
    return true;
  }
  return false;
}

/**
 * 停止卖家
 */
function stopSeller(): boolean {
  if (!fs.existsSync(SELLER_PID_PATH)) { console.log('[卖家] 未在运行'); return true; }
  const pid = parseInt(fs.readFileSync(SELLER_PID_PATH, 'utf-8').trim());
  try { process.kill(pid, 'SIGTERM'); fs.unlinkSync(SELLER_PID_PATH); return true; } catch { return false; }
}

/**
 * 查看卖家状态
 */
function showSellerStatus() {
  const config = loadSellerConfig();
  const running = isSellerRunning();

  console.log('');
  console.log('🛒 卖家状态 / Seller Status');
  console.log('─'.repeat(50));

  if (!config) {
    console.log('未配置。运行 clawmarket sell 开始。');
    console.log('Not configured. Run clawmarket sell to start.');
    return;
  }

  console.log(`模型:      ${config.model}`);
  console.log(`来源:      ${config.sourceType}`);
  console.log(`API:       ${config.apiBaseUrl}`);
  console.log(`定价:      $${config.pricing.inputPer1m}/M 输入, $${config.pricing.outputPer1m}/M 输出`);
  console.log(`每日上限:  $${config.dailyLimitUsd}`);
  console.log(`状态:      ${running ? '✅ 运行中 / Running' : '❌ 未运行 / Stopped'}`);

  // 读取今日统计
  if (fs.existsSync(SELLER_STATS_PATH)) {
    try {
      const stats = JSON.parse(fs.readFileSync(SELLER_STATS_PATH, 'utf-8'));
      const today = new Date().toISOString().slice(0, 10);
      if (stats.date === today) {
        console.log(`今日接单:  ${stats.requests || 0} 次`);
        console.log(`今日收入:  $${(stats.earned || 0).toFixed(4)}`);
        console.log(`今日已售:  $${(stats.sold || 0).toFixed(4)} / $${config.dailyLimitUsd}`);
      }
    } catch {}
  }

  console.log('─'.repeat(50));
  console.log('');
}

/**
 * 修改价格
 */
async function updatePrice() {
  const config = loadSellerConfig();
  if (!config) {
    console.log('未配置。运行 clawmarket sell 开始。');
    return;
  }

  const args = process.argv.slice(2);
  let inputPrice: number | undefined;
  let outputPrice: number | undefined;

  // 解析 --input 和 --output 参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputPrice = parseFloat(args[i + 1]!);
    if (args[i] === '--output' && args[i + 1]) outputPrice = parseFloat(args[i + 1]!);
  }

  if (inputPrice === undefined && outputPrice === undefined) {
    // 交互模式
    const r = rl();
    console.log('');
    console.log(`当前价格: $${config.pricing.inputPer1m}/M 输入, $${config.pricing.outputPer1m}/M 输出`);
    inputPrice = parseFloat(await ask(r, `新输入价格 $/M (回车保持 ${config.pricing.inputPer1m}): `)) || config.pricing.inputPer1m;
    outputPrice = parseFloat(await ask(r, `新输出价格 $/M (回车保持 ${config.pricing.outputPer1m}): `)) || config.pricing.outputPer1m;
    r.close();
  }

  config.pricing.inputPer1m = inputPrice || config.pricing.inputPer1m;
  config.pricing.outputPer1m = outputPrice || config.pricing.outputPer1m;
  config.updatedAt = new Date().toISOString();
  saveSellerConfig(config);

  // 重新注册到 Registry 更新价格
  try {
    await registerSeller(config);
    console.log(`✅ 价格已更新: $${config.pricing.inputPer1m}/M 输入, $${config.pricing.outputPer1m}/M 输出`);
  } catch (e: any) {
    console.log(`⚠️  本地已更新，但 Registry 同步失败: ${e.message}`);
    console.log('   下次启动时会自动同步。');
  }
}

/**
 * 卖家 CLI 主入口
 */
export async function sellerMain(subcommand?: string) {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   ClawMarket Seller — 卖闲置额度，赚 USDC               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  if (subcommand === 'status') {
    showSellerStatus();
    return;
  }

  if (subcommand === 'stop') {
    if (stopSeller()) console.log('[卖家] ✅ 已停止');
    else console.log('[卖家] ❌ 停止失败');
    return;
  }

  if (subcommand === 'price') {
    await updatePrice();
    return;
  }

  // 默认：配置 + 启动
  let config = loadSellerConfig();

  if (!config) {
    // 首次，交互式配置
    config = await setupSeller();
    console.log('');
    console.log('[配置] ✅ 已保存到 ~/.clawmarket/seller.json');
  } else {
    console.log('');
    console.log(`[配置] 已有配置: ${config.model} @ $${config.pricing.inputPer1m}/$${config.pricing.outputPer1m}`);
    console.log('[配置] 如需修改，运行 clawmarket sell price');
  }

  // 注册到 Registry
  console.log('[注册] 连接 Registry...');
  try {
    const sellerId = await registerSeller(config);
    console.log(`[注册] ✅ 卖家 ID: ${sellerId}`);
  } catch (e: any) {
    console.log(`[注册] ⚠️  ${e.message}`);
    console.log('[注册] 将在后台重试...');
  }

  // 启动后台卖家进程
  console.log('[启动] 启动卖家节点...');
  if (startSellerDaemon()) {
    console.log('[启动] ✅ 已在后台运行');
  } else {
    console.log('[启动] ❌ 启动失败');
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  ✅ 卖家已上线！等待买家请求...');
  console.log('');
  console.log('  常用命令:');
  console.log('    clawmarket sell status  — 查看状态和收入');
  console.log('    clawmarket sell price   — 修改价格');
  console.log('    clawmarket sell stop    — 停止卖家');
  console.log('');
  console.log('  Dashboard: http://192.210.193.110:9082/');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}
