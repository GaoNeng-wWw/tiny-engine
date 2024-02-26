import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoginDTO, RegisterDTO } from './user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './user.schema';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { compareSync, hashSync } from 'bcryptjs';
import { isEmpty, pick } from 'ramda';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly UserModel: Model<User>,
    private readonly jwt: JwtService,
    @InjectRedis()
    private redis: Redis,
  ) {}
  async login(data: LoginDTO) {
    const { email, password } = data;
    const jwt = this.jwt.sign({ email });
    const userProfile = await this.UserModel.findOne({
      email,
    });
    if (
      !userProfile ||
      isEmpty(userProfile) ||
      !compareSync(password, userProfile.password)
    ) {
      throw new HttpException(``, HttpStatus.NOT_FOUND);
    }
    await this.redis.set(`token:${email}`, jwt);
    await this.redis.hmset(`profile:${email}`, userProfile.toJSON());
    return jwt;
  }
  async register(data: RegisterDTO) {
    const { email, password, nick } = data;
    const profile = this.UserModel.findOne({
      email,
    });
    if (!profile) {
      throw new HttpException('user exists', HttpStatus.BAD_REQUEST);
    }
    const date = new Date();
    const _password = hashSync(password, process.env.PWD_SALT);
    const userModel = new this.UserModel();
    userModel.email = email;
    userModel.password = _password;
    userModel.nick = nick;
    userModel.create_at = date.getTime();
    userModel.update_at = date.getTime();
    return userModel
      .save()
      .then((user) => user.toJSON())
      .catch((reason) => {
        throw new HttpException(reason, HttpStatus.BAD_REQUEST);
      });
  }
  async getProfile(email: string) {
    return this.UserModel.findOne({ email }).select('nick email');
  }
}
