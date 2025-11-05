/**
 * Bridge402 Diffbot Client - Extract structured content from web pages
 */

import { PaymentManager } from './payment.js';
import { httpPost } from './utils/http.js';
import { PublicKey } from '@solana/web3.js';
import { buildExactPaymentTx } from './utils/payment.js';

export class DiffbotClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://bridge402.tech';
    this.solanaRpc = options.solanaRpc || 'https://api.mainnet-beta.solana.com';
    this.wallet = options.wallet;
    this.network = options.network || 'sol'; // 'sol' or 'base'
    this.retryAttempts = options.retryAttempts || 3;
    
    // Internal state
    this.paymentManager = null;
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
   * Extract article content from URL
   * @param {string} url - URL of the article to extract
   * @returns {Promise<Object>} Extraction result with article data
   */
  async extractArticle(url) {
    return this._extract('article', url);
  }

  /**
   * Extract product information from URL
   * @param {string} url - URL of the product page to extract
   * @returns {Promise<Object>} Extraction result with product data
   */
  async extractProduct(url) {
    return this._extract('product', url);
  }

  /**
   * Extract discussion/forum content from URL
   * @param {string} url - URL of the discussion page to extract
   * @returns {Promise<Object>} Extraction result with discussion data
   */
  async extractDiscussion(url) {
    return this._extract('discussion', url);
  }

  /**
   * Extract images from URL
   * @param {string} url - URL of the page to extract images from
   * @returns {Promise<Object>} Extraction result with image data
   */
  async extractImage(url) {
    return this._extract('image', url);
  }

  /**
   * Internal method to handle extraction
   * @private
   */
  async _extract(extractionType, url) {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      throw new Error('Invalid URL. Must start with http:// or https://');
    }

    if (!this.wallet) {
      throw new Error('Wallet is required. Provide wallet in constructor options.');
    }

    if (!['article', 'product', 'discussion', 'image'].includes(extractionType)) {
      throw new Error(`Invalid extraction type: ${extractionType}. Must be 'article', 'product', 'discussion', or 'image'`);
    }

    try {
      // Get invoice
      console.log(`📋 Getting invoice for ${extractionType} extraction...`);
      const invoice = await this._getInvoice(extractionType, url);
      
      const amountUsdc = (BigInt(invoice.maxAmountRequired) / BigInt(1_000_000)).toString();
      console.log(`💰 Invoice: ${amountUsdc} USDC`);
      
      // Pay invoice
      console.log(`💸 Paying invoice...`);
      const payment = await this._payInvoice(extractionType, url, invoice);
      
      // Get extraction
      console.log(`🔍 Extracting ${extractionType} from URL...`);
      const result = await this._getExtraction(extractionType, url, payment);
      
      console.log(`✅ Extraction complete!`);
      this.emit('extraction', { type: extractionType, url, result });
      
      return result;
    } catch (error) {
      console.error(`❌ ${extractionType} extraction failed:`, error.message || error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get payment invoice for extraction
   * @private
   */
  async _getInvoice(extractionType, url) {
    const endpoint = `${this.baseUrl}/diffbot/${extractionType}`;
    const urlParam = encodeURIComponent(url);
    const { status, json } = await httpPost(`${endpoint}?url=${urlParam}&network=${this.network}`);
    
    if (status !== 402) {
      throw new Error(`Expected 402 invoice, got ${status}: ${JSON.stringify(json)}`);
    }
    
    const accepts = (json.accepts && json.accepts[0]) || json;
    return accepts;
  }

  /**
   * Pay invoice for extraction
   * @private
   */
  async _payInvoice(extractionType, url, invoice) {
    const feePayerStr = invoice?.extra?.feePayer || process.env.SOL_FEE_PAYER || await this.paymentManager.fetchSupportedFeePayer();
    if (!feePayerStr) {
      throw new Error('Missing facilitator feePayer for Solana');
    }
    
    const feePayer = new PublicKey(feePayerStr);
    const mint = new PublicKey(invoice.asset || this.paymentManager.solUsdcMint);
    const payTo = new PublicKey(invoice.payTo);
    const amount = BigInt(invoice.maxAmountRequired);

    // Build transaction
    const tx = await buildExactPaymentTx({
      connection: this.paymentManager.connection,
      payerPublicKey: this.wallet.publicKey,
      feePayerPublicKey: feePayer,
      recipientPublicKey: payTo,
      mintPublicKey: mint,
      amountAtomic: amount,
      createRecipientATAIfMissing: true,
    });

    tx.sign([this.wallet]);
    const b64 = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64');

    const x402 = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana',
      payload: { transaction: b64 }
    };
    const XPAYMENT = Buffer.from(JSON.stringify(x402)).toString('base64');

    return XPAYMENT;
  }

  /**
   * Get extraction result after payment
   * @private
   */
  async _getExtraction(extractionType, url, paymentHeader) {
    const endpoint = `${this.baseUrl}/diffbot/${extractionType}`;
    const urlParam = encodeURIComponent(url);
    const { status, json } = await httpPost(`${endpoint}?url=${urlParam}&network=${this.network}`, {
      headers: { 'X-PAYMENT': paymentHeader }
    });

    if (status !== 200) {
      const errorMsg = typeof json === 'string' ? json : JSON.stringify(json);
      throw new Error(`Extraction failed (${status}): ${errorMsg}`);
    }

    return json;
  }

  /**
   * Batch extract multiple URLs
   * @param {string} extractionType - 'article', 'product', or 'discussion'
   * @param {string[]} urls - Array of URLs to extract
   * @returns {Promise<Array>} Array of extraction results
   */
  async batchExtract(extractionType, urls) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls must be a non-empty array');
    }

    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n[${i + 1}/${urls.length}] Processing: ${url}`);
      
      try {
        let result;
        switch (extractionType) {
          case 'article':
            result = await this.extractArticle(url);
            break;
          case 'product':
            result = await this.extractProduct(url);
            break;
          case 'discussion':
            result = await this.extractDiscussion(url);
            break;
          case 'image':
            result = await this.extractImage(url);
            break;
          default:
            throw new Error(`Invalid extraction type: ${extractionType}`);
        }
        results.push({ url, success: true, data: result });
      } catch (error) {
        console.error(`❌ Failed to extract ${url}:`, error.message);
        results.push({ url, success: false, error: error.message });
      }
    }

    return results;
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
}

