import { Module } from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { ValidationsController } from './validations.controller';
import { ReceiptsModule } from '../receipts/receipts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ReceiptsModule, NotificationsModule],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}
