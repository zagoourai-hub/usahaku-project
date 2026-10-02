import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const WINDOW_DAYS = 14;
const MAX_ITEMS = 20;

export type Notification = {
  id: string;
  title: string;
  href: string;
  createdAt: Date;
};

// ponytail: derived from existing data on every request, nothing stored.
// Read state lives in the browser (last-seen timestamp). Add a table when
// notifications need to be dismissed per item or pushed.
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<Notification[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const [ingredients, scans, recipes] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: {
          businessId,
          priceLogs: { some: { createdAt: { gte: since } } },
        },
        select: {
          id: true,
          name: true,
          priceLogs: {
            orderBy: { createdAt: 'desc' },
            take: 2,
            select: { id: true, purchasePrice: true, createdAt: true },
          },
        },
      }),
      this.prisma.receiptScan.findMany({
        where: {
          businessId,
          status: { in: ['DONE', 'FAILED'] },
          updatedAt: { gte: since },
        },
        select: { id: true, status: true, merchantName: true, updatedAt: true },
      }),
      this.prisma.recipe.findMany({
        where: { businessId, isActive: true, sellingPrice: { not: null } },
        select: {
          id: true,
          name: true,
          currentHpp: true,
          sellingPrice: true,
          updatedAt: true,
        },
      }),
    ]);

    const out: Notification[] = [];
    for (const i of ingredients) {
      const [latest, previous] = i.priceLogs;
      if (!latest || !previous || latest.createdAt < since) continue;
      if (!latest.purchasePrice.gt(previous.purchasePrice)) continue;
      const pct = latest.purchasePrice
        .sub(previous.purchasePrice)
        .div(previous.purchasePrice)
        .mul(100)
        .toDecimalPlaces(1);
      out.push({
        id: `price:${latest.id}`,
        title: `Harga ${i.name} naik ${pct.toString().replace('.', ',')}% dari harga sebelumnya`,
        href: '/ingredients',
        createdAt: latest.createdAt,
      });
    }
    for (const s of scans) {
      const from = s.merchantName ? ` dari ${s.merchantName}` : '';
      out.push({
        id: `receipt:${s.id}:${s.status}`,
        title:
          s.status === 'DONE'
            ? `Struk${from} selesai dibaca, cek lalu simpan`
            : `Struk${from} gagal dibaca`,
        href: `/receipts/${s.id}`,
        createdAt: s.updatedAt,
      });
    }
    for (const r of recipes) {
      if (!r.sellingPrice!.lt(r.currentHpp)) continue;
      out.push({
        id: `loss:${r.id}:${r.currentHpp.toString()}`,
        title: `${r.name} rugi: harga jual di bawah HPP`,
        href: `/recipes/${r.id}`,
        createdAt: r.updatedAt,
      });
    }
    return out
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, MAX_ITEMS);
  }
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentBusiness() businessId: string) {
    return this.notifications.list(businessId);
  }
}

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
