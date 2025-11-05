/**
 * Discord message formatter
 */

import { MessageFormatter } from './base.js';

export class DiscordFormatter extends MessageFormatter {
  /**
   * Format message as Discord embed
   */
  format(message) {
    const title = message.title || 'Bridge402 News';
    const timeMs = message.time;
    const url = message.url || message.link || '';
    
    const isTwitter = 'body' in message;
    const isArticle = 'source' in message;
    
    // Format timestamp
    let timestamp = null;
    if (timeMs) {
      timestamp = new Date(timeMs).toISOString();
    }
    
    // Build description
    let description = '';
    if (isTwitter) {
      const body = message.body || '';
      description = body.length > 2000 ? body.substring(0, 2000) : body;
    } else if (isArticle) {
      const enText = message.en || title;
      description = enText.length > 2000 ? enText.substring(0, 2000) : enText;
    }
    
    // Add link
    if (url) {
      description = description ? `${description}\n\n🔗 [View Original](${url})` : `🔗 [View Original](${url})`;
    }
    
    // Create embed
    const embed = {
      title: title,
      description: description || null,
      color: 0x5e35b1, // Deep purple
      footer: { text: 'Bridge402 News Stream' },
      timestamp: timestamp
    };
    
    // Build fields
    const fields = [];
    
    if (isTwitter) {
      const coin = message.coin || '';
      if (coin) {
        fields.push({ name: 'Coin', value: coin, inline: true });
      }
      
      const actions = message.actions || [];
      if (actions.length > 0) {
        let actionText = actions.slice(0, 3).map(a => `• ${a.title || a.action || ''}`).join('\n');
        if (actions.length > 3) {
          actionText += `\n*+${actions.length - 3} more*`;
        }
        fields.push({ name: 'Trading Actions', value: actionText, inline: false });
      }
      
      const iconUrl = message.icon || '';
      const imageUrl = message.image || '';
      if (iconUrl) {
        embed.thumbnail = { url: iconUrl };
      }
      if (imageUrl) {
        embed.image = { url: imageUrl };
      }
    } else if (isArticle) {
      const source = message.source || '';
      if (source) {
        fields.push({ name: 'Source', value: source, inline: true });
      }
      
      const symbols = message.symbols || [];
      if (symbols.length > 0) {
        let symbolsText = symbols.slice(0, 5).join(', ');
        if (symbols.length > 5) {
          symbolsText += ` +${symbols.length - 5} more`;
        }
        fields.push({ name: 'Symbols', value: symbolsText, inline: false });
      }
    }
    
    if (fields.length > 0) {
      embed.fields = fields;
    }
    
    return {
      embeds: [embed]
    };
  }
}



