# @clawmarket/openclaw-plugin

去中心化 AI 算力市场插件 - 让每个人都能用上最好的 AI

## 特点

- 🚀 **一键安装** - 无需复杂配置
- 💰 **自动钱包** - 首次运行自动生成钱包
- 🔒 **端到端加密** - 你的 prompt 只有你和卖家能看到
- ⛓️ **链上结算** - 基于 Base 链的支付通道，安全透明
- 🤖 **全自动** - 自动发现卖家、开通道、签票据

## 安装

```bash
npm install github:luoluo3310/clawmarket-plugin
```

## 使用

### 方式一：直接运行

```bash
npx clawmarket
```

首次运行会：
1. 自动生成钱包
2. 显示充值地址
3. 等待你充值 USDC
4. 充值后自动激活

### 方式二：在代码中使用

```typescript
import { ClawMarketProvider } from '@clawmarket/openclaw-plugin';

const provider = new ClawMarketProvider();
await provider.initialize();

// 发送请求
const response = await provider.chat({
  model: 'claude-opus-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### 方式三：集成到 OpenClaw

在 `~/.openclaw/config.yaml` 中添加：

```yaml
providers:
  clawmarket:
    type: clawmarket
```

## 充值说明

1. 网络: **Base Sepolia** (测试网)
2. 代币: **USDC**
3. 最低充值: **1 USDC**
4. 建议充值: **10+ USDC**

### 获取测试 USDC

测试网 USDC 可以从以下地址免费获取：
- Circle Faucet: https://faucet.circle.com/
- 或联系我们获取测试币

## 工作原理

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   你的      │────▶│   Relay     │────▶│   卖家      │
│  OpenClaw   │◀────│   (中继)    │◀────│  (有算力)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │         ┌─────────────┐              │
       └────────▶│  Base 链    │◀─────────────┘
                 │  (结算)     │
                 └─────────────┘
```

1. **发现**: 从 Registry 获取在线卖家列表
2. **选择**: 按价格/延迟/信誉选择最优卖家
3. **加密**: 用卖家公钥加密你的请求
4. **转发**: 通过 Relay 发送到卖家
5. **处理**: 卖家调用 AI API 处理请求
6. **返回**: 加密响应返回给你
7. **结算**: 链上票据结算

## 服务地址

| 服务 | 地址 |
|------|------|
| Registry | http://192.210.193.110:9080 |
| Relay | http://192.210.193.110:9081 |
| 合约 (Base Sepolia) | 0x1577e78D8a446edF10244A80bEf990751e80E495 |
| USDC (Base Sepolia) | 0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D |

## 钱包位置

钱包私钥保存在: `~/.clawmarket/wallet.json`

⚠️ 请妥善保管此文件，丢失将无法恢复资金！

## License

MIT
