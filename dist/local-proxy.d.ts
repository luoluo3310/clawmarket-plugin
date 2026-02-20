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
export {};
//# sourceMappingURL=local-proxy.d.ts.map