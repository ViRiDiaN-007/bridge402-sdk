/**
 * Bridge402 Client - Main SDK class
 */

import { PaymentManager } from './payment.js';
import { WebSocketManager } from './websocket.js';
import { httpPost } from './utils/http.js';

export class Bridge402Client {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://bridge402.tech';
    this.solanaRpc = options.solanaRpc || 'https://api.mainnet-beta.solana.com';
    this.wallet = options.wallet;
    this.autoRenew = options.autoRenew !== false; // Default true
    this.duration = options.duration || 5; // minutes
    this.retryAttempts = options.retryAttempts || 3;
    
    // Webhook configuration
    this.webhook = options.webhook;
    this.formatter = options.formatter;
    
    // Internal state
    this.paymentManager = null;
    this.wsManager = null;
    this.currentToken = null;
    this.isRunning = false;
    this.eventHandlers = {};
    
    // Initialize payment manager
    if (this.wallet) {
      this.paymentManager = new PaymentManager({
        baseUrl: this.baseUrl,
        solanaRpc: this.solanaRpc,
        wallet: this.wallet,
        solUsdcMint: options.solUsdcMint,
        facilitatorUrl: options.facilitatorUrl
      });
    }
  }

  /**
   * Start the client
   */
  async start() {
    if (this.isRunning) {
      console.warn('⚠️  Client is already running');
      return;
    }

    if (!this.wallet) {
      throw new Error('Wallet is required. Provide wallet in constructor options.');
    }

    try {
      // Get invoice and pay
      console.log('📋 Getting invoice...');
      const invoice = await this.paymentManager.getInvoice(this.duration);
      console.log('💰 Paying invoice...');
      const session = await this.paymentManager.payInvoice(invoice);
      
      this.currentToken = session.access_token;
      console.log(`✅ Session created. Expires at: ${session.expires_at}`);
      
      // Connect WebSocket
      this.wsManager = new WebSocketManager({
        baseUrl: this.baseUrl,
        accessToken: this.currentToken,
        onMessage: (msg) => this.handleMessage(msg),
        onError: (err) => this.handleError(err),
        onClose: (code, reason) => this.handleClose(code, reason)
      });
      
      this.wsManager.connect();
      this.isRunning = true;
      
      this.emit('started', { expiresAt: session.expires_at });
    } catch (error) {
      console.error('❌ Failed to start:', error.message || error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(msg) {
    // Handle system messages
    if (msg.type === 'expiry_soon') {
      console.log(`⏳ Session expiring soon (${msg.seconds_remaining}s). Extending...`);
      if (this.autoRenew) {
        await this.extendSessionWithRetry();
      } else {
        this.emit('sessionExpiring', { secondsRemaining: msg.seconds_remaining });
      }
      return;
    }

    if (msg.type === 'session_extended') {
      console.log('ℹ️  Session extended (server acknowledgment)');
      this.emit('sessionExtended', msg);
      return;
    }

    if (msg.status === 'connected') {
      console.log('ℹ️  Stream connected');
      this.emit('connected');
      return;
    }

    // News message - forward to webhook if configured
    if (this.webhook && this.webhook.url) {
      try {
        await this.forwardToWebhook(msg);
      } catch (error) {
        console.error('⚠️  Failed to forward message:', error.message);
        this.emit('webhookError', { message: msg, error });
      }
    }

    // Emit message event
    this.emit('message', msg);
  }

  /**
   * Forward message to webhook
   */
  async forwardToWebhook(message) {
    let payload;
    
    if (this.formatter) {
      payload = this.formatter.format(message);
    } else {
      // Default: send as JSON
      payload = { content: JSON.stringify(message, null, 2) };
    }

    const { status, json } = await httpPost(this.webhook.url, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (status >= 200 && status < 300) {
      const msgType = 'body' in message ? '🐦 Twitter' : 'source' in message ? '📰 Article' : '📨 News';
      const title = message.title || 'News';
      console.log(`📤 Forwarded to webhook (${msgType}): ${title.substring(0, 50)}...`);
      this.emit('webhookSuccess', { message, status });
    } else {
      throw new Error(`Webhook returned ${status}: ${JSON.stringify(json)}`);
    }
  }

  /**
   * Extend session with retry logic
   */
  async extendSessionWithRetry() {
    let retryDelay = 1000;
    let extended = false;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const extInvoice = await this.paymentManager.getExtendInvoice(this.duration, this.currentToken);
        const extPaid = await this.paymentManager.extendSession(extInvoice, this.currentToken);
        this.currentToken = extPaid.access_token;
        
        // Update WebSocket token if needed (reconnect with new token)
        if (this.wsManager) {
          this.wsManager.updateToken(this.currentToken);
        }
        
        console.log(`🔁 Session extended. New expiry: ${extPaid.expires_at}`);
        extended = true;
        this.emit('sessionRenewed', { expiresAt: extPaid.expires_at });
        break;
      } catch (error) {
        const isLastAttempt = attempt === this.retryAttempts;
        const isFacilitatorError = error.message?.includes('Facilitator') || 
                                   error.message?.includes('521') || 
                                   error.message?.includes('verify failed');
        
        if (isLastAttempt) {
          console.error(`⚠️  Extend failed after ${this.retryAttempts} attempts:`, error.message);
          this.emit('sessionRenewalFailed', { error });
        } else {
          console.warn(`⚠️  Extend attempt ${attempt}/${this.retryAttempts} failed:`, error.message);
          if (isFacilitatorError) {
            console.warn(`   Facilitator issue detected. Retrying in ${retryDelay / 1000}s...`);
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2;
        }
      }
    }

    if (!extended) {
      console.error('   All retry attempts exhausted. Session extension failed.');
    }
  }

  /**
   * Handle WebSocket errors
   */
  handleError(error) {
    this.emit('error', error);
  }

  /**
   * Handle WebSocket close
   */
  handleClose(code, reason) {
    this.isRunning = false;
    this.emit('closed', { code, reason });
  }

  /**
   * Stop the client
   */
  stop() {
    if (this.wsManager) {
      this.wsManager.disconnect();
    }
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current session status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isConnected: this.wsManager?.isConnected() || false,
      hasToken: !!this.currentToken
    };
  }
}



