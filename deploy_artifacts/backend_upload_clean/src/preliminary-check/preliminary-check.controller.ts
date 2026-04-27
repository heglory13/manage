import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { PreliminaryCheckService } from './preliminary-check.service.js';
import { CreatePreliminaryCheckDto, PreliminaryCheckQueryDto, CompletePreliminaryCheckDto } from './dto/index.js';

@Controller('preliminary-checks')
export class PreliminaryCheckController {
  constructor(private readonly preliminaryCheckService: PreliminaryCheckService) {}

  @Post()
  async create(
    @Body() dto: CreatePreliminaryCheckDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.preliminaryCheckService.create(dto, user.userId);
  }

  @Get()
  async findAll(@Query() query: PreliminaryCheckQueryDto) {
    return this.preliminaryCheckService.findAll({
      status: query.status,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.preliminaryCheckService.findOne(id);
  }

  @Patch(':id/complete')
  async complete(
    @Param('id') id: string,
    @Body() dto: CompletePreliminaryCheckDto,
  ) {
    return this.preliminaryCheckService.complete(id, dto.status);
  }
}
