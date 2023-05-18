import { toBN, amountAsNum } from '@helium/spl-utils'
import { ProgramAccount, Proposal, ProposalState } from '@solana/spl-governance'
import { MintInfo } from '@solana/spl-token'

const calculateAdditionalYesVotesNeeded = (
  yesVotes: number,
  noVotes: number,
  percentageOfYesVotesWanted: number
) => {
  const totalVotes = yesVotes + noVotes
  const percentageOfYesVotes = yesVotes / totalVotes
  let additionalYesVotesNeeded = 0

  if (percentageOfYesVotes < percentageOfYesVotesWanted) {
    // Calculate the target number of "yes" votes needed
    const targetPercentage = percentageOfYesVotesWanted * 100
    const targetYesVotes = Math.ceil(
      (targetPercentage * totalVotes - 100 * yesVotes) /
        (100 - targetPercentage)
    )

    // Calculate the additional "yes" votes needed
    additionalYesVotesNeeded = targetYesVotes - yesVotes
  }

  return additionalYesVotesNeeded
}

export const MIN_REQUIRED_VOTES = 100000
export const SUPER_MAJORITY = 0.66
export const heliumiseProposal = (
  realmMint: MintInfo,
  proposal: ProgramAccount<Proposal>
): ProgramAccount<Proposal> => {
  // helium requires super majority logic
  // and at least 100M to be voted on a proposal
  const { pubkey, account, owner } = proposal

  const yesVotesBN = account.getYesVoteCount()
  const noVotesBN = account.getNoVoteCount()
  const yesVotesNum = amountAsNum(yesVotesBN, realmMint)
  const noVotesNum = amountAsNum(noVotesBN, realmMint)
  const totalVotesNum = yesVotesNum + noVotesNum

  const hasMinRequiredVotes = totalVotesNum > MIN_REQUIRED_VOTES
  const percentageOfYesVotes = yesVotesNum / totalVotesNum
  const hasSuperMajorityYesVotes = percentageOfYesVotes > SUPER_MAJORITY
  const additionalYesVotesNeeded = calculateAdditionalYesVotesNeeded(
    yesVotesNum,
    noVotesNum,
    SUPER_MAJORITY
  )

  account.maxVoteWeight = toBN(
    yesVotesNum + additionalYesVotesNeeded,
    realmMint.decimals
  )
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
