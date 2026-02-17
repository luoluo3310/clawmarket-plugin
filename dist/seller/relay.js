import WebSocket from 'ws';
import { EventEmitter } from 'events';
/**
 * WebSocket connection to Relay for sellers
 */
export class RelayConnection extends EventEmitter {
    ws = null;
    url;
    sellerId;
    token;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    reconnectDelay = 1000;
    pingInterval = null;
    isClosing = false;
    constructor(url, sellerId, token) {
        super();
        this.url = url;
        this.sellerId = sellerId;
        this.token = token;
    }
    /**
     * Connect to the Relay
     */
    connect() {
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
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            }
            catch (err) {
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
    handleMessage(message) {
        switch (message.type) {
            case 'request':
                this.emit('request', message);
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
    sendResponse(requestId, payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to Relay');
        }
        const response = {
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
    sendError(requestId, error) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const response = {
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
    sendPong(requestId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const pong = {
            type: 'pong',
            requestId,
            timestamp: Date.now(),
        };
        this.ws.send(JSON.stringify(pong));
    }
    /**
     * Start ping interval to keep connection alive
     */
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                const ping = {
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
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
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
    disconnect() {
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
    get isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
//# sourceMappingURL=relay.js.map