import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter
  extends BaseWsExceptionFilter
  implements ExceptionFilter
{
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();
    handleWsException(client, exception);
  }
}

export function handleWsException(client: Socket, exception: any) {
  let message = 'Internal server error';

  if (exception instanceof WsException) {
    message = exception.getError() as string;
  } else if (exception instanceof Error) {
    message = exception.message;
  }

  if (message == 'token_expired') {
    client.emit('token.expired');
  } else {
    client.emit('error', { message });
  }
}
