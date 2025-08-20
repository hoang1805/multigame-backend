import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LoginDto } from './login.dto';
import { Transform } from 'class-transformer';

export class RegisterDto extends LoginDto {
  @IsEmail()
  @Transform(({ value }) => (value as string).trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  rePassword: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value as string).trim())
  @MaxLength(30)
  nickname?: string;
}
