import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ResponseService } from 'src/common/services/response-service';
import { SdkService } from './sdk.service';
import { EvaluateDto } from './dto/evaluate.dto';
import type { Request } from 'express';

@Public()
@UseGuards(ApiKeyGuard)
@Controller('sdk')
export class SdkController {
  constructor(
    private readonly sdkService: SdkService,
    private readonly responseService: ResponseService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('evaluate')
  async evaluate(@Body() dto: EvaluateDto, @Req() req: Request) {
    const result = await this.sdkService.evaluate(
      dto,
      (req as any).sdkEnvironment,
    );
    return this.responseService.success(result, 'Flag evaluated');
  }
}

//   "eventId": "hashEventId", // hash(userId + flagKey + eventType + sessionId + sequenceNumber)
