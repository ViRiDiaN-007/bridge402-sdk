/**
 * Bridge402 Diffbot SDK Example
 * 
 * Demonstrates how to use the DiffbotClient to extract structured content
 * from web pages using x402 payments.
 * 
 * Prerequisites:
 * - Node.js >= 18
 * - npm install @solana/web3.js dotenv readline
 * - Set KEYPAIR_PATH environment variable
 */

import 'dotenv/config';
import { DiffbotClient } from '../src/index.js';
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import readline from 'readline';

// Prompt user for input
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Load keypair
function loadKeypair() {
  const keypairPath = process.env.KEYPAIR_PATH;
  const keypairJson = process.env.KEYPAIR_JSON;
  
  if (keypairJson) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairJson)));
  }
  
  if (keypairPath) {
    const data = fs.readFileSync(keypairPath, 'utf8');
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(data)));
  }
  
  throw new Error('Set KEYPAIR_PATH or KEYPAIR_JSON environment variable');
}

async function main() {
  try {
    // Load wallet
    const wallet = loadKeypair();
    console.log(`🔑 Wallet: ${wallet.publicKey.toBase58()}\n`);

    // Create Diffbot client
    const client = new DiffbotClient({
      wallet: wallet,
      baseUrl: process.env.BASE_URL || 'https://bridge402.tech',
      solanaRpc: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      network: 'sol', // or 'base'
    });

    // Set up event handlers
    client.on('extraction', ({ type, url, result }) => {
      console.log(`\n✅ ${type} extraction completed for: ${url}`);
      
      // Log payment settlement info
      if (result.payment?.txHash) {
        const txHash = result.payment.txHash;
        const solscanUrl = `https://solscan.io/tx/${txHash}`;
        console.log(`\n💸 Payment settled:`);
        console.log(`   Transaction: ${txHash}`);
        console.log(`   View on Solscan: ${solscanUrl}`);
      } else if (result.payment?.verified) {
        console.log(`\n💸 Payment verified (no transaction hash)`);
      }
      
      if (result.data?.objects?.[0]) {
        const obj = result.data.objects[0];
        console.log(`\n📄 Extraction Summary:`);
        if (result.extractionType === 'image') {
          // Image-specific fields
          console.log(`   Image URL: ${obj.url || 'N/A'}`);
          if (obj.title) console.log(`   Title: ${obj.title}`);
          if (obj.naturalWidth && obj.naturalHeight) {
            console.log(`   Dimensions: ${obj.naturalWidth}x${obj.naturalHeight}px`);
          }
          if (obj.displayWidth && obj.displayHeight) {
            console.log(`   Display Size: ${obj.displayWidth}x${obj.displayHeight}px`);
          }
        } else {
          // Article/Product/Discussion fields
          console.log(`   Title: ${obj.title || 'N/A'}`);
          if (obj.author) console.log(`   Author: ${obj.author}`);
          if (obj.date) console.log(`   Date: ${obj.date}`);
        }
      }
    });

    client.on('error', (error) => {
      console.error('❌ Error:', error.message);
    });

    // Prompt user for extraction type
    console.log('Select extraction type:');
    console.log('1. Article');
    console.log('2. Product');
    console.log('3. Discussion');
    console.log('4. Image');
    const typeChoice = await promptUser('\nEnter choice (1-4): ');
    
    let extractionType;
    switch (typeChoice.trim()) {
      case '1':
        extractionType = 'article';
        break;
      case '2':
        extractionType = 'product';
        break;
      case '3':
        extractionType = 'discussion';
        break;
      case '4':
        extractionType = 'image';
        break;
      default:
        console.error('❌ Invalid choice. Defaulting to article.');
        extractionType = 'article';
    }

    // Prompt user for URL
    const url = await promptUser(`\nEnter URL to extract (${extractionType}): `);
    
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      console.error('\n❌ Invalid URL. Must start with http:// or https://');
      process.exit(1);
    }

    console.log(`\n📄 Extracting ${extractionType} from: ${url}\n`);

    // Perform extraction
    let result;
    switch (extractionType) {
      case 'article':
        result = await client.extractArticle(url);
        break;
      case 'product':
        result = await client.extractProduct(url);
        break;
      case 'discussion':
        result = await client.extractDiscussion(url);
        break;
      case 'image':
        result = await client.extractImage(url);
        break;
    }

    // Display results
    console.log('\n📊 Extraction Result:');
    
    // Log payment settlement info
    if (result.payment?.txHash) {
      const txHash = result.payment.txHash;
      const solscanUrl = `https://solscan.io/tx/${txHash}`;
      console.log(`\n💸 Payment settled:`);
      console.log(`   Transaction: ${txHash}`);
      console.log(`   View on Solscan: ${solscanUrl}`);
    } else if (result.payment?.verified) {
      console.log(`\n💸 Payment verified (no transaction hash)`);
    }
    
    console.log('\n📄 Full Result:');
    console.log(JSON.stringify(result, null, 2));

    // Optionally save to file
    const saveFile = await promptUser('\nSave result to file? (y/n): ');
    if (saveFile.trim().toLowerCase() === 'y') {
      const filename = `diffbot-${extractionType}-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`✅ Result saved to ${filename}`);
    }

    console.log('\n✅ Extraction completed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message?.includes('Payment failed')) {
      console.error('\n   Possible causes:');
      console.error('   - Insufficient USDC balance');
      console.error('   - Network/RPC issues');
      console.error('   - Facilitator service unavailable');
      console.error('   - Invalid URL or Diffbot API error');
    }
    process.exit(1);
  }
}

main();

