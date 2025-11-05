# Bridge402 SDK

Easy integration for Bridge402 services. Connect to real-time crypto news feeds, extract structured content from web pages, and access earnings transcripts with automatic payment handling.

## Features

### News WebSocket Streams
- ✅ **Automatic Payment Handling** - x402 payments with Solana
- ✅ **Auto-Renewal** - Sessions automatically extend before expiry
- ✅ **Webhook Support** - Forward messages to Discord, custom webhooks, etc.
- ✅ **Retry Logic** - Handles facilitator failures gracefully
- ✅ **Event-Driven** - Simple event-based API

### Diffbot Content Extraction
- ✅ **Article Extraction** - Extract structured article content
- ✅ **Product Extraction** - Extract product information
- ✅ **Discussion Extraction** - Extract forum/thread content
- ✅ **Image Extraction** - Extract primary images with metadata
- ✅ **Batch Processing** - Extract multiple URLs efficiently
- ✅ **Auto-Payment** - Automatic x402 payment handling

## Installation

```bash
npm install @bridge402/sdk
```

Or use directly from this directory:

```bash
cd SDK
npm install
```

## Quick Start

### Discord Webhook Example

```javascript
import { Bridge402Client, DiscordFormatter } from '@bridge402/sdk';
import { Keypair } from '@solana/web3.js';

// Load your wallet
const wallet = Keypair.fromSecretKey(/* your keypair */);

// Create client
const client = new Bridge402Client({
  wallet: wallet,
  duration: 10, // minutes
  autoRenew: true,
  webhook: {
    url: 'https://discord.com/api/webhooks/...'
  },
  formatter: new DiscordFormatter()
});

// Start
await client.start();
```

### Basic Usage (No Webhook)

```javascript
import { Bridge402Client } from '@bridge402/sdk';

const client = new Bridge402Client({
  wallet: wallet,
  duration: 5,
  autoRenew: true
});

// Handle messages
client.on('message', (msg) => {
  console.log('News:', msg);
});

await client.start();
```

### Diffbot Extraction Example

```javascript
import { DiffbotClient } from '@bridge402/sdk';
import { Keypair } from '@solana/web3.js';

// Load your wallet
const wallet = Keypair.fromSecretKey(/* your keypair */);

// Create Diffbot client
const client = new DiffbotClient({
  wallet: wallet,
  baseUrl: 'https://bridge402.tech',
  network: 'sol' // or 'base'
});

// Extract article
const result = await client.extractArticle('https://example.com/article');
console.log('Article:', result.data.objects[0]);

// Extract product
const product = await client.extractProduct('https://example.com/product');

// Extract discussion
const discussion = await client.extractDiscussion('https://example.com/forum');

// Extract images
const images = await client.extractImage('https://example.com/gallery');

// Batch extract multiple URLs
const results = await client.batchExtract('article', [
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.com/article3'
]);
```

## API Reference

### Bridge402Client

Main client class for connecting to Bridge402 news streams.

#### Constructor Options

```javascript
{
  wallet: Keypair,              // Required: Solana wallet/keypair
  baseUrl: string,              // Optional: API URL (default: https://bridge402.tech)
  solanaRpc: string,            // Optional: Solana RPC URL
  duration: number,              // Optional: Session duration in minutes (default: 5)
  autoRenew: boolean,           // Optional: Auto-renew sessions (default: true)
  retryAttempts: number,        // Optional: Retry attempts for renewals (default: 3)
  webhook: {                    // Optional: Webhook configuration
    url: string
  },
  formatter: MessageFormatter,  // Optional: Message formatter
  solUsdcMint: string,          // Optional: USDC mint address
  facilitatorUrl: string        // Optional: Facilitator URL
}
```

#### Methods

**`start()`**
Start the client and connect to the news stream.

```javascript
await client.start();
```

**`stop()`**
Stop the client and disconnect.

```javascript
client.stop();
```

**`getStatus()`**
Get current client status.

```javascript
const status = client.getStatus();
// { isRunning: true, isConnected: true, hasToken: true }
```

#### Events

**`started`** - Client started successfully
```javascript
client.on('started', (data) => {
  console.log('Expires at:', data.expiresAt);
});
```

**`message`** - News message received
```javascript
client.on('message', (msg) => {
  console.log('News:', msg);
});
```

**`sessionRenewed`** - Session was automatically renewed
```javascript
client.on('sessionRenewed', (data) => {
  console.log('New expiry:', data.expiresAt);
});
```

**`sessionRenewalFailed`** - Session renewal failed
```javascript
client.on('sessionRenewalFailed', (data) => {
  console.error('Renewal failed:', data.error);
});
```

**`error`** - Error occurred
```javascript
client.on('error', (error) => {
  console.error('Error:', error);
});
```

**`closed`** - Connection closed
```javascript
client.on('closed', (data) => {
  console.log('Closed:', data.code, data.reason);
});
```

### DiffbotClient

Main client class for extracting structured content from web pages using Diffbot.

#### Constructor Options

```javascript
{
  wallet: Keypair,              // Required: Solana wallet/keypair
  baseUrl: string,              // Optional: API URL (default: https://bridge402.tech)
  solanaRpc: string,            // Optional: Solana RPC URL
  network: string,              // Optional: 'sol' or 'base' (default: 'sol')
  retryAttempts: number,        // Optional: Retry attempts (default: 3)
  solUsdcMint: string,          // Optional: USDC mint address
  facilitatorUrl: string        // Optional: Facilitator URL
}
```

