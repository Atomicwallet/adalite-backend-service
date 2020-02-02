import type { Logger } from 'bunyan'
import type { ResultSet } from 'pg'
import type { AxiosPromise } from 'axios'

declare module 'icarus-backend' {
  declare type ServerConfig = {
    logger: Logger,
    apiConfig: ApiConfig
  };

  declare type ApiConfig = {
    addressesRequestLimit: number,
    historyResponseLimit: number,
  };

  declare type Request = {
    body: {
      addresses: Array<string>,
    },
  };

  declare type Response = {
    send: Function,
  };

  declare type TxHistoryRequest = {
    body: {
      addresses: Array<string>,
      dateFrom: Date,
    },
  };

  declare type AccountRequest = {
    body: {
      account: string,
    },
  };

  declare type SignedTxRequest = {
    body: SignedTx
  };

  declare type SignedTx = {
    signedTx: string,
  };

  declare type DbApi = {
    bulkStakePoolInfo: (poolId: Array<string>) => Promise<ResultSet>,
    hasGroupAddress: (addresses: Array<string>) => Promise<boolean>,
    delegationHistoryForAccount: (
      limit: number,
      account: string,
    ) => Promise<ResultSet>,
    stakePoolsDetailed: () => Promise<ResultSet>,
    filterUsedAddresses: (addresses: Array<string>) => Promise<ResultSet>,
    unspentAddresses: () => Promise<ResultSet>,
    utxoForAddresses: (addresses: Array<string>) => Promise<ResultSet>,
    utxoSumForAddresses: (addresses: Array<string>) => Promise<ResultSet>,
    transactionsHistoryForAddresses: (
      limit: number,
      addresses: Array<string>,
      dateFrom: Date,
      txHash: ?string,
    ) => Promise<ResultSet>,
    bestBlock: () => Promise<number>,
  };

  declare type ImporterApi = {
    sendTx: (tx: SignedTx) => AxiosPromise<ImporterResponse>
  };

  declare type ImporterResponse = {
    status: number,
    data: any
  }
}
