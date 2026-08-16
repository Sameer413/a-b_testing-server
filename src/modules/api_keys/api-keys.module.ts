import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api.key.entity';
import { Environment } from '../project/entities/environment.entity';
import { CommonModule } from 'src/common/common.module';
import { ProjectModule } from '../project/project.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, Environment]),
    CommonModule,
    ProjectModule,
  ],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService, TypeOrmModule],
})
export class ApiKeysModule {}
