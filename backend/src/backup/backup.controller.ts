import { Controller, Get, Res } from '@nestjs/common';
import { Role } from '@prisma/client/index';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/index.js';
import { BackupService } from './backup.service.js';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('database')
  @Roles(Role.ADMIN, Role.MANAGER)
  async exportDatabase(@Res() res: Response) {
    const payload = await this.backupService.exportDatabase();
    const filename = `backup-database-${new Date().toISOString().slice(0, 10)}.json`;
    const json = JSON.stringify(payload, null, 2);

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(json, 'utf8').toString(),
    });

    res.end(json);
  }
}
