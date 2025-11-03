/**
 * Example: Discord webhook integration using Bridge402 SDK
 * 
 * Usage:
 *   node examples/discord-webhook.js
 * 
 * Environment variables:
 *   KEYPAIR_PATH - Path to Solana keypair JSON file
 *   DISCORD_WEBHOOK_URL - Discord webhook URL
 *   BASE_URL - Bridge402 API URL (optional, defaults to https://bridge402.tech)
 *   SOLANA_RPC - Solana RPC URL (optional)
 */

import 'dotenv/config';
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import { Bridge402Client } from '../src/client.js';
import { DiscordFormatter } from '../src/formatters/discord.js';

// Load wallet
function loadWallet() {
  const keypairPath = process.env.KEYPAIR_PATH;
  const keypairJson = process.env.KEYPAIR_JSON;
  
  if (keypairJson) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairJson)));
  }
  
  if (keypairPath) {
    try {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
      return Keypair.fromSecretKey(Uint8Array.from(keypairData));
    } catch (err) {
      throw new Error(`Failed to load keypair: ${err.message}`);
    }
  }
  
  throw new Error('Set KEYPAIR_PATH or KEYPAIR_JSON environment variable');
}

// Main
(async () => {
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  
  if (!discordWebhook) {
    console.error('❌ DISCORD_WEBHOOK_URL environment variable is required');
    process.exit(1);
  }

  try {
    const wallet = loadWallet();
    
    // Create client
    const client = new Bridge402Client({
      wallet: wallet,
      duration: 10, // 10 minutes
      autoRenew: true,
      baseUrl: process.env.BASE_URL || 'https://bridge402.tech',
      solanaRpc: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      webhook: {
        url: discordWebhook
      },
      formatter: new DiscordFormatter()
    });

    // Event handlers
    client.on('started', (data) => {
      console.log('🚀 Client started');
      console.log(`   Session expires at: ${data.expiresAt}`);
    });

    client.on('message', (msg) => {
      // Messages are automatically forwarded to Discord webhook
      // This handler is for custom processing if needed
    });

    client.on('sessionRenewed', (data) => {
      console.log(`✅ Session renewed. New expiry: ${data.expiresAt}`);
    });

    client.on('sessionRenewalFailed', (data) => {
      console.error('❌ Session renewal failed:', data.error.message);
    });

    client.on('error', (error) => {
      console.error('❌ Client error:', error.message || error);
    });

    client.on('closed', (data) => {
      console.log('Connection closed');
      console.log('   To reconnect, restart the script');
    });

    // Start client
    await client.start();

    // Keep process running
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down...');
      client.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start:', error.message || error);
    process.exit(1);
  }
})();

