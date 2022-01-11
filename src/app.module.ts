import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AutofarmModule } from './autofarm/autofarm.module';

@Module({
  imports: [AutofarmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
