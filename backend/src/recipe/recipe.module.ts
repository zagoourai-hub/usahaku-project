import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { SubscriptionModule } from '../subscription/subscription.module.js';
import { CreateRecipeDto, UpdateRecipeDto } from './recipe.dto.js';
import { RecipeService } from './recipe.service.js';

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipes: RecipeService) {}

  @Get()
  list(@CurrentBusiness() businessId: string, @Query('q') q?: string) {
    return this.recipes.list(businessId, q?.slice(0, 100));
  }

  @Get(':id')
  get(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recipes.get(businessId, id);
  }

  @Get(':id/hpp-history')
  history(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recipes.history(businessId, id);
  }

  @Post()
  create(@CurrentBusiness() businessId: string, @Body() dto: CreateRecipeDto) {
    return this.recipes.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.recipes.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recipes.remove(businessId, id);
  }
}

@Module({
  imports: [SubscriptionModule],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}
