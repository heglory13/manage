import {
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Request } from 'express';
import { AppService } from './app.service';
import { Public } from './auth/decorators/index.js';

const uploadsDir = join(process.cwd(), 'uploads');

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth() {
    return { ok: true };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file, callback) => {
          const safeExt = extname(file.originalname) || '.bin';
          callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      req.protocol ||
      'http';
    const host = req.headers.host;
    const baseUrl = process.env.PUBLIC_API_URL?.replace(/\/+$/, '') || `${proto}://${host}`;
    return {
      url: `${baseUrl}/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
    };
  }
}
