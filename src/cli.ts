#!/usr/bin/env node
import { ClawMarketProvider } from './provider.js';

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
  
  const provider = new ClawMarketProvider();
  const status = await provider.initialize();
  
  if (!status.ready) {
    console.log('正在等待充值...');
    console.log('充值地址:', status.address);
    console.log('网络: Base Sepolia');
    console.log('代币: USDC');
    console.log('');
    
    await provider.waitForBalance();
  }
  
  console.log('ClawMarket 已就绪！');
}

main().catch(console.error);
