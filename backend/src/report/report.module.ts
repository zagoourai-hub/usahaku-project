import {
  BadRequestException,
  Controller,
  Get,
  Module,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import { CurrentBusiness } from '../auth/auth.guard.js';
import {
  QuotaExceededException,
  SubscriptionModule,
  UsageService,
} from '../subscription/subscription.module.js';
import { profitLossPdf, profitLossXlsx } from './report.export.js';
import { type Granularity, ReportService } from './report.service.js';

const MAX_RANGE_DAYS = 366;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class RangeQueryDto {
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  from: string;

  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  to: string;
}

export class SummaryQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity: Granularity = 'day';
}

export class ExportQueryDto extends RangeQueryDto {
  @IsIn(['pdf', 'xlsx'])
  format: 'pdf' | 'xlsx';
}

function assertRange({ from, to }: RangeQueryDto) {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days < 0) throw new BadRequestException('from harus <= to');
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Rentang maksimal ${MAX_RANGE_DAYS} hari`);
  }
}

@Controller('reports')
export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly usage: UsageService,
  ) {}

  @Get('summary')
  summary(@CurrentBusiness() businessId: string, @Query() q: SummaryQueryDto) {
    assertRange(q);
    return this.reports.summary(businessId, q.from, q.to, q.granularity);
  }

  @Get('profit-loss')
  profitLoss(@CurrentBusiness() businessId: string, @Query() q: RangeQueryDto) {
    assertRange(q);
    return this.reports.profitLoss(businessId, q.from, q.to);
  }

  @Get('recipe-sales')
  recipeSales(
    @CurrentBusiness() businessId: string,
    @Query() q: RangeQueryDto,
  ) {
    assertRange(q);
    return this.reports.recipeSales(businessId, q.from, q.to);
  }

  @Get('export')
  async export(
    @CurrentBusiness() businessId: string,
    @Query() q: ExportQueryDto,
  ) {
    assertRange(q);
    if (
      q.format === 'xlsx' &&
      !(await this.usage.limits(businessId)).excelExport
    ) {
      throw new QuotaExceededException('Export Excel hanya untuk paket PRO.');
    }
    const pl = await this.reports.profitLoss(businessId, q.from, q.to);
    const filename = `laba-rugi_${q.from}_${q.to}.${q.format}`;
    return q.format === 'pdf'
      ? new StreamableFile(await profitLossPdf(pl), {
          type: 'application/pdf',
          disposition: `attachment; filename="${filename}"`,
        })
      : new StreamableFile(await profitLossXlsx(pl), {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          disposition: `attachment; filename="${filename}"`,
        });
  }
}

@Module({
  imports: [SubscriptionModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
