import { HttpStatus } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

export class LogUtil {
  private static readonly logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      }),
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
      new transports.File({ filename: 'logs/all.log' }),
    ],
  });

  private constructor() {}

  static info(message: string, info?: _HttpInfo) {
    this.logger.info(this._getMessage(message, info));
  }

  static error(message: string, info?: _HttpInfo) {
    this.logger.error(this._getMessage(message, info));
  }

  private static _getMessage(message: string, info?: _HttpInfo): string {
    if (info) {
      return `${info.method} ${info.url} ${info.status} - ${info.time}ms - ${message}`;
    }

    return message;
  }
}

interface _RequestInfo {
  method: string;
  url: string;
}

interface _ResponseInfo {
  time: number;
  status: HttpStatus;
}

interface _HttpInfo extends _RequestInfo, _ResponseInfo {}
