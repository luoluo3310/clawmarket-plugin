# ClawMarket Plugin for OpenClaw

去中心化 AI 算力市场插件 - 让每个人都能用上最好的 AI

## 快速开始

```bash
# 1. 安装插件
npm install -g github:luoluo3310/clawmarket-plugin

# 2. 运行
clawmarket
```

首次运行会自动：
1. 生成钱包
2. 显示充值地址
3. 等待充值 USDC (Base Sepolia)
4. 充值后自动激活

## 与 OpenClaw 集成

在 `~/.openclaw/config.yaml` 中添加：

```yaml
providers:
  clawmarket:
    type: clawmarket
    # 可选配置
    strategy: lowest_price  # lowest_price | lowest_latency | highest_reputation
```

然后正常使用 OpenClaw，它会自动通过 ClawMarket 购买算力。

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

1. **发现** - 从 Registry 获取在线卖家
2. **选择** - 按价格/延迟/信誉选最优
3. **加密** - E2EE 端到端加密
4. **转发** - 通过 Relay 发送
5. **处理** - 卖家调用 AI API
6. **结算** - 链上票据结算

## 特点

- 🚀 **一键安装** - 无需复杂配置
- 💰 **自动钱包** - 首次运行自动生成
- 🔒 **端到端加密** - 你的 prompt 只有你和卖家能看到
- ⛓️ **链上结算** - 基于 Base 链，安全透明
- 🤖 **全自动** - 自动发现、开通道、签票据

## 充值说明

- **网络**: Base Sepolia (测试网)
- **代币**: USDC
- **最低**: 1 USDC
- **建议**: 10+ USDC

测试 USDC 获取: https://faucet.circle.com/

## 钱包位置

`~/.clawmarket/wallet.json`

⚠️ 请妥善保管，丢失无法恢复！

## 服务地址

| 服务 | 地址 |
|------|------|
| Registry | http://192.210.193.110:9080 |
| Relay | http://192.210.193.110:9081 |
| 合约 | 0x1577e78D8a446edF10244A80bEf990751e80E495 |

## API 使用

```typescript
import { createProvider } from 'clawmarket-plugin';

const provider = createProvider();
await provider.initialize();

const response = await provider.createChatCompletion({
  model: 'claude-opus-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

## License

MIT
