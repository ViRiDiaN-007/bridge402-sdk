/**
 * WebSocket connection manager
 */

import WebSocket from 'ws';

export class WebSocketManager {
  constructor({ baseUrl, accessToken, onMessage, onError, onClose }) {
    this.baseUrl = baseUrl || 'https://bridge402.tech';
    this.accessToken = accessToken;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect to WebSocket stream
   */
  connect() {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + `/stream?token=${encodeURIComponent(this.accessToken)}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      const text = data.toString();
      try {
        const msg = JSON.parse(text);
        if (this.onMessage) {
          this.onMessage(msg);
        }
        this.emit('message', msg);
      } catch (e) {
        // Handle non-JSON messages
        if (text.includes('Session expired') || text.includes('Renew')) {
          this.emit('sessionExpired');
        } else {
          this.emit('rawMessage', text);
        }
      }
    });

    this.ws.on('error', (err) => {
      console.error('⚠️  WebSocket error:', err.message || err);
      if (this.onError) {
        this.onError(err);
      }
      this.emit('error', err);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`WebSocket closed (code: ${code})`);
      if (this.onClose) {
        this.onClose(code, reason);
      }
      this.emit('close', code, reason);
    });

    return this.ws;
  }

  /**
   * Update access token (for session renewal)
   */
  updateToken(newToken) {
    this.accessToken = newToken;
    // If connected, need to reconnect with new token
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.disconnect();
      this.connect();
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Emit event (simple event emitter pattern)
   */
  emit(event, ...args) {
    // Events are handled via callbacks for simplicity
    // Could be extended to use EventEmitter if needed
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}



