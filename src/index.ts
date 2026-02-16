/**
 * ClawMarket OpenClaw Plugin
 * 
 * 一键安装，自动配置
 */

// 核心导出
export { ClawMarketProvider, initClawMarket } from './provider.js';
export { ClawMarketOpenClawProvider, createProvider, metadata } from './openclaw-adapter.js';
export { generateKeyPair, encrypt, decrypt } from './crypto/e2ee.js';
export * from './types/index.js';

// 默认导出 OpenClaw provider 创建函数
export { createProvider as default } from './openclaw-adapter.js';
