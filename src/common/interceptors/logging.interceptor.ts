import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { LogUtil } from '../utils/log.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const now = Date.now();

    const method = request.method;
    const url = request.originalUrl;

    return next.handle().pipe(
      tap(() => {
        LogUtil.info('Successfully', {
          method: method,
          url: url,
          time: Date.now() - now,
          status: response.statusCode,
        });
      }),
      catchError((error: Error) => {
        const _error =
          error instanceof HttpException
            ? error
            : new HttpException(
                error.message ?? 'An unexpected error occurred.',
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
        const exceptionResponse: string | object = _error.getResponse();
        const message =
          typeof exceptionResponse == 'string'
            ? exceptionResponse
            : (exceptionResponse as Record<string, any>).message ||
              'An unexpected error occurred.';
        LogUtil.error(Array.isArray(message) ? message[0] : message, {
          method: method,
          url: url,
          time: Date.now() - now,
          status: _error.getStatus(),
        });

        return throwError(() => _error);
      }),
    );
  }
}
