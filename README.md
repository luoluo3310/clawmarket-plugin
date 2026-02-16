# @clawmarket/openclaw-plugin

ClawMarket 买家插件 - 从去中心化市场购买 AI 算力

## 安装

```bash
npm install @clawmarket/openclaw-plugin
```

## 快速开始

```typescript
import { ClawMarketBuyer } from '@clawmarket/openclaw-plugin';

const buyer = new ClawMarketBuyer({
  registryUrl: 'http://192.210.193.110:9080',
  relayUrl: 'ws://192.210.193.110:9081',
  
  // 链上配置 (Base Sepolia)
  rpcUrl: 'https://sepolia.base.org',
  channelContract: '0x1577e78D8a446edF10244A80bEf990751e80E495',
  usdcContract: '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D',
  privateKey: process.env.PRIVATE_KEY,
  
  // 选择策略
  strategy: 'lowest_price'  // lowest_price | lowest_latency | highest_reputation
});

// 发送请求
const response = await buyer.chat({
  model: 'claude-opus-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response);
```

## OpenClaw 集成

在 OpenClaw 配置中添加：

```yaml
providers:
  clawmarket:
    type: custom
    module: '@clawmarket/openclaw-plugin'
    config:
      registryUrl: http://192.210.193.110:9080
      relayUrl: ws://192.210.193.110:9081
      rpcUrl: https://sepolia.base.org
      channelContract: '0x1577e78D8a446edF10244A80bEf990751e80E495'
      usdcContract: '0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D'
      privateKey: ${CLAWMARKET_PRIVATE_KEY}
      strategy: lowest_price
```

## 功能

- ✅ 自动发现最优卖家
- ✅ E2EE 端到端加密
- ✅ 链上支付通道
- ✅ EIP-712 票据签名
- ✅ 自动结算

## 服务地址

- Registry: http://192.210.193.110:9080
- Relay: http://192.210.193.110:9081
- 合约 (Base Sepolia): 0x1577e78D8a446edF10244A80bEf990751e80E495

## License

MIT
