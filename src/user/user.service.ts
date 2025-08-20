import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './models/user';
import { InjectRepository } from '@nestjs/typeorm';
import { HashUtil } from 'src/common/utils/hash.util';
import { UpdateUserDto } from './dtos/update.user.dto';
import { ChangePasswordDto } from './dtos/change.password.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async getAll() {
    return await this.userRepository.find();
  }

  async createUser(
    username: string,
    password: string,
    email: string,
    nickname?: string,
  ): Promise<User> {
    if (await this.existByUsername(username)) {
      throw new BadRequestException('Username has already exists');
    }

    if (await this.existByEmail(email)) {
      throw new BadRequestException('Email has already exists');
    }

    const user = this.userRepository.create({
      username,
      password: await HashUtil.hashBcrypt(password),
      email,
      nickname: nickname ?? username,
    });

    return this.userRepository.save(user);
  }

  async getById(id: number): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async existById(id: number): Promise<boolean> {
    return this.userRepository.existsBy({ id });
  }

  async getByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { username } });
  }

  async existByEmail(email: string): Promise<boolean> {
    return this.userRepository.exists({ where: { email } });
  }

  async existByUsername(username: string): Promise<boolean> {
    return this.userRepository.exists({ where: { username } });
  }

  async updateUser(id: number, data: UpdateUserDto): Promise<User> {
    const user = await this.getById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.email && user.email != data.email) {
      const isExist = await this.existByEmail(data.email);
      if (!isExist) {
        throw new BadRequestException('Email has already exists');
      }
    }

    if (!data.nickname) {
      data.nickname = user.username;
    }

    Object.assign(user, data);

    return this.userRepository.save(user);
  }

  async changePassword(
    id: number | null | undefined,
    data: ChangePasswordDto,
  ): Promise<User> {
    const user = id ? await this.getById(id) : null;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const authorized = await HashUtil.compareBcrypt(
      data.password,
      user.password,
    );

    if (!authorized) {
      throw new BadRequestException('Invalid password. Please try again');
    }

    if (data.newPassword != data.reNewPassword) {
      throw new BadRequestException(
        'Repeat new password does not match. Please try again',
      );
    }

    user.password = await HashUtil.hashBcrypt(data.newPassword);
    return this.userRepository.save(user);
  }
}
