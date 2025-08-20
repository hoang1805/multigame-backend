import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

function _initPipes(app: INestApplication<any>) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}

function _initFilters(app: INestApplication<any>) {
  app.useGlobalFilters(new HttpExceptionFilter());
}

function _initInterceptors(app: INestApplication<any>) {
  app.useGlobalInterceptors(new LoggingInterceptor());
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  _initPipes(app);
  _initFilters(app);
  _initInterceptors(app);

  app.enableCors({
    origin: 'http://localhost:5175', // hoặc '*' nếu muốn mở cho tất cả
    credentials: true, // nếu cần gửi cookie/token
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
