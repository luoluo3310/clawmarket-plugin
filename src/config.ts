/**
 * ClawMarket 默认配置
 * 
 * 用户无需配置，开箱即用
 */

export const DEFAULT_CONFIG = {
  // 服务地址
  registryUrl: 'http://shenjige.xyz:9080',
  relayUrl: 'http://shenjige.xyz:9081',
  relayWs: 'ws://shenjige.xyz:9081',
  
  // 链配置 (Base Sepolia)
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532,
  channelContract: '0x1577e78D8a446edF10244A80bEf990751e80E495' as `0x${string}`,
  usdcContract: '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D' as `0x${string}`,
  
  // 默认参数
  minBalance: 1_000_000n,      // 1 USDC
  channelDeposit: 10_000_000n, // 10 USDC per channel
  strategy: 'lowest_price' as const,
};

/**
 * OpenClaw 自动配置
 * 
 * 插件安装后自动注入到 OpenClaw 配置
 */
export const OPENCLAW_PROVIDER_CONFIG = {
  name: 'clawmarket',
  type: 'clawmarket',
  models: [
    'claude-opus-4',
    'claude-sonnet-4', 
    'gpt-4',
    'gpt-4-turbo'
  ],
  default: true,  // 设为默认 provider
};
