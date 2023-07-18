import { useMemo, useState } from 'react'

import {
  createUnchartedRealmInfo,
  getCertifiedRealmInfos,
  RealmInfo,
} from '../../models/registry/api'

import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

import { PublicKey } from '@solana/web3.js'
import { DEFAULT_GOVERNANCE_PROGRAM_ID } from '@components/instructions/tools'
import { useRealmsByProgramQuery } from '@hooks/queries/realm'
import useLegacyConnectionContext from '@hooks/useLegacyConnectionContext'

const RealmsDashboard = dynamic(() => import('./components/RealmsDashboard'))

const Realms = () => {
  const [realms, setRealms] = useState<ReadonlyArray<RealmInfo>>([])
  const [filteredRealms, setFilteredRealms] = useState<
    ReadonlyArray<RealmInfo>
  >([])
  const [isLoadingRealms, setIsLoadingRealms] = useState(true)
  const connection = useLegacyConnectionContext()
  const router = useRouter()
  const [searchString, setSearchString] = useState('')
  const { cluster } = router.query
  //Small hack to prevent race conditions with cluster change until we remove connection from store and move it to global dep.
  const routeHasClusterInPath = router.asPath.includes('cluster')
  const programs = useMemo(
    () => new PublicKey(DEFAULT_GOVERNANCE_PROGRAM_ID),
    []
  )
  const { data: queryRealms } = useRealmsByProgramQuery(programs)

  useMemo(async () => {
    if (
      connection &&
      ((routeHasClusterInPath && cluster) || !routeHasClusterInPath)
    ) {
      const [certifiedRealms] = await Promise.all([
        getCertifiedRealmInfos(connection),
      ])
      const unchartedRealms =
        queryRealms
          ?.filter(
            (x) => !certifiedRealms.find((y) => y.realmId.equals(x.pubkey))
          )
          .map((x) =>
            createUnchartedRealmInfo({
              name: x.account.name,
              programId: x.owner.toBase58(),
              address: x.pubkey.toBase58(),
            })
          ) ?? []
      const allRealms = [...certifiedRealms, ...unchartedRealms]
      setRealms(sortDaos(allRealms))
      setFilteredRealms(sortDaos(allRealms))
      setIsLoadingRealms(false)
    }
  }, [connection, routeHasClusterInPath, cluster, queryRealms])

  const sortDaos = (realmInfoData: RealmInfo[]) => {
    return realmInfoData.sort((a: RealmInfo, b: RealmInfo) => {
      return (b.sortRank ?? -0) - (a.sortRank ?? -0)
    })
  }
  const filterDaos = (v) => {
    setSearchString(v)
    if (v.length > 0) {
      const filtered = realms.filter(
        (r) =>
          r.displayName?.toLowerCase().includes(v.toLowerCase()) ||
          r.symbol?.toLowerCase().includes(v.toLowerCase())
      )
      setFilteredRealms(filtered)
    } else {
      setFilteredRealms(realms)
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between w-full mb-6">
        <h1 className="mb-4 sm:mb-0">DAOs</h1>
      </div>
      <RealmsDashboard
        realms={realms}
        filteredRealms={filteredRealms}
        isLoading={isLoadingRealms}
        editing={false}
        searching={searchString.length > 0}
        clearSearch={() => filterDaos('')}
        cluster={cluster}
      ></RealmsDashboard>
    </div>
  )
}

export default Realms
