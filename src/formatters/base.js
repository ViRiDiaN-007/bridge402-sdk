/**
 * Base message formatter
 */

export class MessageFormatter {
  /**
   * Format a news message
   */
  format(message) {
    return message;
  }

  /**
   * Determine message type
   */
  getMessageType(message) {
    if ('body' in message) return 'twitter';
    if ('source' in message) return 'article';
    return 'unknown';
  }
}



