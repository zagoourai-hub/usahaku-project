import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AiService } from '../ai/ai.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { IngredientService } from '../ingredient/ingredient.module.js';
import { purchasePriceFromReceipt } from '../ingredient/unit-conversion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsageService } from '../subscription/subscription.module.js';
import { matchIngredient } from './ingredient-matcher.js';
import type { ConfirmReceiptDto } from './ocr.dto.js';
import { StorageService } from './storage.service.js';

export const OCR_QUEUE = 'ocr';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const GENERIC_FAILURE =
  'Struk gagal dibaca. Coba foto ulang yang lebih jelas atau isi manual.';

/** Detects the real image type from magic bytes; the client mimetype is not trusted. */
export function sniffImage(bytes: Uint8Array): string | undefined {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'image/png';
  }
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return undefined;
}

function dateOrNull(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class OcrService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly usage: UsageService,
    private readonly ai: AiService,
    private readonly ingredients: IngredientService,
    @InjectQueue(OCR_QUEUE) private readonly queue: Queue,
  ) {}

  /** Re-enqueue scans left unfinished by a crash/restart (jobId dedups). */
  async onApplicationBootstrap() {
    try {
      const stuck = await this.prisma.receiptScan.findMany({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
        select: { id: true },
      });
      for (const s of stuck) await this.enqueue(s.id);
      if (stuck.length) this.logger.log(`Re-enqueued ${stuck.length} scan(s)`);
    } catch (e) {
      this.logger.warn(`OCR recovery skipped: ${String(e)}`);
    }
  }

  private enqueue(scanId: string) {
    return this.queue.add(
      'extract',
      { scanId },
      {
        jobId: scanId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async upload(businessId: string, bytes: Uint8Array) {
    const mimeType = sniffImage(bytes);
    if (!mimeType) {
      throw new BadRequestException('Foto harus JPG, PNG, atau WEBP');
    }
    const key = `${businessId}/${randomUUID()}`;
    await this.storage.put(key, bytes, mimeType);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.usage.consume(tx, businessId, 'ocr');
        const scan = await tx.receiptScan.create({
          data: { businessId, imageKey: key, mimeType },
          select: { id: true, status: true },
        });
        // Inside the tx: if Redis is down the scan + quota roll back.
        await this.enqueue(scan.id);
        return scan;
      });
    } catch (e) {
      await this.storage.delete(key).catch(() => undefined);
      throw e;
    }
  }

  async get(businessId: string, id: string) {
    const scan = await this.prisma.receiptScan.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        status: true,
        imageKey: true,
        merchantName: true,
        detectedTotal: true,
        detectedDate: true,
        errorMessage: true,
        createdAt: true,
        items: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            qty: true,
            unit: true,
            price: true,
            matchedIngredient: {
              select: {
                id: true,
                name: true,
                purchaseUnit: true,
                usageUnit: true,
              },
            },
          },
        },
        transaction: { select: { id: true } },
      },
    });
    if (!scan) throw new NotFoundException('Struk tidak ditemukan');
    const { imageKey, ...rest } = scan;
    // Photos are purged by the maintenance job after a while.
    return {
      ...rest,
      imageUrl: imageKey ? `/receipts/${scan.id}/image` : null,
    };
  }

  async image(businessId: string, id: string) {
    const scan = await this.prisma.receiptScan.findFirst({
      where: { id, businessId },
      select: { imageKey: true, mimeType: true },
    });
    if (!scan?.imageKey)
      throw new NotFoundException('Foto struk tidak tersedia');
    return {
      bytes: await this.storage.get(scan.imageKey),
      mimeType: scan.mimeType,
    };
  }

  /** Worker entrypoint. Throws to let BullMQ retry; marks FAILED on the last try. */
  async process(scanId: string, finalAttempt: boolean) {
    const scan = await this.prisma.receiptScan.findUnique({
      where: { id: scanId },
    });
    if (!scan || scan.status === 'DONE' || scan.status === 'CONFIRMED') return;
    await this.prisma.receiptScan.update({
      where: { id: scanId },
      data: { status: 'PROCESSING' },
    });

    try {
      if (!scan.imageKey) throw new Error('Receipt photo is gone');
      const image = await this.storage.get(scan.imageKey);
      const result = await this.ai.extractReceipt(image, scan.mimeType);
      const ingredients = await this.prisma.ingredient.findMany({
        where: { businessId: scan.businessId },
        select: { id: true, name: true },
      });
      await this.prisma.$transaction([
        this.prisma.receiptItem.deleteMany({
          where: { receiptScanId: scanId },
        }),
        this.prisma.receiptScan.update({
          where: { id: scanId },
          data: {
            status: 'DONE',
            errorMessage: null,
            rawResult: result,
            merchantName: result.merchantName,
            detectedTotal: result.total,
            detectedDate: dateOrNull(result.date),
            items: {
              create: result.items.map((i, position) => ({
                position,
                name: i.name,
                qty: i.qty,
                unit: i.unit || 'pcs',
                price: i.price,
                matchedIngredientId: matchIngredient(i.name, ingredients)?.id,
              })),
            },
          },
        }),
      ]);
    } catch (e) {
      // Config errors (no API key) won't fix themselves: fail now.
      const permanent = e instanceof HttpException;
      this.logger.error(`OCR ${scanId} failed`, e as Error);
      if (finalAttempt || permanent) {
        await this.prisma.receiptScan.update({
          where: { id: scanId },
          data: {
            status: 'FAILED',
            errorMessage: permanent ? e.message : GENERIC_FAILURE,
          },
        });
      }
      if (!permanent) throw e;
    }
  }

  /**
   * Turns a reviewed draft into an EXPENSE transaction (source OCR), optionally
   * updating ingredient prices (+ HPP recalc), all in one DB transaction.
   * FAILED scans can be confirmed too: the user typed the data manually.
   */
  confirm(businessId: string, id: string, dto: ConfirmReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      // Atomic state change: a second confirm (double submit) finds 0 rows.
      const { count } = await tx.receiptScan.updateMany({
        where: { id, businessId, status: { in: ['DONE', 'FAILED'] } },
        data: { status: 'CONFIRMED' },
      });
      if (!count) {
        const exists = await tx.receiptScan.findFirst({
          where: { id, businessId },
          select: { status: true },
        });
        if (!exists) throw new NotFoundException('Struk tidak ditemukan');
        throw new ConflictException(
          exists.status === 'CONFIRMED'
            ? 'Struk sudah dikonfirmasi'
            : 'Struk masih diproses',
        );
      }

      const category = await expenseCategory(tx, businessId, dto.categoryId);
      const ingredientIds = [
        ...new Set(
          dto.items.flatMap((i) => (i.ingredientId ? [i.ingredientId] : [])),
        ),
      ];
      const owned = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds }, businessId },
      });
      if (owned.length !== ingredientIds.length) {
        throw new BadRequestException('Bahan baku tidak ditemukan');
      }
      const byId = new Map(owned.map((i) => [i.id, i]));

      await this.usage.consume(tx, businessId, 'transaction');
      const transaction = await tx.transaction.create({
        data: {
          businessId,
          categoryId: category.id,
          type: 'EXPENSE',
          amount: dto.amount,
          description: dto.description,
          transactionDate: new Date(dto.transactionDate),
          source: 'OCR',
          receiptScanId: id,
        },
      });

      await tx.receiptItem.deleteMany({ where: { receiptScanId: id } });
      await tx.receiptItem.createMany({
        data: dto.items.map((i, position) => ({
          receiptScanId: id,
          position,
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          price: i.price,
          matchedIngredientId: i.ingredientId ?? null,
        })),
      });

      for (const item of dto.items) {
        if (!item.updateIngredientPrice || !item.ingredientId) continue;
        const ingredient = byId.get(item.ingredientId)!;
        await this.ingredients.updateInTx(
          tx,
          businessId,
          ingredient.id,
          { purchasePrice: purchasePriceFromReceipt(ingredient, item) },
          'OCR',
        );
      }
      return transaction;
    });
  }
}

async function expenseCategory(
  tx: Prisma.TransactionClient,
  businessId: string,
  categoryId?: string,
) {
  const category = await tx.category.findFirst({
    where: categoryId
      ? { id: categoryId, businessId, type: 'EXPENSE' }
      : { businessId, type: 'EXPENSE', isDefault: true, name: 'Belanja Bahan' },
  });
  if (!category) {
    throw new BadRequestException('Kategori pengeluaran tidak ditemukan');
  }
  return category;
}
