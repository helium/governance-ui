import { BN } from '@coral-xyz/anchor'
import { ProgramAccount, Proposal, ProposalState } from '@solana/spl-governance'
import { MintInfo } from '@solana/spl-token'
import { fmtTokenAmount } from '@utils/formatting'

export const heliumiseProposal = (realmMint: MintInfo | undefined) => (
  proposal: ProgramAccount<Proposal>
): ProgramAccount<Proposal> => {
  const { pubkey, account, owner } = proposal
  const maxVoteWeight = account.maxVoteWeight

  const yesVoteCount = fmtTokenAmount(
    account.getYesVoteCount(),
    realmMint?.decimals
  )

  const noVoteCount = fmtTokenAmount(
    account.getNoVoteCount(),
    realmMint?.decimals
  )

  const minimumRequiredVoted = yesVoteCount + noVoteCount > 100_000_000

  return {
    pubkey,
    account,
    owner,
  }
}
