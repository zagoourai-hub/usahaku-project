import { BullModule, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Job } from 'bullmq';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { IngredientModule } from '../ingredient/ingredient.module.js';
import { SubscriptionModule } from '../subscription/subscription.module.js';
import { ConfirmReceiptDto } from './ocr.dto.js';
import { MAX_IMAGE_BYTES, OCR_QUEUE, OcrService } from './ocr.service.js';
import { StorageService } from './storage.service.js';

@Processor(OCR_QUEUE, { concurrency: 2 })
export class OcrProcessor extends WorkerHost {
  constructor(private readonly ocr: OcrService) {
    super();
  }

  async process(job: Job<{ scanId: string }>) {
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await this.ocr.process(job.data.scanId, finalAttempt);
  }
}

@Controller('receipts')
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  /** multipart/form-data, field `image`. Returns 202 + scan id; poll GET /receipts/:id. */
  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  upload(
    @CurrentBusiness() businessId: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('Field "image" wajib diisi');
    return this.ocr.upload(businessId, file.buffer);
  }

  @Get(':id')
  get(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ocr.get(businessId, id);
  }

  @Get(':id/image')
  async image(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { bytes, mimeType } = await this.ocr.image(businessId, id);
    return new StreamableFile(bytes, { type: mimeType });
  }

  @Post(':id/confirm')
  confirm(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmReceiptDto,
  ) {
    return this.ocr.confirm(businessId, id, dto);
  }
}

@Module({
  imports: [
    BullModule.registerQueue({ name: OCR_QUEUE }),
    SubscriptionModule,
    IngredientModule,
  ],
  controllers: [OcrController],
  providers: [OcrService, OcrProcessor, StorageService],
  exports: [StorageService],
})
export class OcrModule {}
