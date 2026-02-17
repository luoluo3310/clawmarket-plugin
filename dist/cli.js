#!/usr/bin/env node
/**
 * ClawMarket CLI - 一键配置
 */
import { ClawMarketProvider } from './provider.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
function configureOpenClaw() {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
        // 创建基础配置
        const dir = path.dirname(OPENCLAW_CONFIG_PATH);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const config = {
            meta: { lastTouchedVersion: "2026.2.15" },
            gateway: { mode: "local" },
            models: {
                providers: {},
                routing: {}
            }
        };
        fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
    }
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
    // 确保结构存在
    if (!config.models)
        config.models = {};
    if (!config.models.providers)
        config.models.providers = {};
    if (!config.models.routing)
        config.models.routing = {};
    if (!config.gateway)
        config.gateway = {};
    // 设置 gateway mode
    config.gateway.mode = 'local';
    // 添加 ClawMarket 作为 anthropic 类型的 provider
    config.models.providers.clawmarket = {
        baseUrl: 'http://shenjige.xyz:9081/v1',
        apiKey: 'clawmarket2026',
        api: 'anthropic-messages',
        models: [
            {
                id: 'claude-opus-4-5',
                name: 'Claude Opus 4.5 (ClawMarket)',
                reasoning: false,
                input: ['text', 'image'],
                contextWindow: 200000,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
            }
        ]
    };
    // 设置默认模型
    if (!config.models.routing)
        config.models.routing = {};
    config.models.routing.primary = 'clawmarket/claude-opus-4-5';
    // 备份并保存
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
        fs.copyFileSync(OPENCLAW_CONFIG_PATH, OPENCLAW_CONFIG_PATH + '.bak');
    }
    fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('[ClawMarket] ✅ OpenClaw 配置完成');
    console.log('[ClawMarket] 默认模型: clawmarket/claude-opus-4-5');
}
async function main() {
    console.log('');
    console.log('  ██████╗██╗      █████╗ ██╗    ██╗███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗████████╗');
    console.log(' ██╔════╝██║     ██╔══██╗██║    ██║████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝╚══██╔══╝');
    console.log(' ██║     ██║     ███████║██║ █╗ ██║██╔████╔██║███████║██████╔╝█████╔╝ █████╗     ██║   ');
    console.log(' ██║     ██║     ██╔══██║██║███╗██║██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══╝     ██║   ');
    console.log(' ╚██████╗███████╗██║  ██║╚███╔███╔╝██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████╗   ██║   ');
    console.log('  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ');
    console.log('');
    console.log('  去中心化 AI 算力市场 - 让每个人都能用上最好的 AI');
    console.log('');
    // 配置 OpenClaw
    configureOpenClaw();
    // 初始化钱包
    const provider = new ClawMarketProvider();
    const status = await provider.initialize();
    if (!status.ready) {
        console.log('');
        console.log('下一步：充值 USDC 到上面的地址 (Base Sepolia)');
        console.log('获取测试币: https://faucet.circle.com/');
        console.log('');
        console.log('正在监听充值...');
        await provider.waitForBalance();
    }
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ 配置完成！现在运行 openclaw gateway 即可使用          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
}
main().catch(console.error);
//# sourceMappingURL=cli.js.map