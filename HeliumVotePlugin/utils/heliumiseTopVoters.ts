import { ProgramAccount, Proposal } from '@solana/spl-governance'
import { VoterDisplayData } from '@models/proposal'
import { Registrar } from 'HeliumVotePlugin/sdk/types'
import BigNumber from 'bignumber.js'

export const heliumiseTopVoters = ({
  topVoters,
  registrar,
  proposal,
}: {
  topVoters: VoterDisplayData[]
  registrar: Registrar | null
  proposal: ProgramAccount<Proposal>
}) => {
  if (registrar && proposal) {
    const digitShift = registrar?.votingMints[0].digitShift || 0
    const totalVote = proposal.account
      .getYesVoteCount()
      .add(proposal.account.getNoVoteCount())

    return topVoters.map((x) => {
      return {
        ...x,
        decimals: x.decimals + digitShift,
        votePercentage: new BigNumber(x.votesCast.toString())
          .shiftedBy(2)
          .dividedBy(new BigNumber(totalVote.toString()))
          .toNumber(),
      }
    })
  }

  return topVoters
}
