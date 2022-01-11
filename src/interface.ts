export interface AutofarmPool {
  poolId: number;
  rewardAddress: string;
  rewardSymbol: string;
  rewardDecimals: string;
}

export interface SingleToken {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

export interface LpToken {
  lpAddress: string;
  token0Address: string;
  token0Symbol: string;
  token0Decimals: number;
  token1Address: string;
  token1Symbol: string;
  token1Decimals: number;
}

export interface SingleTokenAutofarmPool extends AutofarmPool, SingleToken {}

export interface LpTokenAutofarmPool extends AutofarmPool, LpToken {}
