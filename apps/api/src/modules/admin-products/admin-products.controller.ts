import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AddColorDto } from './dto/add-color.dto';
import { AddPrintAreaDto } from './dto/add-print-area.dto';

const UPLOAD_DIR = join(__dirname, '..', '..', '..', 'uploads');

@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly service: AdminProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  @Post(':productId/colors')
  addColor(@Param('productId') productId: string, @Body() dto: AddColorDto) {
    return this.service.addColor(productId, dto);
  }

  @Post(':productId/print-areas')
  addPrintArea(@Param('productId') productId: string, @Body() dto: AddPrintAreaDto) {
    return this.service.addPrintArea(productId, dto);
  }

  @Post('colors/:colorId/mockup')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(svg|png|jpg|jpeg|webp)$/i;
        if (!allowed.test(extname(file.originalname))) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  uploadMockup(
    @Param('colorId') colorId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('side') side: string,
  ) {
    const imageUrl = `/uploads/${file.filename}`;
    return this.service.uploadMockup(colorId, side, imageUrl);
  }
}
