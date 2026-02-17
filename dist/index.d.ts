/**
 * ClawMarket OpenClaw Plugin
 *
 * 一键安装，自动配置
 */
export { ClawMarketProvider, initClawMarket } from './provider.js';
export { ClawMarketOpenClawProvider, createProvider, metadata } from './openclaw-adapter.js';
export { generateKeyPair, encrypt, decrypt } from './crypto/e2ee.js';
export * from './types/index.js';
export { createProvider as default } from './openclaw-adapter.js';
//# sourceMappingURL=index.d.ts.map