import { FarmInfo } from 'src/types';

export class UpdateCacheDto {
  pools: Array<FarmInfo>;
}

export class AddressBalancesDto {
  farms: {
    tokens: Array<{ address: string; balance: string }>;
    balance: string;
    rewards: Array<{ address: string; balance: string }>;
    lpAddress?: string;
  };
}
