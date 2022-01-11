import { LpTokenAutofarmPool, SingleTokenAutofarmPool } from 'src/interface';

export class UpdateCacheDto {
  pools: Array<SingleTokenAutofarmPool | LpTokenAutofarmPool>;
}
