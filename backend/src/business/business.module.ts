import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Patch,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { BusinessType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IsMoney, Trim } from '../dto.decorators.js';

export class UpdateBusinessDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(BusinessType)
  type?: BusinessType;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  city?: string;

  /** null clears the target. */
  @IsOptional()
  @IsMoney()
  dailyProfitTarget?: number | null;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 60)
  branchLabel?: string;
}

const select = {
  id: true,
  name: true,
  type: true,
  city: true,
  dailyProfitTarget: true,
  branchLabel: true,
  user: { select: { name: true, email: true } },
} as const;

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  get(businessId: string) {
    return this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select,
    });
  }

  update(businessId: string, dto: UpdateBusinessDto) {
    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: dto.name,
        type: dto.type,
        city: dto.city === '' ? null : dto.city,
        dailyProfitTarget: dto.dailyProfitTarget,
        branchLabel: dto.branchLabel === '' ? null : dto.branchLabel,
      },
      select,
    });
  }
}

@Controller('business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get('me')
  me(@CurrentBusiness() businessId: string) {
    return this.business.get(businessId);
  }

  @Patch('me')
  update(
    @CurrentBusiness() businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.business.update(businessId, dto);
  }
}

@Module({ controllers: [BusinessController], providers: [BusinessService] })
export class BusinessModule {}
