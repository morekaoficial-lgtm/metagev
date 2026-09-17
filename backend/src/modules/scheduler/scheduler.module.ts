import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ReceiptsModule } from '../receipts/receipts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ReceiptsModule, NotificationsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
