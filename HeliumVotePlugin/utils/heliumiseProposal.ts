import { toBN, amountAsNum } from '@helium/spl-utils'
import { ProgramAccount, Proposal, ProposalState } from '@solana/spl-governance'
import { MintInfo } from '@solana/spl-token'

export const heliumiseProposal = (
  realmMint: MintInfo,
  proposal: ProgramAccount<Proposal>
): ProgramAccount<Proposal> => {
  // helium requires super majority logic
  // and at least 100M to be voted on a proposal
  const { pubkey, account, owner } = proposal
  const yesVotes = amountAsNum(account.getYesVoteCount(), realmMint)
  const totalVotes = yesVotes + amountAsNum(account.getNoVoteCount(), realmMint)
  const minRequiredVotes = 100_000_000
  const hasMinRequiredVotes = totalVotes > minRequiredVotes
  const percentageOfYesVotes = (yesVotes / totalVotes) * 100
  const hasSuperMajorityYesVotes =
    percentageOfYesVotes > (account.voteThreshold?.value || 0)
  const neededToPass =
    yesVotes +
    (((account.voteThreshold?.value || 0) - percentageOfYesVotes) / 100) *
      yesVotes
  account.maxVoteWeight = toBN(neededToPass, realmMint.decimals)

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
