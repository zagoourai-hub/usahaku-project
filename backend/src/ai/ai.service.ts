import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
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

// Hard ceilings per call, so a looping model cannot run to its context limit.
// Generous: reasoning tokens (if the model emits any) count toward the cap too.
const OCR_MAX_OUTPUT_TOKENS = 4096;
const PRICE_MAX_OUTPUT_TOKENS = 2048;

/**
 * App-wide daily cap on provider calls: the backstop behind the per-business
 * quotas (many accounts, or a paid model). 0 = unlimited. Fails closed if
 * Redis is down, like the throttler.
 */
export class AiBudget {
  private readonly redis = new Redis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    { maxRetriesPerRequest: 1, lazyConnect: true },
  );

  constructor(
    private readonly cap = Number(process.env.AI_DAILY_CALL_CAP ?? 1000),
    private readonly prefix = 'ai:calls',
  ) {}

  async take() {
    if (this.cap <= 0) return;
    const key = `${this.prefix}:${new Date().toISOString().slice(0, 10)}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 2 * 24 * 60 * 60);
    if (count > this.cap) {
      await this.redis.decr(key);
      throw new ServiceUnavailableException(
        'Layanan AI sedang penuh hari ini, coba lagi besok',
      );
    }
  }

  disconnect() {
    this.redis.disconnect();
  }
}

/** Thin wrapper over OpenRouter so tests can swap it out. */
@Injectable()
export class AiService implements OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);

  private readonly budget = new AiBudget();

  onModuleDestroy() {
    this.budget.disconnect();
  }

  private logUsage(
    feature: string,
    usage: { inputTokens?: number; outputTokens?: number },
  ) {
    this.logger.log(
      `usage feature=${feature} model=${this.modelId} in=${usage.inputTokens ?? '?'} out=${usage.outputTokens ?? '?'}`,
    );
  }

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
    const model = this.model();
    await this.budget.take();
    const { output, usage } = await generateText({
      model,
      output: Output.object({ schema: receiptSchema }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      // The OCR queue already retries with backoff; SDK retries would multiply cost.
      maxRetries: 0,
      maxOutputTokens: OCR_MAX_OUTPUT_TOKENS,
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
    this.logUsage('ocr', usage);
    return output;
  }

  async suggestPrice(
    input: PriceSuggestionInput,
  ): Promise<PriceSuggestionOutput> {
    try {
      const model = this.model();
      await this.budget.take();
      const { output, usage } = await generateText({
        model,
        output: Output.object({ schema: priceSuggestionSchema }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        maxRetries: 0, // a failed call is retried by the user, not silently re-billed
        maxOutputTokens: PRICE_MAX_OUTPUT_TOKENS,
        prompt: priceSuggestionPrompt(input),
      });
      this.logUsage('price-suggestion', usage);
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
