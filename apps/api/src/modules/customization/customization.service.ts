import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDesignDto } from './dto/create-design.dto';
import { AddDesignSideDto } from './dto/add-design-side.dto';

@Injectable()
export class CustomizationService {
  constructor(private prisma: PrismaService) {}

  async createDesign(dto: CreateDesignDto, userId?: string) {
    return this.prisma.design.create({
      data: {
        name: dto.name,
        productId: dto.productId,
        userId: userId ?? null,
      },
    });
  }

  async addDesignSide(designId: string, dto: AddDesignSideDto) {
    return this.prisma.designSide.create({
      data: {
        designId,
        side: dto.side,
        canvasWidth: dto.canvasWidth,
        canvasHeight: dto.canvasHeight,
        jsonData: dto.jsonData,
        previewImagePath: null,
        dpi: dto.dpi ?? null,
      },
    });
  }

  async getDesign(designId: string) {
    return this.prisma.design.findUnique({
      where: { id: designId },
      include: { sides: true },
    });
  }
}
