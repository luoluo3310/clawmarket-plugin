# ClawMarket Plugin

去中心化 AI 算力市场 — 买 AI 便宜用，卖闲置额度赚钱。

## 快速开始

### 买家（用 AI）

```bash
# 1. 安装
npm install -g github:luoluo3310/clawmarket-plugin

# 2. 启动
clawmarket

# 3. 充值（按提示操作）
```

首次运行会显示你的钱包地址，充值后即可使用。

### 卖家（卖闲置额度）

```bash
# 1. 安装（同上）
npm install -g github:luoluo3310/clawmarket-plugin

# 2. 启动卖家模式
clawmarket sell
```

启动后按提示操作：
1. 选择模型来源（Claude Pro/Max、OpenAI Plus、API Key 等）
2. 输入你的 API Key 或 API 地址
3. 设置每日出售上限
4. 自动注册、连接、开始接单

## 命令

```bash
# 买家
clawmarket              # 配置 OpenClaw + 启动买家代理
clawmarket status       # 查看状态（余额、代理、通道）
clawmarket stop         # 停止代理

# 卖家
clawmarket sell         # 启动卖家模式
clawmarket sell status  # 查看卖家状态（今日收入、接单数等）
clawmarket sell stop    # 停止卖家
clawmarket sell price   # 查看/修改价格
```

## 定价

当前市场价格（系统自动调整）：

| 模型 | 输入 / 1M tokens | 输出 / 1M tokens |
|------|-----------------|-----------------|
| claude-opus-4-5 | $1.00 | $5.00 |

对比官方 API 价格（$15 / $75），ClawMarket 便宜 **93%**。

### 卖家调价

卖家可以通过重新注册来更新价格：

```bash
# 方法 1：重新运行 sell 命令，选择新价格
clawmarket sell

# 方法 2：直接修改配置
clawmarket sell price --input 1.5 --output 7
```

系统会根据市场供需动态调整推荐价格，卖家也可以手动设置。

## 充值说明

| 币种 | 数量 | 用途 |
|------|------|------|
| USDC | 10+ | 开通道押金 |
| ETH | 0.01 | Gas 费 |

**网络：Base Sepolia 测试网**

获取测试币：
- USDC: https://faucet.circle.com/
- ETH: https://www.alchemy.com/faucets/base-sepolia

## 工作原理

```
买家的 OpenClaw
    ↓
本地代理 (localhost:19082)
    ↓ 签名 ticket（不上链，无 gas）
ClawMarket Gateway
    ↓ 智能匹配最优卖家
卖家节点 → AI API
    ↓
返回响应
```

### 买家
1. 首次请求：自动开通道，锁定 10 USDC 到链上合约
2. 每次请求：本地签名 ticket（不上链，无 gas）
3. 通道到期：7 天后可取回未使用的余额

### 卖家
1. 注册后自动连接 Relay 等待买家请求
2. 收到请求 → 调用自己的 AI API → 返回结果
3. 系统记录 ticket，定期结算到卖家钱包
4. 到达每日上限或 API 限速时自动下线保护

## 卖家保护机制

- **每日上限**：到达设定的每日出售额度后自动停止接单
- **限速检测**：后端 API 返回 429 或超时时立即下线
- **自动恢复**：第二天零点自动重置，重新上线
- **零配置**：不需要手动管理，系统自动保护

## 安全性

- 私钥只存在本地 (`~/.clawmarket/wallet.json`)
- 资金锁在链上合约，不在任何人钱包
- 端到端加密通信（E2EE）
- 卖家需要 stake 才能接单，作恶会被 slash

## Dashboard

市场实时数据：http://192.210.193.110:9082/

查看在线卖家、可用模型、价格、交易量等。

## 链接

- 合约 (Base Sepolia): `0x1577e78D8a446edF10244A80bEf990751e80E495`
- USDC (Base Sepolia): `0xcF0819eb156D6c6c1c5d9A515E351D2D1aefff7D`
- GitHub: https://github.com/luoluo3310/clawmarket-plugin

## License

MIT
