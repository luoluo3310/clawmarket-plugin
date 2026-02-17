import { EventEmitter } from 'events';
import type { RelayRequest } from '../types/protocol.js';
export interface RelayConnectionEvents {
    connected: () => void;
    disconnected: (code: number, reason: string) => void;
    request: (request: RelayRequest) => void;
    error: (error: Error) => void;
}
/**
 * WebSocket connection to Relay for sellers
 */
export declare class RelayConnection extends EventEmitter {
    private ws;
    private url;
    private sellerId;
    private token;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private pingInterval;
    private isClosing;
    constructor(url: string, sellerId: string, token: string);
    /**
     * Connect to the Relay
     */
    connect(): void;
    /**
     * Handle incoming messages
     */
    private handleMessage;
    /**
     * Send response back through Relay
     */
    sendResponse(requestId: string, payload: string): void;
    /**
     * Send error response
     */
    sendError(requestId: string, error: string): void;
    /**
     * Send pong response
     */
    private sendPong;
    /**
     * Start ping interval to keep connection alive
     */
    private startPingInterval;
    /**
     * Stop ping interval
     */
    private stopPingInterval;
    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect;
    /**
     * Disconnect from Relay
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    get isConnected(): boolean;
}
//# sourceMappingURL=relay.d.ts.map