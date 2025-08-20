import { Request } from 'express';
import { JwtTokenPayload } from 'src/auth/interfaces/jwt.token.payload';

export interface AppRequest extends Request {
  __context?: JwtTokenPayload;
}
