import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Users } from '@prisma/client';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtPayloadDto } from './dto/payload.dto';
import { ResetPasswordDto } from './dto/reset.dto';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService, 
    private readonly userService: UserService,
    private readonly redis: RedisService
  ) {}

  async register(data: CreateUserDto, file: Express.Multer.File) {
    const existingUser = await this.userService.findByUsername(data.username.toLowerCase());
    if (existingUser) throw new BadRequestException('Username already exists');
    if (file) {
      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, file.originalname);
      const response = await axios.post(`${process.env.UPLOAD_PATH}/api/image/user`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!response.data || !response.data.path) {
        throw new BadRequestException('Failed to upload image');
      }
      data.pic = `${process.env.UPLOAD_PATH}/${response.data.path}`;
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    data.password = hashedPassword;
    return this.userService.create(data);
  }

  async validateUser(username: string, password: string) {
    const user = await this.userService.findByUsername(username);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: Users | any) {
    const payload = { id: user.id, name: user.display, role: user.role, hosId: user.ward.hosId, wardId: user.wardId };
    return {
      token: this.jwtService.sign(payload, { secret: process.env.JWT_SECRET, expiresIn: String(process.env.EXPIRE_TIME) }),
      refreshToken: this.jwtService.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: String(process.env.REFRESH_EXPIRE_TIME) }),
      id: user.id,
      name: user.display,
      hosId: user.ward.hosId,
      wardId: user.wardId,
      role: user.role,
      pic: user.pic,
    };
  }

  refreshTokens(token: string) {
    const decode = this.jwtService.verify<JwtPayloadDto>(token, { secret: process.env.JWT_REFRESH_SECRET });
    const payload = { id: decode.id, name: decode.name, role: decode.role, hosId: decode.hosId, wardId: decode.wardId };
    return {
      token: this.jwtService.sign(payload, { secret: process.env.JWT_SECRET, expiresIn: String(process.env.EXPIRE_TIME) }),
      refreshToken: this.jwtService.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: String(process.env.REFRESH_EXPIRE_TIME) }),
    };
  }

  async resetPassword(username: string, body: ResetPasswordDto, user: JwtPayloadDto) {
    const result = await this.userService.findByUsername(username);
    if (!result) throw new BadRequestException('User not found!!');
    if (user.role !== "SUPER") {
      if (!body.oldPassword) throw new BadRequestException('User not have password!!');
      const match = await bcrypt.compare(body.oldPassword, result.password);
      if (!match) throw new BadRequestException('Old password not match!!');
    }
    await this.userService.update(result.id, { password: await bcrypt.hash(body.password, 10) });
    await this.redis.del(`user:${username}`);
    await this.redis.del(`user:${result.id}`);
    return 'Reset password success!!';
  }
}
