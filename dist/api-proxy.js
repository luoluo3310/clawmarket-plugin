/**
 * ClawMarket API 代理服务
 *
 * 提供 OpenAI 兼容的 API，让 OpenClaw 可以直接使用
 *
 * 用法：
 * - baseUrl: http://shenjige.xyz:9081/v1
 * - apiKey: 用户的 ClawMarket 钱包私钥
 */
import http from 'http';
import { ClawMarketProvider } from './provider.js';
const PORT = 9082;
const providers = new Map();
async function getProvider(apiKey) {
    if (!providers.has(apiKey)) {
        const provider = new ClawMarketProvider();
        // TODO: 用 apiKey 作为私钥初始化钱包
        await provider.initialize();
        providers.set(apiKey, provider);
    }
    return providers.get(apiKey);
}
const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    // GET /v1/models
    if (req.method === 'GET' && url.pathname === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            object: 'list',
            data: [
                { id: 'claude-opus-4', object: 'model', created: Date.now(), owned_by: 'clawmarket' },
                { id: 'claude-sonnet-4', object: 'model', created: Date.now(), owned_by: 'clawmarket' }
            ]
        }));
        return;
    }
    // POST /v1/chat/completions
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const apiKey = (req.headers.authorization || '').replace('Bearer ', '');
                const request = JSON.parse(body);
                console.log(`[API] ${request.model} - ${request.messages.length} messages`);
                const provider = await getProvider(apiKey);
                const response = await provider.chat({
                    model: request.model,
                    messages: request.messages
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: `clawmarket-${Date.now()}`,
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: request.model,
                    choices: [{
                            index: 0,
                            message: { role: 'assistant', content: response },
                            finish_reason: 'stop'
                        }],
                    usage: {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0
                    }
                }));
            }
            catch (err) {
                console.error('[API] Error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message } }));
            }
        });
        return;
    }
    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Not found' } }));
});
server.listen(PORT, '0.0.0.0', () => {
    console.log(`ClawMarket API 代理运行在 http://0.0.0.0:${PORT}`);
    console.log('');
    console.log('OpenClaw 配置:');
    console.log('  baseUrl: http://shenjige.xyz:9081/v1');
    console.log('  api: openai-completions');
    console.log('');
});
//# sourceMappingURL=api-proxy.js.map