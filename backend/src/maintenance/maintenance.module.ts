import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Prisma } from '../generated/prisma/client.js';
import { OcrModule } from '../ocr/ocr.module.js';
import { StorageService } from '../ocr/storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const MAINTENANCE_QUEUE = 'maintenance';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BATCH = 100;
const MAX_BATCHES = 20; // per rule per run; the next run continues

// Retention. Scan rows are tiny, photos (up to 5 MB) are what grows.
const FAILED_SCAN_DAYS = 7;
const UNCONFIRMED_SCAN_DAYS = 30; // read but never saved: abandoned draft
const CONFIRMED_PHOTO_DAYS = 30; // keep the saved data, drop the photo

/** Periodic cleanup of rows and files that would otherwise grow forever. */
@Injectable()
export class MaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    try {
      // Upsert by id: every instance/restart converges on one schedule.
      await this.queue.upsertJobScheduler(
        'purge',
        { every: 6 * HOUR },
        { name: 'purge', opts: { removeOnComplete: true, removeOnFail: true } },
      );
      // The schedule's first run is 6h away; also clean shortly after boot so
      // frequent redeploys cannot starve it. Fixed jobId: restarts don't pile up.
      await this.queue.add(
        'purge',
        {},
        {
          jobId: 'purge-after-boot',
          delay: 60_000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (e) {
      this.logger.warn(`Maintenance schedule skipped: ${String(e)}`);
    }
  }

  async purge(now = Date.now()) {
    const before = (days: number) => new Date(now - days * DAY);
    const sessions = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });
    const verifications = await this.prisma.verification.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });
    const failedScans = await this.dropScans({
      status: 'FAILED',
      updatedAt: { lt: before(FAILED_SCAN_DAYS) },
    });
    const draftScans = await this.dropScans({
      status: 'DONE',
      updatedAt: { lt: before(UNCONFIRMED_SCAN_DAYS) },
    });
    const photos = await this.dropConfirmedPhotos(before(CONFIRMED_PHOTO_DAYS));
    const result = {
      sessions: sessions.count,
      verifications: verifications.count,
      failedScans,
      draftScans,
      photos,
    };
    this.logger.log(`purge ${JSON.stringify(result)}`);
    return result;
  }

  /** Deletes the photo, then the row. A photo that fails to delete keeps its row for the next run. */
  private async dropScans(where: Prisma.ReceiptScanWhereInput) {
    const skipped = new Set<string>();
    let dropped = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
      const rows = await this.prisma.receiptScan.findMany({
        where: { ...where, id: { notIn: [...skipped] } },
        select: { id: true, imageKey: true },
        take: BATCH,
      });
      if (!rows.length) break;
      const ids: string[] = [];
      for (const r of rows) {
        if (r.imageKey && !(await this.deletePhoto(r.imageKey))) {
          skipped.add(r.id);
        } else {
          ids.push(r.id);
        }
      }
      if (ids.length) {
        await this.prisma.receiptScan.deleteMany({
          where: { id: { in: ids } },
        });
        dropped += ids.length;
      }
    }
    return dropped;
  }

  private async dropConfirmedPhotos(olderThan: Date) {
    const skipped = new Set<string>();
    let dropped = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
      const rows = await this.prisma.receiptScan.findMany({
        where: {
          status: 'CONFIRMED',
          imageKey: { not: null },
          updatedAt: { lt: olderThan },
          id: { notIn: [...skipped] },
        },
        select: { id: true, imageKey: true },
        take: BATCH,
      });
      if (!rows.length) break;
      for (const r of rows) {
        if (!(await this.deletePhoto(r.imageKey!))) {
          skipped.add(r.id);
          continue;
        }
        await this.prisma.receiptScan.update({
          where: { id: r.id },
          data: { imageKey: null, rawResult: Prisma.DbNull },
        });
        dropped++;
      }
    }
    return dropped;
  }

  private async deletePhoto(key: string) {
    try {
      await this.storage.delete(key);
      return true;
    } catch (e) {
      this.logger.warn(`Could not delete ${key}: ${String(e)}`);
      return false;
    }
  }
}

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }

  async process() {
    await this.maintenance.purge();
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: MAINTENANCE_QUEUE }), OcrModule],
  providers: [MaintenanceService, MaintenanceProcessor],
})
export class MaintenanceModule {}
