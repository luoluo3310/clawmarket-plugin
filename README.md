# ClawMarket Plugin

去中心化 AI 算力市场 - 让每个人都能用上最好的 AI

## 安装使用 (3 步)

```bash
# 1. 安装
npm install -g github:luoluo3310/clawmarket-plugin

# 2. 运行 (自动配置 OpenClaw)
clawmarket

# 3. 充值 USDC 到显示的地址，然后运行 openclaw
```

就这么简单！

## 它做了什么？

1. **自动生成钱包** - 保存在 `~/.clawmarket/wallet.json`
2. **自动配置 OpenClaw** - 无需手动编辑配置文件
3. **自动发现卖家** - 从市场找最便宜的算力
4. **自动开通道** - 链上支付通道
5. **端到端加密** - 你的 prompt 只有你和卖家能看到

## 充值说明

- **网络**: Base Sepolia (测试网)
- **代币**: USDC
- **最低**: 1 USDC
- **获取测试币**: https://faucet.circle.com/

## 工作原理

```
你的 OpenClaw → ClawMarket Relay → 卖家 (有 API 额度)
                      ↓
              Base 链 (结算)
```

## 服务地址

- Registry: http://192.210.193.110:9080
- Relay: http://192.210.193.110:9081
- 合约: 0x1577e78D8a446edF10244A80bEf990751e80E495

## License

MIT
