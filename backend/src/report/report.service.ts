import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type Granularity = 'day' | 'week' | 'month';

const D = Prisma.Decimal;
const zero = () => new D(0);

/** Bucket key for a DATE column value (UTC midnight). Weeks start Monday. */
function bucket(date: Date, g: Granularity): string {
  const iso = date.toISOString().slice(0, 10);
  if (g === 'day') return iso;
  if (g === 'month') return iso.slice(0, 7);
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ponytail: no Redis cache; a groupBy on the (businessId, transactionDate)
  // index is cheap at UMKM volumes. Cache when dashboard latency shows up.
  async summary(
    businessId: string,
    from: string,
    to: string,
    granularity: Granularity,
  ) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['transactionDate', 'type'],
      where: { businessId, transactionDate: range(from, to) },
      _sum: { amount: true },
      orderBy: { transactionDate: 'asc' },
    });

    const series = new Map<
      string,
      { income: Prisma.Decimal; expense: Prisma.Decimal }
    >();
    let income = zero();
    let expense = zero();
    for (const r of rows) {
      const key = bucket(r.transactionDate, granularity);
      const point = series.get(key) ?? { income: zero(), expense: zero() };
      const amount = r._sum.amount ?? zero();
      if (r.type === 'INCOME') {
        point.income = point.income.add(amount);
        income = income.add(amount);
      } else {
        point.expense = point.expense.add(amount);
        expense = expense.add(amount);
      }
      series.set(key, point);
    }

    return {
      from,
      to,
      granularity,
      totalIncome: income,
      totalExpense: expense,
      balance: income.sub(expense),
      series: [...series].map(([period, p]) => ({
        period,
        income: p.income,
        expense: p.expense,
        balance: p.income.sub(p.expense),
      })),
    };
  }

  async profitLoss(businessId: string, from: string, to: string) {
    const [rows, business] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['categoryId', 'type'],
        where: { businessId, transactionDate: range(from, to) },
        _sum: { amount: true },
      }),
      this.prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { name: true },
      }),
    ]);
    const categories = await this.prisma.category.findMany({
      where: { businessId, id: { in: rows.map((r) => r.categoryId) } },
      select: { id: true, name: true },
    });
    const names = new Map(categories.map((c) => [c.id, c.name]));

    const lines = (type: 'INCOME' | 'EXPENSE') =>
      rows
        .filter((r) => r.type === type)
        .map((r) => ({
          category: names.get(r.categoryId) ?? '-',
          amount: r._sum.amount ?? zero(),
        }))
        .sort((a, b) => b.amount.cmp(a.amount));
    const sum = (xs: { amount: Prisma.Decimal }[]) =>
      xs.reduce((s, x) => s.add(x.amount), zero());

    const income = lines('INCOME');
    const expense = lines('EXPENSE');
    const totalIncome = sum(income);
    const totalExpense = sum(expense);
    return {
      businessName: business.name,
      from,
      to,
      income,
      expense,
      totalIncome,
      totalExpense,
      netProfit: totalIncome.sub(totalExpense),
    };
  }

  /**
   * Portions sold per menu in [from, to] (manual INCOME entries with a recipe),
   * compared with the previous period of the same length for the trend arrow.
   */
  async recipeSales(businessId: string, from: string, to: string) {
    const DAY = 86_400_000;
    const days = (Date.parse(to) - Date.parse(from)) / DAY + 1;
    const portions = async (gte: Date, lte: Date) => {
      const rows = await this.prisma.transaction.groupBy({
        by: ['recipeId'],
        where: {
          businessId,
          type: 'INCOME',
          recipeId: { not: null },
          transactionDate: { gte, lte },
        },
        _sum: { portions: true },
      });
      return new Map(rows.map((r) => [r.recipeId!, r._sum.portions ?? 0]));
    };
    const [now, before] = await Promise.all([
      portions(new Date(from), new Date(to)),
      portions(
        new Date(Date.parse(from) - days * DAY),
        new Date(Date.parse(from) - DAY),
      ),
    ]);
    return [...new Set([...now.keys(), ...before.keys()])].map((recipeId) => {
      const sold = now.get(recipeId) ?? 0;
      const prev = before.get(recipeId) ?? 0;
      return {
        recipeId,
        portionsSold: sold,
        previousPortionsSold: prev,
        trend: sold > prev ? 'up' : sold < prev ? 'down' : 'flat',
      };
    });
  }
}

export type ProfitLoss = Awaited<ReturnType<ReportService['profitLoss']>>;

function range(from: string, to: string) {
  return { gte: new Date(from), lte: new Date(to) };
}
