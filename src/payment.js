/**
 * Payment manager for x402 payments
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { buildExactPaymentTx } from './utils/payment.js';
import { httpPost, httpGet } from './utils/http.js';

export class PaymentManager {
  constructor({ baseUrl, solanaRpc, wallet, solUsdcMint, facilitatorUrl }) {
    this.baseUrl = baseUrl || 'https://bridge402.tech';
    this.solanaRpc = solanaRpc || 'https://api.mainnet-beta.solana.com';
    this.wallet = wallet;
    this.solUsdcMint = solUsdcMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    this.facilitatorUrl = facilitatorUrl || 'https://facilitator.payai.network';
    this.connection = new Connection(this.solanaRpc, 'confirmed');
  }

  /**
   * Fetch fee payer from facilitator
   */
  async fetchSupportedFeePayer() {
    try {
      console.log(`🔍 Fetching feePayer from facilitator: ${this.facilitatorUrl}/supported`);
      const { status, json } = await httpGet(`${this.facilitatorUrl}/supported`);
      if (status !== 200 || typeof json !== 'object') {
        console.error(`❌ Facilitator /supported returned ${status}:`, json);
        return null;
      }
      const sol = (json.kinds || []).find(k => k.network === 'solana');
      const feePayer = sol?.extra?.feePayer;
      if (feePayer) {
        console.log(`✅ Found feePayer: ${feePayer}`);
      } else {
        console.error('❌ feePayer not found in facilitator response:', JSON.stringify(json, null, 2));
      }
      return feePayer || null;
    } catch (err) {
      console.error('❌ Error fetching feePayer:', err.message);
      return null;
    }
  }

  /**
   * Get invoice for session
   */
  async getInvoice(minutes = 5) {
    const { status, json } = await httpPost(`${this.baseUrl}/connect?duration_min=${minutes}&network=sol`);
    if (status !== 402) {
      throw new Error(`Expected 402 invoice, got ${status}: ${JSON.stringify(json)}`);
    }
    return (json.accepts && json.accepts[0]) || json;
  }

  /**
   * Pay invoice and create session
   */
  async payInvoice(accepts) {
    const feePayerStr = accepts?.extra?.feePayer || process.env.SOL_FEE_PAYER || await this.fetchSupportedFeePayer();
    if (!feePayerStr) {
      throw new Error('Missing facilitator feePayer for Solana');
    }
    const feePayer = new PublicKey(feePayerStr);

    const mint = new PublicKey(accepts.asset || this.solUsdcMint);
    const payTo = new PublicKey(accepts.payTo);
    const amount = BigInt(accepts.maxAmountRequired);

    // Build transaction
    const tx = await buildExactPaymentTx({
      connection: this.connection,
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

    const { status, json } = await httpPost(
      `${this.baseUrl}/connect?duration_min=${accepts.extra?.minutes || 5}&network=sol`,
      { headers: { 'X-PAYMENT': XPAYMENT } }
    );

    if (status !== 200) {
      const errorMsg = typeof json === 'string' ? json : JSON.stringify(json);
      throw new Error(`Payment failed (${status}): ${errorMsg}`);
    }
    return json;
  }

  /**
   * Get extend invoice
   */
  async getExtendInvoice(minutes, token) {
    const { status, json } = await httpPost(`${this.baseUrl}/extend?duration_min=${minutes}&network=sol`, {
      headers: { 'X-SESSION': token }
    });
    if (status !== 402) {
      throw new Error(`Expected 402 for extend invoice, got ${status}: ${JSON.stringify(json)}`);
    }
    return (json.accepts && json.accepts[0]) || json;
  }

  /**
   * Extend session
   */
  async extendSession(accepts, token) {
    let feePayerStr = accepts?.extra?.feePayer || process.env.SOL_FEE_PAYER;
    
    if (!feePayerStr) {
      console.log('⚠️  feePayer not in invoice, fetching from facilitator...');
      feePayerStr = await this.fetchSupportedFeePayer();
    }
    
    if (!feePayerStr) {
      throw new Error('Missing facilitator feePayer for Solana. Set SOL_FEE_PAYER env var or ensure facilitator /supported endpoint returns feePayer.');
    }
    
    const feePayer = new PublicKey(feePayerStr);
    const mint = new PublicKey(accepts.asset || this.solUsdcMint);
    const payTo = new PublicKey(accepts.payTo);
    const amount = BigInt(accepts.maxAmountRequired);

    const tx = await buildExactPaymentTx({
      connection: this.connection,
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

    const { status, json } = await httpPost(
      `${this.baseUrl}/extend?duration_min=${accepts.extra?.minutes || 5}&network=sol`,
      { headers: { 'X-SESSION': token, 'X-PAYMENT': XPAYMENT } }
    );

    if (status !== 200) {
      const errorMsg = typeof json === 'string' ? json : JSON.stringify(json);
      throw new Error(`Extend failed (${status}): ${errorMsg}`);
    }
    return json;
  }
}