#### Methods

**`extractArticle(url)`**
Extract article content from a URL.

```javascript
const result = await client.extractArticle('https://example.com/article');
// Returns: { extractionType, url, data, payment, metadata }
```

**`extractProduct(url)`**
Extract product information from a URL.

```javascript
const result = await client.extractProduct('https://example.com/product');
```

**`extractDiscussion(url)`**
Extract discussion/forum content from a URL.

```javascript
const result = await client.extractDiscussion('https://example.com/forum');
```

**`extractImage(url)`**
Extract primary images from a URL.

```javascript
const result = await client.extractImage('https://example.com/gallery');
// Returns array of image objects with metadata (url, dimensions, tags, etc.)
```

**`batchExtract(type, urls)`**
Extract multiple URLs in batch.

```javascript
const results = await client.batchExtract('article', [
  'https://example.com/article1',
  'https://example.com/article2'
]);
// Returns: [{ url, success: true, data }, ...]
```

#### Events

**`extraction`** - Extraction completed
```javascript
client.on('extraction', ({ type, url, result }) => {
  console.log(`Extracted ${type} from ${url}`);
});
```

**`error`** - Error occurred
```javascript
client.on('error', (error) => {
  console.error('Error:', error);
});
```

### Message Formatters

#### DiscordFormatter

Formats messages as Discord embeds.

```javascript
import { DiscordFormatter } from '@bridge402/sdk';

const formatter = new DiscordFormatter();
const embed = formatter.format(newsMessage);
```

#### Custom Formatter

Create your own formatter by extending `MessageFormatter`:

```javascript
import { MessageFormatter } from '@bridge402/sdk';

class MyFormatter extends MessageFormatter {
  format(message) {
    return {
      text: message.title,
      // ... custom format
    };
  }
}
```

## Examples

See the `examples/` directory:

### News WebSocket Examples
- **`websocket-connection.js`** - WebSocket connection example (handles messages directly)
- **`discord-webhook.js`** - Discord webhook integration
- **`basic-usage.js`** - Basic usage without webhooks

### Diffbot Extraction Examples
- **`diffbot-usage.js`** - Diffbot extraction examples (article, product, discussion, batch)

### WebSocket Connection Example

Connect to the WebSocket and handle messages in your code:

```bash
# Set environment variables
export KEYPAIR_PATH="path/to/keypair.json"

# Run example
node examples/websocket-connection.js
```

### Discord Webhook Example

Forward messages to a Discord webhook:

```bash
# Set environment variables
export KEYPAIR_PATH="path/to/keypair.json"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Run example
node examples/discord-webhook.js
```

### Diffbot Extraction Example

Extract structured content from web pages:

```bash
# Set environment variables
export KEYPAIR_PATH="path/to/keypair.json"
export BASE_URL="https://bridge402.tech"

# Run example
node examples/diffbot-usage.js
```

## Message Format

News messages can be either Twitter/X posts or news articles.

### Twitter/X Post

```json
{
  "title": "User (@handle)",
  "body": "Tweet content...",
  "coin": "BTC",
  "link": "https://twitter.com/...",
  "icon": "https://...",
  "image": "https://...",
  "actions": [...],
  "time": 1234567890
}
```

### News Article

```json
{
  "title": "Article Title",
  "source": "Cointelegraph",
  "url": "https://...",
  "symbols": ["BTC", "ETH"],
  "en": "Article content...",
  "time": 1234567890
}
```

## Environment Variables

### Required

- **`KEYPAIR_PATH`** - Path to Solana keypair JSON file (or use `KEYPAIR_JSON` instead)
  - Example: `KEYPAIR_PATH=./my-keypair.json`
  
  OR

- **`KEYPAIR_JSON`** - JSON array string of keypair secret key
  - Example: `KEYPAIR_JSON='[1,2,3,...]'`

### Required for Discord Examples

- **`DISCORD_WEBHOOK_URL`** - Discord webhook URL
  - Example: `DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/abcdefghijklmnop`

### Optional

- **`BASE_URL`** - Bridge402 API URL (default: `https://bridge402.tech`)
  - Example: `BASE_URL=https://bridge402.tech`

- **`SOLANA_RPC`** - Solana RPC URL (default: `https://api.mainnet-beta.solana.com`)
  - Example: `SOLANA_RPC=https://api.mainnet-beta.solana.com`
  - Or use a custom RPC: `SOLANA_RPC=https://your-rpc-url.com`

- **`SOL_USDC_MINT`** - USDC mint address (default: mainnet USDC)
  - Only needed if using a different token
  
- **`SOL_FEE_PAYER`** - Fee payer address (auto-fetched if not set)
  - Only needed if facilitator doesn't provide it

- **`FACILITATOR_URL`** - Facilitator URL (default: `https://facilitator.payai.network`)
  - Only needed if using a different facilitator

## Quick Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your values:
   ```bash
   KEYPAIR_PATH=./my-keypair.json
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

3. The SDK will automatically load `.env` if you use `dotenv/config`

## Error Handling

The SDK includes automatic retry logic for:

- **Facilitator failures** - Retries with exponential backoff
- **Payment failures** - Handles network issues gracefully
- **Webhook failures** - Logs errors but continues processing

## Requirements

- Node.js >= 18.0.0
- Solana wallet with USDC balance
- Internet connection

## License

MIT

## Support

- Documentation: https://docs.bridge402.tech
- Discord: https://discord.gg/KNgUeFbsWn
- Twitter: https://x.com/BridgeWith402

