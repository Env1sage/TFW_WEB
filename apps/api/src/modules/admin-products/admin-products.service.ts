import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AddColorDto } from './dto/add-color.dto';
import { AddPrintAreaDto } from './dto/add-print-area.dto';

@Injectable()
export class AdminProductsService {
  constructor(private prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async getAll() {
    return this.prisma.product.findMany({
      include: {
        colors: { include: { mockups: true } },
        printAreas: true,
      },
    });
  }

  async getBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        colors: { include: { mockups: true } },
        printAreas: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        colors: { include: { mockups: true } },
        printAreas: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async addColor(productId: string, dto: AddColorDto) {
    await this.getById(productId);
    return this.prisma.productColor.create({
      data: { ...dto, productId },
    });
  }

  async addPrintArea(productId: string, dto: AddPrintAreaDto) {
    await this.getById(productId);
    return this.prisma.printArea.create({
      data: {
        side: dto.side as any,
        width: dto.width,
        height: dto.height,
        xPosition: dto.xPosition,
        yPosition: dto.yPosition,
        safeZone: dto.safeZone,
        bleed: dto.bleed,
        additionalPrice: dto.additionalPrice,
        realWidthInches: dto.realWidthInches,
        realHeightInches: dto.realHeightInches,
        productId,
      },
    });
  }

  async uploadMockup(colorId: string, side: string, imageUrl: string) {
    const color = await this.prisma.productColor.findUnique({ where: { id: colorId } });
    if (!color) throw new NotFoundException('Color not found');
    const existing = await this.prisma.mockupImage.findFirst({
      where: { colorId, side: side as any },
    });
    if (existing) {
      return this.prisma.mockupImage.update({
        where: { id: existing.id },
        data: { imageUrl },
      });
    }
    return this.prisma.mockupImage.create({
      data: { side: side as any, imageUrl, colorId },
    });
  }
}
