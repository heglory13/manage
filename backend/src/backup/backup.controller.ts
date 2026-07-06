import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client/index';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
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

  @Get('full')
  @Roles(Role.ADMIN, Role.MANAGER)
  async exportFull(@Res() res: Response) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `backup-full-${date}.zip`;

      const archive = await this.backupService.createFullBackupArchive();

      archive.on('error', (err: Error) => {
        console.error('[Backup] Archive stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Lỗi tạo file backup' });
        }
      });

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });

      // pipe() MUST come before finalize()
      archive.pipe(res);
      await archive.finalize();
    } catch (err) {
      console.error('[Backup] Export error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Không thể tạo backup lúc này' });
      }
    }
  }

  @Get('sku-search')
  @Roles(Role.ADMIN)
  searchSkus(@Query('q') q: string) {
    return this.backupService.searchSkusForAdmin(q ?? '');
  }

  @Post('delete-sku-data')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  async deleteSkuData(@Body() body: { skuComboIds?: string[] }) {
    if (!Array.isArray(body?.skuComboIds) || !body.skuComboIds.length) {
      throw new BadRequestException('Vui lòng chọn ít nhất một sản phẩm');
    }
    const result = await this.backupService.deleteSkuData(body.skuComboIds);
    return {
      message: `Đã xóa ${result.deletedTransactions} giao dịch`,
      ...result,
    };
  }

  @Post('reset-test-data')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  async resetTestData(@Body() body: { confirm?: string }) {
    if (body?.confirm !== 'XOA DU LIEU') {
      throw new BadRequestException('Xác nhận không hợp lệ');
    }
    const result = await this.backupService.resetTestData();
    return {
      message: 'Đã xóa toàn bộ dữ liệu giao dịch thành công',
      ...result,
    };
  }

  @Post('restore-files')
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'application/zip' ||
          file.originalname.endsWith('.zip')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Chỉ chấp nhận file .zip'), false);
        }
      },
    }),
  )
  async restoreFiles(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file backup .zip');
    const result = await this.backupService.restoreFilesFromZip(file.buffer);
    return {
      message: `Khôi phục thành công ${result.restored.length} file`,
      restored: result.restored,
    };
  }
}
