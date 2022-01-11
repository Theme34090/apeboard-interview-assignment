import { Module } from '@nestjs/common';
import { AutofarmService } from './autofarm.service';
import { AutofarmController } from './autofarm.controller';

@Module({
  providers: [AutofarmService],
  controllers: [AutofarmController]
})
export class AutofarmModule {}
