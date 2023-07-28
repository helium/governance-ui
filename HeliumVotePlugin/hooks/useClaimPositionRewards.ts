import useWalletDeprecated from '@hooks/useWalletDeprecated'
import { Program, BN } from '@coral-xyz/anchor'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { useAsyncCallback } from 'react-async-hook'
import { PositionWithMeta } from '../sdk/types'
import {
  PROGRAM_ID,
  EPOCH_LENGTH,
  init,
  delegatedPositionKey,
} from '@helium/helium-sub-daos-sdk'
import { useSolanaUnixNow } from '@hooks/useSolanaUnixNow'
import { chunks } from '@utils/helpers'
import {
  sendTransactionsV3,
  SequenceType,
  txBatchesToInstructionSetWithSigners,
} from '@utils/sendTransactions'
import { notify } from '@utils/notifications'
import useRealm from '@hooks/useRealm'
import { useRealmQuery } from '@hooks/queries/realm'

export const useClaimPositionRewards = () => {
  const { connection, wallet, anchorProvider: provider } = useWalletDeprecated()
  const { unixNow } = useSolanaUnixNow()
  const realm = useRealmQuery().data?.result
  const { realmInfo } = useRealm()
  const { error, loading, execute } = useAsyncCallback(
    async ({
      position,
      programId = PROGRAM_ID,
    }: {
      position: PositionWithMeta
      programId?: PublicKey
    }) => {
      const isInvalid =
        !unixNow ||
        !connection ||
        !connection.current ||
        !provider ||
        !wallet ||
        !realm ||
        !realmInfo ||
        !position.hasRewards

      const idl = await Program.fetchIdl(programId, provider)
      const hsdProgram = await init(provider as any, programId, idl)

      if (loading) return

      if (isInvalid || !hsdProgram) {
        throw new Error('Unable to Claim Rewards, Invalid params')
      } else {
        const currentEpoch = new BN(unixNow).div(new BN(EPOCH_LENGTH))
        const delegatedPosKey = delegatedPositionKey(position.pubkey)[0]
        const delegatedPosAcc = await hsdProgram.account.delegatedPositionV0.fetch(
          delegatedPosKey
        )

        const { lastClaimedEpoch } = delegatedPosAcc
        const epoch = lastClaimedEpoch.add(new BN(1))
        const epochsToClaim = Array.from(
          { length: currentEpoch.sub(epoch).toNumber() },
          (_v, k) => epoch.addn(k)
        )

        const instructions: TransactionInstruction[] = await Promise.all(
          epochsToClaim.map(
            async (epoch) =>
              await hsdProgram.methods
                .claimRewardsV0({
                  epoch,
                })
                .accounts({
                  position: position.pubkey,
                  subDao: delegatedPosAcc.subDao,
                })
                .instruction()
          )
        )

        // This is an arbitrary threshold and we assume that up to 4 instructions can be inserted as a single Tx
        const ixsChunks = chunks(instructions, 4)
        const txsChunks = ixsChunks.map((txBatch, batchIdx) => ({
          instructionsSet: txBatchesToInstructionSetWithSigners(
            txBatch,
            [],
            batchIdx
          ),
          sequenceType: SequenceType.Sequential,
        }))

        notify({ message: 'Claiming Rewards' })

        try {
          for (const chunk of chunks(txsChunks, 5)) {
            await sendTransactionsV3({
              transactionInstructions: chunk,
              wallet,
              connection: connection.current,
            })
          }

          notify({
            message: 'Claiming Rewards successful',
            type: 'success',
          })
        } catch (_) {
          notify({
            type: 'error',
            message: 'Claiming Rewards unsuccessful, please try again',
          })
        }
      }
    }
  )

  return {
    error,
    loading,
    claimPositionRewards: execute,
  }
}
