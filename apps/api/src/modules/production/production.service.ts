import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StaticCanvas,
  FabricImage,
  FabricText,
  Rect,
  Circle,
  Ellipse,
  Triangle,
  Line,
  Path,
  Polygon,
  Polyline,
  Group,
  IText,
  Textbox,
  classRegistry,
  FabricObject,
} from 'fabric/node';
import * as fs from 'fs';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';

// Register all Fabric classes for loadFromJSON deserialization
[FabricText, Rect, Circle, Ellipse, Triangle, Line, Path, Polygon, Polyline, Group, IText, Textbox, FabricImage].forEach((cls) => {
  classRegistry.setClass(cls);
});

const DPI = 300;
const PRODUCTION_DIR = path.join(process.cwd(), 'production-files');

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(PRODUCTION_DIR)) {
      fs.mkdirSync(PRODUCTION_DIR, { recursive: true });
    }
  }

  async generateOrderFiles(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const orderDir = path.join(PRODUCTION_DIR, order.orderNumber);
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }

    const files: { itemId: string; side: string; filePath: string; widthPx: number; heightPx: number }[] = [];

    for (const item of order.items) {
      const itemFiles = await this.generateItemFiles(item, orderDir);
      files.push(...itemFiles);
    }

    // Generate combined PDF
    const pdfPath = await this.generateOrderPdf(order.orderNumber, orderDir, files);

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      files: files.map((f) => ({
        itemId: f.itemId,
        side: f.side,
        widthPx: f.widthPx,
        heightPx: f.heightPx,
        filePath: path.relative(PRODUCTION_DIR, f.filePath),
      })),
      pdfPath: path.relative(PRODUCTION_DIR, pdfPath),
    };
  }

  private async generateItemFiles(
    item: { id: string; productId: string; sides: unknown; designData: unknown },
    orderDir: string,
  ) {
    const sides = item.sides as string[];
    const designData = item.designData as Record<string, unknown>;
    const results: { itemId: string; side: string; filePath: string; widthPx: number; heightPx: number }[] = [];

    for (const side of sides) {
      const sideJson = designData[side];
      if (!sideJson) {
        this.logger.warn(`No design data for side ${side} in item ${item.id}`);
        continue;
      }

      const printArea = await this.prisma.printArea.findFirst({
        where: { productId: item.productId, side: side as any },
      });

      if (!printArea) {
        this.logger.warn(`No print area for side ${side}, product ${item.productId}`);
        continue;
      }

      // Calculate production dimensions at 300 DPI
      const widthPx = Math.round(printArea.realWidthInches * DPI);
      const heightPx = Math.round(printArea.realHeightInches * DPI);

      // Scale factor: production pixels / preview pixels
      const scaleX = widthPx / printArea.width;
      const scaleY = heightPx / printArea.height;

      const pngBuffer = await this.renderSide(sideJson as object, widthPx, heightPx, scaleX, scaleY, printArea);
      const filePath = path.join(orderDir, `${item.id}-${side}.png`);
      fs.writeFileSync(filePath, pngBuffer);

      this.logger.log(`Generated ${side} for item ${item.id}: ${widthPx}x${heightPx}px @ ${DPI}DPI`);
      results.push({ itemId: item.id, side, filePath, widthPx, heightPx });
    }

    return results;
  }

  private async renderSide(
    sideJson: object,
    widthPx: number,
    heightPx: number,
    scaleX: number,
    scaleY: number,
    printArea: { xPosition: number; yPosition: number; width: number; height: number; bleed: number },
  ): Promise<Buffer> {
    const canvas = new StaticCanvas(undefined, {
      width: widthPx,
      height: heightPx,
      backgroundColor: 'transparent',
    });

    // Load the design JSON into a temporary canvas at original size
    const tempCanvas = new StaticCanvas(undefined, {
      width: 800,
      height: 1000,
    });

    await tempCanvas.loadFromJSON(sideJson);
    tempCanvas.renderAll();

    // Extract only user objects (skip guides named __bleed, __safeZone, etc.)
    const userObjects = tempCanvas.getObjects().filter((obj: FabricObject) => {
      const name = (obj as FabricObject & { name?: string }).name;
      return !name || !name.startsWith('__');
    });

    // Reposition and scale each user object from preview space → production space
    for (const obj of userObjects) {
      const cloneObj = await obj.clone();

      // Offset: objects on preview canvas are positioned relative to canvas origin,
      // but print area starts at (xPosition, yPosition). Subtract that offset.
      const newLeft = (cloneObj.left - printArea.xPosition) * scaleX;
      const newTop = (cloneObj.top - printArea.yPosition) * scaleY;

      cloneObj.set({
        left: newLeft,
        top: newTop,
        scaleX: (cloneObj.scaleX ?? 1) * scaleX,
        scaleY: (cloneObj.scaleY ?? 1) * scaleY,
      });

      canvas.add(cloneObj);
    }

    canvas.renderAll();

    // Export PNG buffer
    const nodeCanvas = (canvas as any).getNodeCanvas();
    const buffer = nodeCanvas.toBuffer('image/png');

    canvas.dispose();
    tempCanvas.dispose();

    return buffer;
  }

  private async generateOrderPdf(
    orderNumber: string,
    orderDir: string,
    files: { itemId: string; side: string; filePath: string; widthPx: number; heightPx: number }[],
  ): Promise<string> {
    const pdfPath = path.join(orderDir, `${orderNumber}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      for (const file of files) {
        // Page size in points (72 points per inch)
        const pageWidthPt = (file.widthPx / DPI) * 72;
        const pageHeightPt = (file.heightPx / DPI) * 72;

        doc.addPage({
          size: [pageWidthPt, pageHeightPt],
          margin: 0,
        });

        // Add label
        doc.fontSize(8).text(`Item: ${file.itemId} | Side: ${file.side}`, 5, 5);

        // Embed the PNG image, fit to page
        if (fs.existsSync(file.filePath)) {
          doc.image(file.filePath, 0, 0, {
            width: pageWidthPt,
            height: pageHeightPt,
          });
        }
      }

      doc.end();

      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    });
  }

  async getOrderFiles(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException('Order not found');

    const orderDir = path.join(PRODUCTION_DIR, order.orderNumber);
    if (!fs.existsSync(orderDir)) {
      return { orderNumber: order.orderNumber, files: [], generated: false };
    }

    const dirFiles = fs.readdirSync(orderDir);
    return {
      orderNumber: order.orderNumber,
      generated: true,
      files: dirFiles.map((f) => ({
        filename: f,
        path: `${order.orderNumber}/${f}`,
      })),
    };
  }
}
