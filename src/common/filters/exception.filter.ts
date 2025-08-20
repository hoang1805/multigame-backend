import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse: string | object = exception.getResponse();
    const message =
      typeof exceptionResponse == 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, any>).message ||
          'An unexpected error occurred.';

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
    });
  }
}
