import * as bcrypt from 'bcrypt';

export class HashUtil {
  private constructor() {}

  static async hashBcrypt(str: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(str, salt);
  }

  static async compareBcrypt(str: string, hash: string): Promise<boolean> {
    return bcrypt.compare(str, hash);
  }
}
