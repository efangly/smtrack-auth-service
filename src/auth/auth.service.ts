import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Users } from '@prisma/client';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtPayloadDto } from './dto/payload.dto';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from './dto/reset.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService, private readonly userService: UserService) { }

  async register(data: CreateUserDto, file: Express.Multer.File) {
    const existingUser = await this.userService.findByUsername(data.username);
    if (existingUser) throw new BadRequestException('Username already exists');
    if (file) {
      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('path', 'users');
      formData.append('file', blob, file.originalname);
      const response = await axios.post(`${process.env.UPLOAD_PATH}/api/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!response.data || !response.data.filePath) {
        throw new BadRequestException('Failed to upload image');
      }
      data.pic = `${process.env.UPLOAD_PATH}/${response.data.filePath}`;
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
    const payload = { id: user.id, role: user.role, hosId: user.ward.hosId, wardId: user.wardId };
    return {
      token: this.jwtService.sign(payload, { secret: process.env.JWT_SECRET, expiresIn: String(process.env.EXPIRE_TIME) }),
      refreshToken: this.jwtService.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: String(process.env.REFRESH_EXPIRE_TIME) }),
      id: user.id,
      hosId: user.ward.hosId,
      wardId: user.wardId,
      role: user.userLevel
    };
  }

  refreshTokens(token: string) {
    const decode = this.jwtService.verify<JwtPayloadDto>(token, { secret: process.env.JWT_REFRESH_SECRET });
    const payload = { id: decode.id, role: decode.role, hosId: decode.hosId, wardId: decode.wardId };
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
    return 'Reset password success!!';
  }
}
