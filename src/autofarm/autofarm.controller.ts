import { Controller, Get, Param } from '@nestjs/common';
import { AutofarmService } from './autofarm.service';

@Controller('autofarm')
export class AutofarmController {
  constructor(private autofarmService: AutofarmService) {}

  @Get('cache/update')
  async updateCache() {
    return this.autofarmService.updateCache();
  }

  @Get(':address')
  async getAddressStakedBalances(@Param() params) {
    return this.autofarmService.getAddressStakedBalances(params.address);
  }
}
