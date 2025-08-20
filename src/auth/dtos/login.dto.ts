import { Transform } from 'class-transformer';
import { IsString, Matches, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(4, 20)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message:
      'Username can only contain uppercase letters, lowercase letters, numbers, and underscores.',
  })
  @Transform(({ value }) => (value as string).trim())
  username: string;

  @IsString()
  @Length(8, 20)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      'Password must contain at least one letter, one number, and one special character.',
  })
  password: string;
}
