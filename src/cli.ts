#!/usr/bin/env node
/**
 * ClawMarket CLI + OpenClaw 自动配置
 */

import { ClawMarketProvider } from './provider.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'config.yaml');

function ensureOpenClawConfig() {
  const dir = path.dirname(OPENCLAW_CONFIG_PATH);
  
  // 创建目录
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 检查配置文件
  let config = '';
  if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    config = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
  }
  
  // 如果没有 clawmarket provider，添加它
  if (!config.includes('clawmarket')) {
    const clawmarketConfig = `
# ClawMarket - 去中心化 AI 算力市场 (自动添加)
providers:
  clawmarket:
    type: clawmarket
    default: true
`;
    
    if (config.includes('providers:')) {
      // 已有 providers，添加 clawmarket
      config = config.replace(
        'providers:',
        `providers:
  clawmarket:
    type: clawmarket`
      );
    } else {
      // 没有 providers，添加整个配置
      config = config + clawmarketConfig;
    }
    
    fs.writeFileSync(OPENCLAW_CONFIG_PATH, config);
    console.log('[ClawMarket] 已自动配置 OpenClaw');
  }
}

async function main() {
  console.log('');
  console.log('  ██████╗██╗      █████╗ ██╗    ██╗███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗████████╗');
  console.log(' ██╔════╝██║     ██╔══██╗██║    ██║████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝╚══██╔══╝');
  console.log(' ██║     ██║     ███████║██║ █╗ ██║██╔████╔██║███████║██████╔╝█████╔╝ █████╗     ██║   ');
  console.log(' ██║     ██║     ██╔══██║██║███╗██║██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══╝     ██║   ');
  console.log(' ╚██████╗███████╗██║  ██║╚███╔███╔╝██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████╗   ██║   ');
  console.log('  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ');
  console.log('');
  console.log('  去中心化 AI 算力市场 - 让每个人都能用上最好的 AI');
  console.log('');
  
  // 自动配置 OpenClaw
  ensureOpenClawConfig();
  
  // 初始化 provider
  const provider = new ClawMarketProvider();
  const status = await provider.initialize();
  
  if (!status.ready) {
    console.log('');
    console.log('下一步：');
    console.log('  1. 充值 USDC 到上面的地址 (Base Sepolia 网络)');
    console.log('  2. 充值后直接运行 openclaw 即可使用');
    console.log('');
    console.log('获取测试 USDC: https://faucet.circle.com/');
    console.log('');
    
    // 等待充值
    console.log('正在监听充值...(充值后自动继续)');
    await provider.waitForBalance();
  }
  
  console.log('');
  console.log('✅ ClawMarket 已就绪！');
  console.log('');
  console.log('现在可以直接运行 openclaw 开始使用');
  console.log('');
}

main().catch(console.error);
