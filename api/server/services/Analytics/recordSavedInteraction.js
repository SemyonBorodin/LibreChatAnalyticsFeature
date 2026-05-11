const { logger } = require('@librechat/data-schemas');
const { recordInteractionExchange } = require('@librechat/api');
const db = require('~/models');

function extractTextFromContentPart(part) {
  if (typeof part === 'string') {
    return part;
  }

  if (part == null || typeof part !== 'object') {
    return '';
  }

  const candidates = [part.text, part.content, part.value];
  if (typeof part.type === 'string') {
    candidates.push(part[part.type]);
  }

  return candidates.find((value) => typeof value === 'string' && value.trim() !== '') ?? '';
}

function extractMessageText(message) {
  if (typeof message?.text === 'string' && message.text.trim() !== '') {
    return message.text;
  }

  if (typeof message?.content === 'string' && message.content.trim() !== '') {
    return message.content;
  }

  if (Array.isArray(message?.content)) {
    return message.content.map(extractTextFromContentPart).join('').trim();
  }

  return '';
}

async function recordSavedInteraction({
  userId,
  savedMessage,
  fallbackMessage,
  fallbackParentMessage,
  conversationId,
  source = 'message-persistence',
}) {
  if (
    typeof userId !== 'string' ||
    userId.trim() === '' ||
    savedMessage?.isCreatedByUser === true ||
    typeof savedMessage?.parentMessageId !== 'string'
  ) {
    return null;
  }

  try {
    const parentMessage = await db.getMessage({
      user: userId,
      messageId: savedMessage.parentMessageId,
    });
    const userMessage =
      extractMessageText(parentMessage) || extractMessageText(fallbackParentMessage);
    const assistantMessage =
      extractMessageText(savedMessage) || extractMessageText(fallbackMessage);

    if (!userMessage || !assistantMessage) {
      return null;
    }

    return await recordInteractionExchange(
      { createInteraction: db.createInteraction },
      {
        user: userId,
        userMessageId: savedMessage.parentMessageId,
        assistantMessageId: savedMessage.messageId,
        userMessage,
        assistantMessage,
        model: savedMessage.model ?? fallbackMessage?.model ?? null,
        endpoint: savedMessage.endpoint ?? fallbackMessage?.endpoint ?? null,
        conversationId: savedMessage.conversationId ?? conversationId ?? null,
        metadata: {
          mocked: false,
          source,
        },
      },
    );
  } catch (error) {
    logger.error('[analytics] Failed to record saved assistant message interaction:', error);
    return null;
  }
}

module.exports = {
  extractMessageText,
  recordSavedInteraction,
};
