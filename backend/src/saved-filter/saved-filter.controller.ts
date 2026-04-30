import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { SavedFilterService } from './saved-filter.service.js';
import { CreateSavedFilterDto } from './dto/index.js';

@Controller('saved-filters')
export class SavedFilterController {
  constructor(private readonly savedFilterService: SavedFilterService) {}

  @Get()
  async findAll(
    @CurrentUser() user: UserPayload,
    @Query('pageKey') pageKey: string,
  ) {
    return this.savedFilterService.findAll(user.userId, pageKey);
  }

  @Post()
  async create(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateSavedFilterDto,
  ) {
    return this.savedFilterService.create(user.userId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.savedFilterService.delete(id, user.userId);
    return { message: 'Đã xóa bộ lọc' };
  }
}
