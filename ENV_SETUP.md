# Environment Variables Setup

This guide explains what environment variables you need to run the Bridge402 SDK examples.

## Required Variables

### Choose ONE wallet method:

#### Option 1: Keypair File Path (Recommended)
```bash
KEYPAIR_PATH=./my-keypair.json
```

#### Option 2: Keypair JSON String
```bash
KEYPAIR_JSON='[1,2,3,4,5,...]'
```

**How to get a keypair:**
```bash
# Generate a new keypair
node -e "const { Keypair } = require('@solana/web3.js'); const kp = Keypair.generate(); console.log(JSON.stringify(Array.from(kp.secretKey)))"
```

Save the output to a file (e.g., `my-keypair.json`) or use it directly as `KEYPAIR_JSON`.

## Required for Discord Examples

If running `discord-webhook.js`:
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

**How to get Discord webhook:**
1. Go to your Discord server settings
2. Navigate to **Integrations** → **Webhooks**
3. Click **New Webhook** or use an existing one
4. Copy the webhook URL

## Optional Variables

These have sensible defaults, but you can override them:

```bash
# Bridge402 API URL (default: https://bridge402.tech)
BASE_URL=https://bridge402.tech

# Solana RPC URL (default: https://api.mainnet-beta.solana.com)
SOLANA_RPC=https://api.mainnet-beta.solana.com

# Custom USDC mint (default: mainnet USDC)
SOL_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Fee payer address (auto-fetched if not set)
SOL_FEE_PAYER=2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4

# Facilitator URL (default: https://facilitator.payai.network)
FACILITATOR_URL=https://facilitator.payai.network
```

## Setting Environment Variables

### Windows (Command Prompt)
```cmd
set KEYPAIR_PATH=my-keypair.json
set DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Windows (PowerShell)
```powershell
$env:KEYPAIR_PATH="my-keypair.json"
$env:DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Linux/Mac (Bash)
```bash
export KEYPAIR_PATH=./my-keypair.json
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Using .env file (Recommended)

Create a `.env` file in the SDK directory:

```bash
# SDK/.env
KEYPAIR_PATH=./my-keypair.json
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
BASE_URL=https://bridge402.tech
SOLANA_RPC=https://api.mainnet-beta.solana.com
```

The examples use `dotenv/config` which automatically loads `.env` files.

**Important:** Never commit your `.env` file or keypair files to version control!

## Minimum Setup for Testing

For the **websocket-connection.js** example, you only need:
```bash
KEYPAIR_PATH=./my-keypair.json
```

For the **discord-webhook.js** example, you need:
```bash
KEYPAIR_PATH=./my-keypair.json
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Wallet Requirements

Your Solana wallet needs:
- **USDC balance** - To pay for sessions ($0.0175 USDC minimum for 5 minutes)
- **Network**: Solana Mainnet

Check your balance:
- Use Solana Explorer: https://explorer.solana.com/
- Or use a wallet UI (Phantom, Solflare, etc.)

