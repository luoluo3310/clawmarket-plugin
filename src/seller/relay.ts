import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { RelayMessage, RelayRequest, RelayResponse } from '../types/protocol.js';

export interface RelayConnectionEvents {
  connected: () => void;
  disconnected: (code: number, reason: string) => void;
  request: (request: RelayRequest) => void;
  error: (error: Error) => void;
}

/**
 * WebSocket connection to Relay for sellers
 */
export class RelayConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private sellerId: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private isClosing = false;

  constructor(url: string, sellerId: string, token: string) {
    super();
    this.url = url;
    this.sellerId = sellerId;
    this.token = token;
  }

  /**
   * Connect to the Relay
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isClosing = false;
    const wsUrl = `${this.url}/relay?seller_id=${this.sellerId}&token=${this.token}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.emit('connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as RelayMessage;
        this.handleMessage(message);
      } catch (err) {
        this.emit('error', new Error(`Failed to parse message: ${err}`));
      }
    });

    this.ws.on('close', (code, reason) => {
      this.stopPingInterval();
      this.emit('disconnected', code, reason.toString());
      
      if (!this.isClosing && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: RelayMessage): void {
    switch (message.type) {
      case 'request':
        this.emit('request', message as RelayRequest);
        break;
      case 'ping':
        this.sendPong(message.requestId);
        break;
      default:
        // Ignore other message types
        break;
    }
  }

  /**
   * Send response back through Relay
   */
  sendResponse(requestId: string, payload: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Relay');
    }

    const response: RelayResponse = {
      type: 'response',
      requestId,
      payload,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(response));
  }

  /**
   * Send error response
   */
  sendError(requestId: string, error: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const response: RelayMessage = {
      type: 'error',
      requestId,
      error,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(response));
  }

  /**
   * Send pong response
   */
  private sendPong(requestId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const pong: RelayMessage = {
      type: 'pong',
      requestId,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(pong));
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const ping: RelayMessage = {
          type: 'ping',
          requestId: `ping-${Date.now()}`,
          timestamp: Date.now(),
        };
        this.ws.send(JSON.stringify(ping));
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (!this.isClosing) {
        this.connect();
      }
    }, Math.min(delay, 30000));
  }

  /**
   * Disconnect from Relay
   */
  disconnect(): void {
    this.isClosing = true;
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client closing');
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
