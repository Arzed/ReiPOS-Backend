import { Module, Global } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AiModule } from '../ai/ai.module';

@Global()
@Module({
  imports: [AiModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
