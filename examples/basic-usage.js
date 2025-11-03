/**
 * Example: Basic usage of Bridge402 SDK
 * 
 * This example shows how to use the SDK without webhooks,
 * processing messages in your own code.
 */

import 'dotenv/config';
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import { Bridge402Client } from '../src/client.js';

function loadWallet() {
  const keypairPath = process.env.KEYPAIR_PATH;
  if (!keypairPath) {
    throw new Error('Set KEYPAIR_PATH environment variable');
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

(async () => {
  try {
    const wallet = loadWallet();
    
    // Create client (no webhook - we'll handle messages ourselves)
    const client = new Bridge402Client({
      wallet: wallet,
      duration: 5, // 5 minutes
      autoRenew: true,
      baseUrl: process.env.BASE_URL || 'https://bridge402.tech',
      solanaRpc: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
    });

    // Handle messages
    client.on('message', (msg) => {
      // Determine message type
      const isTwitter = 'body' in msg;
      const isArticle = 'source' in msg;
      
      if (isTwitter) {
        console.log(`🐦 Twitter: ${msg.title}`);
        console.log(`   Coin: ${msg.coin || 'N/A'}`);
        console.log(`   Body: ${msg.body?.substring(0, 100)}...`);
      } else if (isArticle) {
        console.log(`📰 Article: ${msg.title}`);
        console.log(`   Source: ${msg.source || 'N/A'}`);
        console.log(`   Symbols: ${msg.symbols?.join(', ') || 'N/A'}`);
      } else {
        console.log('📨 News:', JSON.stringify(msg, null, 2));
      }
      console.log('---');
    });

    client.on('sessionRenewed', (data) => {
      console.log(`✅ Session renewed until ${data.expiresAt}`);
    });

    client.on('error', (error) => {
      console.error('Error:', error.message || error);
    });

    // Start
    console.log('🚀 Starting Bridge402 client...');
    await client.start();

    // Keep running
    process.on('SIGINT', () => {
      console.log('\n👋 Stopping...');
      client.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed:', error.message || error);
    process.exit(1);
  }
})();

