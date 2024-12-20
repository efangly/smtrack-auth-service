import { Injectable } from '@nestjs/common';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { PrismaService } from '../prisma/prisma.service';
import { dateFormat } from '../common/utils';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class WardService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  async create(createWardDto: CreateWardDto) {
    createWardDto.createAt = dateFormat(new Date());
    createWardDto.updateAt = dateFormat(new Date());
    await this.redis.del("hospital");
    return this.prisma.wards.create({ data: createWardDto, include: { hospital: true } });
  }

  async findAll() {
    return this.prisma.wards.findMany({ include: { hospital: true } });
  }

  async findOne(id: string) {
    return this.prisma.wards.findUnique({ where: { id }, include: { hospital: true } });
  }

  async update(id: string, updateWardDto: UpdateWardDto) {
    updateWardDto.updateAt = dateFormat(new Date());
    await this.redis.del("hospital");
    return this.prisma.wards.update({ where: { id }, data: updateWardDto });
  }

  async remove(id: string) {
    await this.redis.del("hospital");
    return this.prisma.wards.delete({ where: { id } });
  }
}
