import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { AuthModule } from 'src/auth/auth.module';
import { WsAuthGuard } from './guards/ws.auth.guard';

@Global()
@Module({
  imports: [AuthModule],
  providers: [AuthGuard, WsAuthGuard],
  exports: [AuthGuard, WsAuthGuard],
})
export class CommonModule {}
