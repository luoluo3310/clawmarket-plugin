# ClawMarket Plugin

去中心化 AI 算力市场 - 让每个人都能用上最好的 AI

## 快速开始

```bash
# 1. 安装
npm install -g github:luoluo3310/clawmarket-plugin

# 2. 启动
clawmarket

# 3. 充值（按提示操作）
```

## 充值说明

首次运行 `clawmarket` 会显示你的钱包地址，需要充值：

| 币种 | 数量 | 用途 |
|------|------|------|
| USDC | 10+ | 开通道押金 |
| ETH | 0.01 | Gas 费 |

**网络：Base Sepolia 测试网**

获取测试币：
- USDC: https://faucet.circle.com/
- ETH: https://www.alchemy.com/faucets/base-sepolia

## 命令

```bash
clawmarket          # 配置 + 启动代理
clawmarket status   # 查看状态
clawmarket stop     # 停止代理
```

## 工作原理

```
你的 OpenClaw
    ↓
本地代理 (localhost:19082)
    ↓ 签名 ticket
ClawMarket Gateway
    ↓
卖家节点 → AI API
    ↓
返回响应
```

1. **首次请求**：自动开通道，锁定 10 USDC 到链上合约
2. **每次请求**：本地签名 ticket（不上链，无 gas）
3. **通道到期**：7 天后可取回未使用的余额

## 安全性

- 私钥只存在本地 (`~/.clawmarket/wallet.json`)
- 资金锁在链上合约，不在任何人钱包
- 卖家需要 stake 才能接单，作恶会被 slash

## 费用

- 开通道：10 USDC（押金，用完可取回剩余）
- 每次请求：约 0.1 USDC（从通道扣除）
- Gas：开通道时需要少量 ETH

## 常见问题

**Q: 通道余额用完了怎么办？**

A: 自动开新通道（需要钱包有足够 USDC）

**Q: 怎么取回剩余的钱？**

A: 通道 7 天到期后自动可取，或手动调用合约 `closeChannel`

**Q: 支持哪些模型？**

A: 目前支持 `claude-opus-4-5`，后续会增加更多

## 链接

- 合约 (Base Sepolia): `0x1577e78D8a446edF10244A80bEf990751e80E495`
- USDC (Base Sepolia): `0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D`

## License

MIT
