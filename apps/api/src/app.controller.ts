import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('api/health')
  getHealth() {
    return { status: 'API running', timestamp: new Date().toISOString() };
  }
}
