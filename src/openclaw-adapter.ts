/**
 * OpenClaw Provider 适配器
 * 
 * 让 OpenClaw 可以直接使用 ClawMarket 作为 AI provider
 */

import { ClawMarketProvider } from './provider.js';

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
export class ClawMarketOpenClawProvider {
  private provider: ClawMarketProvider;
  private initialized = false;

  constructor(config?: any) {
    this.provider = new ClawMarketProvider(config);
  }

  /**
   * 初始化 provider
   */
  async initialize(): Promise<{ ready: boolean; address?: string; balance?: string }> {
    const status = await this.provider.initialize();
    this.initialized = status.ready;
    return status;
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    await this.provider.refreshSellers();
    const status = this.provider.getStatus();
    
    // 从卖家列表收集所有可用模型
    const models = new Set<string>();
    // 这里简化处理，实际应该从 sellers 获取
    models.add('claude-opus-4');
    models.add('claude-sonnet-4');
    models.add('gpt-4');
    
    return Array.from(models);
  }

  /**
   * OpenAI 兼容的 chat completion 接口
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.initialized) {
      const status = await this.initialize();
      if (!status.ready) {
        throw new Error(`ClawMarket 未就绪，请先充值 USDC 到: ${status.address}`);
      }
    }

    const response = await this.provider.chat({
      model: request.model,
      messages: request.messages
    });

    // 估算 token 数
    const promptTokens = request.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const completionTokens = Math.ceil(response.length / 4);

    return {
      id: `clawmarket-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }

  /**
   * 获取状态
   */
  getStatus() {
    return this.provider.getStatus();
  }

  /**
   * 等待余额充足
   */
  async waitForBalance() {
    return this.provider.waitForBalance();
  }
}

/**
 * OpenClaw 插件入口点
 * 
 * OpenClaw 会调用这个函数来创建 provider
 */
export function createProvider(config?: any) {
  return new ClawMarketOpenClawProvider(config);
}

/**
 * 插件元数据
 */
export const metadata = {
  name: 'clawmarket',
  version: '0.1.0',
  description: 'ClawMarket - 去中心化 AI 算力市场',
  author: 'ClawMarket Team',
  
  // 支持的模型
  models: [
    'claude-opus-4',
    'claude-sonnet-4',
    'gpt-4',
    'gpt-4-turbo'
  ],
  
  // 配置 schema
  configSchema: {
    type: 'object',
    properties: {
      registryUrl: { type: 'string', default: 'http://192.210.193.110:9080' },
      relayUrl: { type: 'string', default: 'http://192.210.193.110:9081' },
      strategy: { 
        type: 'string', 
        enum: ['lowest_price', 'lowest_latency', 'highest_reputation'],
        default: 'lowest_price'
      }
    }
  }
};
