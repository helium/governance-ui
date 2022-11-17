import { Program, Provider, web3 } from '@project-serum/anchor'
import {
  IDL,
  VoterStakeRegistry as DefaultVoterStakeRegistry,
} from './voter_stake_registry'
import { HeliumVoterStakeRegistry } from './helium_voter_stake_registry'
import { IdlInstruction } from '@project-serum/anchor/dist/cjs/idl'

export const DEFAULT_VSR_ID = new web3.PublicKey(
  'vsr2nfGVNHmSY8uxoBGqq8AQbwz3JwaEaHqGbsTPXqQ'
)

type VoterStakeRegistry = DefaultVoterStakeRegistry | HeliumVoterStakeRegistry

export class VsrClient {
  constructor(
    public program: Program<VoterStakeRegistry>,
    public devnet?: boolean,
    public hasMinRequired?: boolean
  ) {}

  static async connect(
    provider: Provider,
    programId: web3.PublicKey = DEFAULT_VSR_ID,
    devnet?: boolean
  ): Promise<VsrClient> {
    const idl = (await Program.fetchIdl(programId, provider)) || IDL
    const hasMinRequired = (() => {
      const ix = (idl.instructions as IdlInstruction[])?.find(
        (instruction) => instruction.name === 'configureVotingMint'
      )

      return [
        'minRequiredLockupVoteWeightScaledFactor',
        'minRequiredLockupSaturationSecs',
      ].every((name) => ix?.args.find((arg) => arg.name === name))
    })()

    return new VsrClient(
      new Program<VoterStakeRegistry>(
        idl as VoterStakeRegistry,
        programId,
        provider
      ) as Program<VoterStakeRegistry>,
      devnet,
      hasMinRequired
    )
  }
}
