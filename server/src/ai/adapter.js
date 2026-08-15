import Anthropic from '@anthropic-ai/sdk';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const client = new Anthropic({ apiKey: config.llm.apiKey });

const MAX_RETRIES = 2;
const TIMEOUT_MS = 25000;

/**
 * Provider-agnostic LLM adapter.
 * Returns parsed JSON when a schema is provided, raw text otherwise.
 */
export const callLLM = async ({ systemPrompt, messages, schema }) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const anthropicMessages = messages.map(m => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.message,
      }));

      const requestParams = {
        model: config.llm.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      };

      // Use structured output (tool_use) when a schema is provided
      if (schema) {
        requestParams.tools = [{
          name: 'structured_response',
          description: 'Return the structured response matching the schema exactly.',
          input_schema: schema,
        }];
        requestParams.tool_choice = { type: 'tool', name: 'structured_response' };
      }

      const response = await Promise.race([
        client.messages.create(requestParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('LLM request timed out')), TIMEOUT_MS)
        ),
      ]);

      // Extract structured output
      if (schema) {
        const toolUse = response.content.find(c => c.type === 'tool_use');
        if (!toolUse) throw new Error('LLM did not return structured output');
        return toolUse.input;
      }

      // Plain text response
      const textBlock = response.content.find(c => c.type === 'text');
      return textBlock?.text || '';

    } catch (error) {
      lastError = error;
      logger.warn(`LLM attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  throw lastError;
};
