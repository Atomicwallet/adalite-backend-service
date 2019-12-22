// @flow

import type { Pool, ResultSet } from 'pg'
import type { DbApi } from 'icarus-backend'; // eslint-disable-line

/**
 * Checks if addresses array contains group address
 * @param {Db Object} db
 * @param {Array<Address>} addresses
 */
const hasGroupAddress = (db: Pool) => async (
  addresses: Array<string>,
): Promise<boolean> => {
  const res = await db.query({
    text: 'SELECT EXISTS ( SELECT 1 FROM group_addresses WHERE group_address = ANY($1) )',
    values: [addresses],
  })
  return res.rows[0].exists === true
}

// NULL value in column POOL means undelegation
const delegationHistoryQuery = (limit: number) => `
  SELECT * FROM delegation_certificates
  WHERE account = $1 
    AND pool IS NOT NULL
  ORDER BY block_num DESC LIMIT ${limit}
`

/**
 * Returns delegation history for an account
 * @param {Db Object} db
 * @param {Account} account
 */
const delegationHistoryForAccount = (db: Pool) => async (
  limit: number,
  account: string,
): Promise<ResultSet> =>
  db.query({
    text: delegationHistoryQuery(limit),
    values: [account],
  })

/**
* Gets all pools and their details
* @param {Db Object} db
*/
const stakePoolsDetailed = (db: Pool) => async (): Promise<ResultSet> =>
  db.query({
    text: `SELECT 
        pc.pool AS pool_id,
        poi.owner,
        poi.time,
        poi.info::json->>'name' AS name,
        poi.info::json->>'description' AS description,
        poi.info::json->>'ticker' AS ticker,
        poi.info::json->>'homepage' AS homepage,
        pc.parsed::json->'rewards'->>'fixed' AS fixed,
        pc.parsed::json->'rewards'->>'ratio' AS ratio,
        pc.parsed::json->'rewards'->>'limit' AS limit 
      FROM pool_certificates pc 
      LEFT JOIN pool_owners_info poi 
        ON (pc.parsed::json#>>'{owners, 0}' = poi.owner)`,
  })

/**
 * Returns the list of addresses that were used at least once (as input or output)
 * @param {Db Object} db
 * @param {Array<Address>} addresses
 */
const filterUsedAddresses = (db: Pool) => async (
  addresses: Array<string>,
): Promise<ResultSet> =>
  db.query({
    text: `SELECT DISTINCT address FROM "tx_addresses"
           WHERE address = ANY($1)
              OR address in (
                SELECT group_address from group_addresses
                WHERE utxo_address = ANY($1)
              )`,
    values: [addresses],
    rowMode: 'array',
  })

const unspentAddresses = (db: Pool) => async (): Promise<ResultSet> =>
  db.query({
    text: 'SELECT DISTINCT utxos.receiver FROM utxos',
    rowMode: 'array',
  })

/**
 * Queries UTXO table looking for unspents for given addresses
 *
 * @param {Db Object} db
 * @param {Array<Address>} addresses
 */
const utxoForAddresses = (db: Pool) => async (addresses: Array<string>) =>
  db.query('SELECT * FROM "utxos" WHERE receiver = ANY($1)', [addresses])

const utxoSumForAddresses = (db: Pool) => async (addresses: Array<string>) =>
  db.query('SELECT SUM(amount) FROM "utxos" WHERE receiver = ANY($1)', [
    addresses,
  ])

// Cached queries
const txHistoryQuery = (limit: number) => `
  SELECT *
  FROM "txs"
  LEFT JOIN (SELECT * from "bestblock" LIMIT 1) f ON true
  WHERE 
    hash = ANY (
      SELECT tx_hash 
      FROM "tx_addresses"
      WHERE address = ANY ($1)
      OR address in (
        SELECT group_address from group_addresses
        WHERE utxo_address = ANY($1)
      )
    )
    AND last_update >= $2
  ORDER BY last_update ASC
  LIMIT ${limit}
`

/**
 * Queries DB looking for transactions including (either inputs or outputs)
 * for the given addresses
 *
 * @param {Db Object} db
 * @param {Array<Address>} addresses
 */
const transactionsHistoryForAddresses = (db: Pool) => async (
  limit: number,
  addresses: Array<string>,
  dateFrom: Date,
): Promise<ResultSet> => db.query(txHistoryQuery(limit), [addresses, dateFrom])

// The remaining queries should be used only for the purposes of the legacy API!

/**
 * Queries DB looking for successful transactions associated with any of the given addresses.
 * @param {Db Object} db
 * @param {Array<Address>} addresses
 */
const bulkAddressSummary = (db: Pool) => async (addresses: Array<string>): Promise<ResultSet> =>
  db.query({
    text: `SELECT * FROM "txs"
      WHERE hash = ANY (SELECT tx_hash FROM "tx_addresses" WHERE address = ANY($1))
      AND tx_state = $2
      ORDER BY time DESC`,
    values: [addresses, 'Successful'],
  })

/**
* Queries TXS table looking for a successful transaction with a given hash
* @param {Db Object} db
* @param {*} tx
*/
const txSummary = (db: Pool) => async (tx: string): Promise<ResultSet> =>
  db.query({
    text: 'SELECT * FROM "txs" WHERE hash = $1 AND tx_state = $2',
    values: [tx, 'Successful'],
  })

/**
 * Queries UTXO table looking for unspents for given addresses and renames the columns
 * @param {Db Object} db
 * @param {Array<Address>} addresses
 */
const utxoLegacy = (db: Pool) => async (addresses: Array<string>): Promise<ResultSet> =>
  db.query({
    text: `SELECT 'CUtxo' AS "tag", tx_hash AS "cuId", tx_index AS "cuOutIndex", receiver AS "cuAddress", amount AS "cuCoins"
      FROM "utxos"
      WHERE receiver = ANY($1)`,
    values: [addresses],
  })

  /**
* Queries TXS table for the last 20 transactions
* @param {Db Object} db
*/
const lastTxs = (db: Pool) => async (): Promise<ResultSet> =>
  db.query({
    text: `SELECT * FROM "txs"
      ORDER BY "time" DESC
      LIMIT 20`,
  })

const bestBlock = (db: Pool) => async (): Promise<number> => {
  const query = await db.query('SELECT * FROM "bestblock"')
  return query.rows.length > 0 ? parseInt(query.rows[0].best_block_num, 10) : 0
}

export default (db: Pool): DbApi => ({
  hasGroupAddress: hasGroupAddress(db),
  delegationHistoryForAccount: delegationHistoryForAccount(db),
  stakePoolsDetailed: stakePoolsDetailed(db),
  filterUsedAddresses: filterUsedAddresses(db),
  unspentAddresses: unspentAddresses(db),
  utxoForAddresses: utxoForAddresses(db),
  utxoSumForAddresses: utxoSumForAddresses(db),
  transactionsHistoryForAddresses: transactionsHistoryForAddresses(db),
  bestBlock: bestBlock(db),
  // legacy
  bulkAddressSummary: bulkAddressSummary(db),
  txSummary: txSummary(db),
  utxoLegacy: utxoLegacy(db),
  lastTxs: lastTxs(db),
})
