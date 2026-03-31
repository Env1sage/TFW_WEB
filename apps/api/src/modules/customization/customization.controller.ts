import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { CustomizationService } from './customization.service';
import { CreateDesignDto } from './dto/create-design.dto';
import { AddDesignSideDto } from './dto/add-design-side.dto';

@Controller('designs')
export class CustomizationController {
  constructor(private readonly service: CustomizationService) {}

  @Post()
  create(@Body() dto: CreateDesignDto) {
    return this.service.createDesign(dto);
  }

  @Post(':id/sides')
  addSide(@Param('id') id: string, @Body() dto: AddDesignSideDto) {
    return this.service.addDesignSide(id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getDesign(id);
  }
}
