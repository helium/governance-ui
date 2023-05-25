import { toBN } from '@helium/spl-utils'
import { SignerWalletAdapter } from '@solana/wallet-adapter-base'
import {
  ProgramAccount,
  Proposal,
  ProposalState,
  Realm,
} from '@solana/spl-governance'
import { MintInfo } from '@solana/spl-token'
import { AnchorProvider } from '@coral-xyz/anchor'
import { init, registrarKey } from '@helium/voter-stake-registry-sdk'
import { Connection } from '@solana/web3.js'
import { fmtTokenAmount } from '@utils/formatting'

const calculateAdditionalYesVotesNeeded = (
  yesVotes: number,
  noVotes: number,
  targetPercentage
) => {
  const totalVotes = yesVotes + noVotes
  const targetVotes = Math.ceil((targetPercentage / 100) * totalVotes)
  const additionalYesVotes = targetVotes - yesVotes

  return additionalYesVotes > 0 ? additionalYesVotes : 0
  // const totalVotes = yesVotes + noVotes
  // const percentageOfYesVotes = yesVotes / totalVotes
  // let additionalYesVotesNeeded = 0

  // if (percentageOfYesVotes < percentageOfYesVotesWanted) {
  //   // Calculate the target number of "yes" votes needed
  //   const targetPercentage = percentageOfYesVotesWanted * 100
  //   const targetYesVotes = Math.ceil(
  //     (targetPercentage * totalVotes - 100 * yesVotes) /
  //       (100 - targetPercentage)
  //   )

  //   // Calculate the additional "yes" votes needed
  //   additionalYesVotesNeeded = targetYesVotes - yesVotes
  // }

  // return additionalYesVotesNeeded
}

export const MIN_REQUIRED_VOTES = 100000000
export const SUPER_MAJORITY = 66
export const heliumiseProposal = async ({
  realm,
  realmMint,
  proposal,
  wallet,
  connection,
}: {
  realm: ProgramAccount<Realm>
  realmMint: MintInfo
  proposal: ProgramAccount<Proposal>
  wallet: SignerWalletAdapter | undefined
  connection: Connection
}): Promise<ProgramAccount<Proposal>> => {
  // helium requires super majority logic
  // and at least 100M to be voted on a proposal
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: connection.commitment,
    skipPreflight: true,
  })
  const { pubkey, account, owner } = proposal
  const hvsrProgram = await init(provider)
  const [registrar] = registrarKey(realm.pubkey, account.governingTokenMint)
  const registrarAcc = await hvsrProgram.account.registrar.fetchNullable(
    registrar
  )

  const digitShift = registrarAcc?.votingMints[0].digitShift || 0
  const digitShiftCorrection = Math.abs(digitShift) * 10 || 1
  const yesVotesBN = account.getYesVoteCount()
  const noVotesBN = account.getNoVoteCount()
  const yesVotesNum =
    fmtTokenAmount(yesVotesBN, realmMint.decimals) * digitShiftCorrection
  const noVotesNum =
    fmtTokenAmount(noVotesBN, realmMint.decimals) * digitShiftCorrection
  const totalVotesNum = yesVotesNum + noVotesNum

  const hasMinRequiredVotes = totalVotesNum > MIN_REQUIRED_VOTES
  const percentageOfYesVotes = (yesVotesNum / totalVotesNum) * 100
  const hasSuperMajorityYesVotes = percentageOfYesVotes >= SUPER_MAJORITY
  const additionalYesVotesNeeded = calculateAdditionalYesVotesNeeded(
    yesVotesNum,
    noVotesNum,
    SUPER_MAJORITY
  )

  account.maxVoteWeight = toBN(
    yesVotesNum + additionalYesVotesNeeded,
    realmMint.decimals
  )
  ;(account as any).isHeliumised = true
  ;(account as any).digitShift = digitShift
  ;(account as any).digitShiftCorrection = digitShiftCorrection
  ;(account as any).getMinimumTotalVotes = () => MIN_REQUIRED_VOTES

  // Proposal has reached end of voting period
  // and has been finalized
  if (
    account.isVoteFinalized() &&
    (account.state === ProposalState.Defeated ||
      account.state === ProposalState.Succeeded)
  ) {
    if (!hasMinRequiredVotes || !hasSuperMajorityYesVotes) {
      account.state = ProposalState.Defeated
    } else {
      account.state = ProposalState.Succeeded
    }
  }

  return {
    pubkey,
    account,
    owner,
  }
}
