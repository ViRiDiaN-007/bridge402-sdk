/**
 * Example: WebSocket connection without webhooks
 * 
 * This example demonstrates how to connect to the Bridge402 WebSocket
 * and handle messages directly in your code.
 * 
 * Usage:
 *   node examples/websocket-connection.js
 * 
 * Environment variables:
 *   KEYPAIR_PATH - Path to Solana keypair JSON file
 *   BASE_URL - Bridge402 API URL (optional, defaults to https://bridge402.tech)
 *   SOLANA_RPC - Solana RPC URL (optional)
 */

import 'dotenv/config';
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import { Bridge402Client } from '../src/client.js';

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
  try {
    const wallet = loadWallet();
    
    console.log('🔗 Connecting to Bridge402 WebSocket...\n');
    
    // Create client - no webhook, we'll handle messages ourselves
    const client = new Bridge402Client({
      wallet: wallet,
      duration: 10, // 10 minutes
      autoRenew: true, // Automatically extend sessions
      baseUrl: process.env.BASE_URL || 'https://bridge402.tech',
      solanaRpc: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      retryAttempts: 3 // Retry extension up to 3 times
    });

    // Handle client events
    client.on('started', (data) => {
      console.log('✅ Connected successfully!');
      console.log(`   Session expires at: ${data.expiresAt}\n`);
      console.log('📰 Waiting for news messages...\n');
      console.log('---\n');
    });

    client.on('connected', () => {
      console.log('🔌 WebSocket stream connected\n');
    });

    client.on('message', (msg) => {
      // Determine message type
      const isTwitter = 'body' in msg;
      const isArticle = 'source' in msg;
      
      if (isTwitter) {
        // Twitter/X post
        console.log('🐦 TWITTER POST');
        console.log(`   User: ${msg.title || 'Unknown'}`);
        console.log(`   Coin: ${msg.coin || 'N/A'}`);
        console.log(`   Content: ${msg.body?.substring(0, 150) || 'No content'}...`);
        if (msg.link) {
          console.log(`   Link: ${msg.link}`);
        }
        if (msg.actions && msg.actions.length > 0) {
          console.log(`   Trading Actions: ${msg.actions.length} available`);
        }
      } else if (isArticle) {
        // News article
        console.log('📰 NEWS ARTICLE');
        console.log(`   Title: ${msg.title || 'Untitled'}`);
        console.log(`   Source: ${msg.source || 'Unknown'}`);
        if (msg.symbols && msg.symbols.length > 0) {
          console.log(`   Symbols: ${msg.symbols.join(', ')}`);
        }
        if (msg.url) {
          console.log(`   URL: ${msg.url}`);
        }
        if (msg.en) {
          console.log(`   Preview: ${msg.en.substring(0, 150)}...`);
        }
      } else {
        // Unknown format - show raw
        console.log('📨 NEWS MESSAGE');
        console.log(JSON.stringify(msg, null, 2));
      }
      
      console.log('---\n');
    });

    client.on('sessionRenewed', (data) => {
      console.log(`✅ Session automatically renewed`);
      console.log(`   New expiry: ${data.expiresAt}\n`);
    });

    client.on('sessionRenewalFailed', (data) => {
      console.error(`⚠️  Session renewal failed: ${data.error.message}`);
      console.error('   Session will expire. Reconnect manually to continue.\n');
    });

    client.on('sessionExpiring', (data) => {
      console.log(`⏳ Session expiring in ${data.secondsRemaining} seconds...`);
      console.log('   Attempting automatic renewal...\n');
    });

    client.on('error', (error) => {
      console.error('❌ Error:', error.message || error);
    });

    client.on('closed', (data) => {
      console.log(`\n🔌 Connection closed (code: ${data.code})`);
      if (data.reason) {
        console.log(`   Reason: ${data.reason.toString()}`);
      }
      console.log('\n👋 Disconnected. Run the script again to reconnect.');
    });

    // Start the client
    await client.start();

    // Display status periodically
    const statusInterval = setInterval(() => {
      const status = client.getStatus();
      if (status.isRunning && status.isConnected) {
        console.log(`💚 Status: Connected and running (${new Date().toLocaleTimeString()})`);
      } else if (status.isRunning && !status.isConnected) {
        console.log(`⚠️  Status: Running but not connected (${new Date().toLocaleTimeString()})`);
      }
    }, 60000); // Every minute

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down...');
      clearInterval(statusInterval);
      client.stop();
      console.log('✅ Disconnected');
      process.exit(0);
    });

    // Keep process alive
    console.log('Press Ctrl+C to stop\n');

  } catch (error) {
    console.error('❌ Failed to start:', error.message || error);
    
    if (error.message?.includes('KEYPAIR')) {
      console.error('\n💡 Tip: Set KEYPAIR_PATH environment variable');
      console.error('   Windows:     set KEYPAIR_PATH=path/to/keypair.json');
      console.error('   PowerShell:  $env:KEYPAIR_PATH="path/to/keypair.json"');
      console.error('   Linux/Mac:   export KEYPAIR_PATH=path/to/keypair.json');
    }
    
    if (error.message?.includes('Payment failed')) {
      console.error('\n💡 Possible causes:');
      console.error('   - Insufficient USDC balance');
      console.error('   - Network/RPC issues');
      console.error('   - Facilitator service unavailable');
      console.error('\n   Try again in a few moments.');
    }
    
    process.exit(1);
  }
})();

