import type { Request } from 'express';
import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    getHealth(): {
        ok: boolean;
    };
    uploadFile(file: Express.Multer.File, req: Request): {
        url: string;
        filename: string;
        originalName: string;
        size: number;
    };
}
