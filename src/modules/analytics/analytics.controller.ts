import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ResponseService } from 'src/common/services/response-service';


@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
    private readonly responseService: ResponseService,
  ) {}
  /**
   * GET /analytics/experiments/:experimentId/results
   * Returns full statistical results for the given experiment.
   */
  @Get('experiments/:experimentId/results')
  @UseGuards(JwtAuthGuard)
  async getResults(@Param('experimentId') experimentId: string) {
    const results =
      await this.analyticsService.getExperimentResults(experimentId);
    return this.responseService.success(
      results,
      'Experiment results fetched successfully',
    );
  }
}
