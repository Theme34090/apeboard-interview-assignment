import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  ADDRESS_MASTERCHEF,
  BSC_RPC_ENDPOINT,
  CONCURRENT_NUM,
} from 'src/constants';
import { FarmInfo } from 'src/types';
import * as masterchefABI from '../abis/masterchef.json';
import * as pancakePairABI from '../abis/pancakePair.json';
import { AddressBalancesDto, UpdateCacheDto } from './autofarm.dto';
// import * as cache from '../cache.json';

@Injectable()
export class AutofarmService {
  private provider: ethers.providers.JsonRpcProvider;
  private masterchefContract: ethers.Contract;
  private cachedData: Array<FarmInfo>;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(BSC_RPC_ENDPOINT);
    this.masterchefContract = new ethers.Contract(
      ADDRESS_MASTERCHEF,
      masterchefABI,
      this.provider,
    );
    this.cachedData = [];
  }

  private async getPoolLength(): Promise<number> {
    return (await this.masterchefContract.poolLength()).toNumber();
  }

  private async fetchFarmInfo(poolId: number): Promise<FarmInfo> {
    const res = await this.masterchefContract.poolInfo(poolId);
    const tokenInfo = { wantTokenAddress: res.want };
    let isLp = true;
    try {
      const token = new ethers.Contract(
        res.want,
        pancakePairABI,
        this.provider,
      );
      const token0Address = await token.token0();
      const token1Address = await token.token1();
      tokenInfo['token0Address'] = token0Address;
      tokenInfo['token1Address'] = token1Address;
    } catch (err) {
      if (err.code && err.code === 'CALL_EXCEPTION') {
        isLp = false;
      } else {
        throw err;
      }
    }

    return { poolId: poolId, isLp, ...tokenInfo };
  }

  async updateCache(): Promise<UpdateCacheDto> {
    this.cachedData = [];
    const poolLength = await this.getPoolLength();
    console.log('poolLength', poolLength);

    for (let i = 0; i < Math.ceil(poolLength / CONCURRENT_NUM); i++) {
      const funcArray: Array<Promise<FarmInfo>> = [];
      for (let j = i * CONCURRENT_NUM; j < (i + 1) * CONCURRENT_NUM; j++) {
        if (j >= poolLength || j < 1) continue;
        funcArray.push(this.fetchFarmInfo(j));
      }
      const res = await Promise.all(funcArray);
      res.forEach((x) => {
        this.cachedData.push(x);
        console.log(x);
      });
    }

    return { pools: this.cachedData };
    // this.cachedData = cache.cache;
  }

  private async fetchStakedAndRewardBalance(
    poolId: number,
    address: string,
  ): Promise<{
    stakedBalance: ethers.BigNumber;
    rewardBalance: ethers.BigNumber;
  }> {
    try {
      const stakedBalance = await this.masterchefContract.stakedWantTokens(
        poolId,
        address,
      );
      const rewardBalance = await this.masterchefContract.pendingAUTO(
        poolId,
        address,
      );
      console.log(
        `poolId: ${poolId} | stakedBalance: ${stakedBalance}, rewardBalance: ${rewardBalance}`,
      );

      return { stakedBalance, rewardBalance };
    } catch (err) {
      console.log('error at poolId: ', poolId);
      console.log(err);
      // gracefully handle unknown error
      return {
        stakedBalance: ethers.BigNumber.from(0),
        rewardBalance: ethers.BigNumber.from(0),
      };
    }
  }

  private async processBalanceResult(
    farmInfo: FarmInfo,
    stakedBalance: ethers.BigNumber,
    rewardBalance: ethers.BigNumber,
  ): Promise<{
    tokens: Array<{ address: string; balance: string }>;
    balance: string;
    rewards: Array<{ address: string; balance: string }>;
    lpAddress?: string;
  }> {
    try {
      let tmpResult;
      const wantTokenAddress = farmInfo.wantTokenAddress;

      const commons = {
        balance: ethers.utils.formatEther(stakedBalance.div(10 ^ 18)),
        rewards: [
          {
            address: '0xa184088a740c695e156f91f5cc086a06bb78b827',
            balance: ethers.utils.formatEther(rewardBalance.div(10 ^ 18)),
          },
        ],
      };
      if (farmInfo.isLp) {
        const wantContract = new ethers.Contract(
          wantTokenAddress,
          pancakePairABI,
          this.provider,
        );
        const reserve = await wantContract.getReserves();
        const totalSupply = await wantContract.totalSupply();
        const token0Address = farmInfo.token0Address;
        const token1Address = farmInfo.token1Address;

        tmpResult = {
          tokens: [
            {
              address: token0Address,
              balance: ethers.utils.formatEther(
                reserve._reserve0
                  .div(totalSupply)
                  .mul(stakedBalance)
                  .div(10 ^ 18),
              ),
            },
            {
              address: token1Address,
              balance: ethers.utils.formatEther(
                reserve._reserve1
                  .div(totalSupply)
                  .mul(stakedBalance)
                  .div(10 ^ 18),
              ),
            },
          ],
          ...commons,
          lpAdress: wantTokenAddress,
        };
      } else {
        tmpResult = {
          tokens: [
            {
              address: wantTokenAddress,
              balance: ethers.utils.formatEther(stakedBalance.div(10 ^ 18)),
            },
          ],
          ...commons,
        };
      }

      return tmpResult;
    } catch (err) {
      console.log('error at poolId: ', farmInfo.poolId);
      console.log(farmInfo);
      console.log(err);
      // gracefully handle unknown error
      return { tokens: [], balance: '0', rewards: [] };
    }
  }

  async getAddressBalances(userAddress: string): Promise<AddressBalancesDto> {
    if (this.cachedData.length === 0) {
      await this.updateCache();
    }
    const poolLength = await this.getPoolLength();

    const result: any = []; // too lazy to add type here
    for (let i = 0; i < Math.ceil(poolLength / CONCURRENT_NUM); i++) {
      const farmInfoSlice = this.cachedData.slice(
        i * CONCURRENT_NUM,
        (i + 1) * CONCURRENT_NUM,
      );
      const funcArray = farmInfoSlice.map((farmInfo) =>
        this.fetchStakedAndRewardBalance(farmInfo.poolId, userAddress),
      );
      const resFetch = await Promise.all(funcArray);
      const funcArray2 = resFetch
        .filter((x) => x.stakedBalance.gt(0) || x.rewardBalance.gt(0))
        .map(({ stakedBalance, rewardBalance }, index) =>
          this.processBalanceResult(
            farmInfoSlice[index],
            stakedBalance,
            rewardBalance,
          ),
        );
      const resProcess = await Promise.all(funcArray2);
      resProcess.forEach((x) => result.push(x));
    }

    return { farms: result };
  }
}
