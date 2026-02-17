/**
 * OpenClaw Provider 适配器
 *
 * 让 OpenClaw 可以直接使用 ClawMarket 作为 AI provider
 */
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}
interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: Message;
        finish_reason: 'stop' | 'length';
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
/**
 * OpenClaw Provider 接口实现
 */
export declare class ClawMarketOpenClawProvider {
    private provider;
    private initialized;
    constructor(config?: any);
    /**
     * 初始化 provider
     */
    initialize(): Promise<{
        ready: boolean;
        address?: string;
        balance?: string;
    }>;
    /**
     * 获取可用模型列表
     */
    listModels(): Promise<string[]>;
    /**
     * OpenAI 兼容的 chat completion 接口
     */
    createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    /**
     * 获取状态
     */
    getStatus(): {
        address: string;
        ready: boolean;
        sellers: number;
        channels: number;
    };
    /**
     * 等待余额充足
     */
    waitForBalance(): Promise<void>;
}
/**
 * OpenClaw 插件入口点
 *
 * OpenClaw 会调用这个函数来创建 provider
 */
export declare function createProvider(config?: any): ClawMarketOpenClawProvider;
/**
 * 插件元数据
 */
export declare const metadata: {
    name: string;
    version: string;
    description: string;
    author: string;
    models: string[];
    configSchema: {
        type: string;
        properties: {
            registryUrl: {
                type: string;
                default: string;
            };
            relayUrl: {
                type: string;
                default: string;
            };
            strategy: {
                type: string;
                enum: string[];
                default: string;
            };
        };
    };
};
export {};
//# sourceMappingURL=openclaw-adapter.d.ts.map