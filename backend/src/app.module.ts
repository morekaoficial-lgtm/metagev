import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ImportanceLevelsModule } from './modules/importance-levels/importance-levels.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { ObjectivesModule } from './modules/objectives/objectives.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { ValidationsModule } from './modules/validations/validations.module';
import { ResultsModule } from './modules/results/results.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    ImportanceLevelsModule,
    PeriodsModule,
    ObjectivesModule,
    EvaluationsModule,
    ValidationsModule,
    ResultsModule,
    ReceiptsModule,
    AnalyticsModule,
    NotificationsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
