import { PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import asFindable from '@utils/queries/asFindable'
import { getProposal, getProposalsByGovernance } from '@solana/spl-governance'
import { useRealmQuery } from './realm'
import { useRouter } from 'next/router'
import { tryParsePublicKey } from '@tools/core/pubkey'
import { useMemo } from 'react'
import { useRealmGovernancesQuery } from './governance'
import queryClient from './queryClient'
import useLegacyConnectionContext from '@hooks/useLegacyConnectionContext'
import { useRealmCommunityMintInfoQuery } from './mintInfo'
import { heliumiseProposal } from 'HeliumVotePlugin/utils/heliumiseProposal'
import useWalletOnePointOh from '@hooks/useWalletOnePointOh'

export const proposalQueryKeys = {
  all: (endpoint: string) => [endpoint, 'Proposal'],
  byPubkey: (endpoint: string, k: PublicKey) => [
    ...proposalQueryKeys.all(endpoint),
    k.toString(),
  ],
  byRealm: (endpoint: string, realm: PublicKey) => [
    ...proposalQueryKeys.all(endpoint),
    'by Realm (gPA)',
    realm,
  ],
}

export const useProposalByPubkeyQuery = (pubkey: PublicKey | undefined) => {
  const connection = useLegacyConnectionContext()
  const realm = useRealmQuery().data?.result
  const wallet = useWalletOnePointOh()
  const communityMint = useRealmCommunityMintInfoQuery().data?.result

  const enabled =
    communityMint !== undefined && realm !== undefined && pubkey !== undefined
  const query = useQuery({
    queryKey: enabled
      ? proposalQueryKeys.byPubkey(connection.endpoint, pubkey)
      : undefined,
    queryFn: async () => {
      if (!enabled) throw new Error()

      const result = await asFindable(getProposal)(connection.current, pubkey)

      if (
        realm &&
        result?.result?.account.governingTokenMint.equals(
          realm.account.communityMint
        ) &&
        communityMint
      ) {
        return {
          ...result,
          result: await heliumiseProposal({
            realm,
            realmMint: communityMint,
            proposal: result.result,
            wallet,
            connection: connection.current,
          }),
        }
      }

      return result
    },
    enabled,
  })

  return query
}

export const useSelectedProposalPk = () => {
  const { pk } = useRouter().query
  return useMemo(
    () => (typeof pk === 'string' ? tryParsePublicKey(pk) : undefined),
    [pk]
  )
}

export const useRouteProposalQuery = () => {
  const proposalPk = useSelectedProposalPk()
  return useProposalByPubkeyQuery(proposalPk)
}

export const useRealmProposalsQuery = () => {
  const connection = useLegacyConnectionContext()
  const realm = useRealmQuery().data?.result
  const wallet = useWalletOnePointOh()
  const communityMint = useRealmCommunityMintInfoQuery().data?.result
  const { data: governances } = useRealmGovernancesQuery()

  const enabled =
    communityMint !== undefined &&
    realm !== undefined &&
    governances !== undefined
  const query = useQuery({
    queryKey: enabled
      ? proposalQueryKeys.byRealm(connection.endpoint, realm.pubkey)
      : undefined,
    queryFn: async () => {
      if (!enabled) throw new Error()

      const results = (
        await Promise.all(
          governances.map((x) =>
            getProposalsByGovernance(connection.current, realm.owner, x.pubkey)
          )
        )
      ).flat()

      // TODO instead of using setQueryData, prefetch queries on mouseover ?
      results.forEach((x) => {
        queryClient.setQueryData(
          proposalQueryKeys.byPubkey(connection.endpoint, x.pubkey),
          { found: true, result: x }
        )
      })

      return await Promise.all(
        results.map(async (p) => {
          if (
            realm &&
            p.account.governingTokenMint.equals(realm.account.communityMint) &&
            communityMint
          ) {
            return await heliumiseProposal({
              realm,
              realmMint: communityMint,
              proposal: p,
              wallet,
              connection: connection.current,
            })
          }

          return p
        })
      )
    },
    enabled,
  })

  return query
}
