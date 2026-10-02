import {
  Global,
  Injectable,
  Logger,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, Output } from 'ai';
import {
  type PriceSuggestionInput,
  type PriceSuggestionOutput,
  priceSuggestionPrompt,
  priceSuggestionSchema,
  RECEIPT_PROMPT,
  type ReceiptExtraction,
  receiptSchema,
} from './ai.prompts.js';

// Free vision model that supports structured outputs (JSON schema); override per env.
// Avoid routers like `openrouter/free`: they may pick a model without JSON schema support.
// ponytail: preview model (checked 2026-09-27: vision + structured_outputs, not rate-limited
// like qwen/qwen3.8-27b:free). Re-check https://openrouter.ai/api/v1/models if it disappears.
const DEFAULT_MODEL = 'dots-studio/dots-3-note-preview:free';
// Vision + JSON schema capable, fits 8 GB VRAM.
const DEFAULT_OLLAMA_MODEL = 'qwen2.5vl:7b';
const TIMEOUT_MS = 90_000;

/** Thin wrapper over OpenRouter so tests can swap it out. */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  get modelId(): string {
    if (process.env.OLLAMA_BASE_URL) {
      return process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    }
    return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  }

  private model() {
    // Local dev: Ollama speaks the same OpenAI-style chat API, so reuse the provider.
    const ollamaUrl = process.env.OLLAMA_BASE_URL;
    if (ollamaUrl) {
      // Thinking models (qwen3) reason for minutes before the JSON; Ollama honours effort "none".
      return createOpenRouter({ baseURL: ollamaUrl, apiKey: 'ollama' })(
        this.modelId,
        { reasoning: { effort: 'none' } },
      );
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Fitur AI belum dikonfigurasi');
    }
    return createOpenRouter({ apiKey })(this.modelId);
  }

  async extractReceipt(
    image: Uint8Array,
    mediaType: string,
  ): Promise<ReceiptExtraction> {
    const { output } = await generateText({
      model: this.model(),
      output: Output.object({ schema: receiptSchema }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_PROMPT },
            { type: 'file', data: image, mediaType },
          ],
        },
      ],
    });
    return output;
  }

  async suggestPrice(
    input: PriceSuggestionInput,
  ): Promise<PriceSuggestionOutput> {
    try {
      const { output } = await generateText({
        model: this.model(),
        output: Output.object({ schema: priceSuggestionSchema }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        prompt: priceSuggestionPrompt(input),
      });
      return output;
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      // Log the provider error server-side only; never echo it to the client.
      this.logger.error('Price suggestion failed', e as Error);
      throw new ServiceUnavailableException(
        'Layanan AI sedang tidak tersedia, coba lagi nanti',
      );
    }
  }
}

@Global()
@Module({ providers: [AiService], exports: [AiService] })
export class AiModule {}
