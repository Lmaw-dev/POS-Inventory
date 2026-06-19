import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.enableCors({
    origin:
      process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()) ?? [
        // Vite automatically tries the next port when 5173 is occupied.
        // Accept every loopback dev port so login does not break on 5174+.
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
      ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
