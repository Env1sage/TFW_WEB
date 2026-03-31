import { Controller, Post, Get, Param, Res } from '@nestjs/common';
import { ProductionService } from './production.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

const PRODUCTION_DIR = path.join(process.cwd(), 'production-files');

@Controller('production')
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  @Post(':orderId/generate')
  generate(@Param('orderId') orderId: string) {
    return this.service.generateOrderFiles(orderId);
  }

  @Get(':orderId/files')
  getFiles(@Param('orderId') orderId: string) {
    return this.service.getOrderFiles(orderId);
  }

  @Get(':orderId/download/:filename')
  async download(
    @Param('orderId') orderId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const files = await this.service.getOrderFiles(orderId);
    if (!files.generated) {
      return res.status(404).json({ message: 'No production files found' });
    }

    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(PRODUCTION_DIR, files.orderNumber, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const ext = path.extname(safeName).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : 'image/png';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    fs.createReadStream(filePath).pipe(res);
  }
}
