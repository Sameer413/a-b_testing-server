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
import { ApiKeyGuard } from '../sdk/guards/api-key.guard';
import { ResponseService } from 'src/common/services/response-service';
import { TrackingService } from './tracking.service';
import { BatchTrackEventsDto, TrackEventDto } from './dto/track-event.dto';
import type { Request } from 'express';

@Public()
@UseGuards(ApiKeyGuard)
@Controller('sdk')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly responseService: ResponseService,
  ) {}

  /**
   * POST /sdk/track
   * Ingest a single event from the SDK.
   */
  @HttpCode(HttpStatus.OK)
  @Post('track')
  async track(@Body() dto: TrackEventDto, @Req() req: Request) {
    const result = await this.trackingService.trackEvent(
      dto,
      (req as any).sdkEnvironment,
    );
    return this.responseService.success(result, 'Event tracked');
  }

  /**
   * POST /sdk/track/batch
   * Ingest a batch of events (max 500) from the SDK.
   */
  @HttpCode(HttpStatus.OK)
  @Post('track/batch')
  async trackBatch(@Body() dto: BatchTrackEventsDto, @Req() req: Request) {
    const result = await this.trackingService.trackBatch(
      dto,
      (req as any).sdkEnvironment,
    );
    return this.responseService.success(result, 'Batch tracked');
  }
}
