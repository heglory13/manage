"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const helmet_1 = __importDefault(require("helmet"));
const path_1 = require("path");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    app.use((0, helmet_1.default)());
    app.enableCors({
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.useStaticAssets((0, path_1.join)(process.cwd(), 'uploads'), {
        prefix: '/uploads',
    });
    await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
//# sourceMappingURL=main.js.map