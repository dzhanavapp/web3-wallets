import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { TUseBalanceOptions } from './types'
import { isEvmWallet } from '@/utils/wallet'

const balanceFetcher = async (options: TUseBalanceOptions) => {
  const { isConnected, provider, address } = options
  const isReadyForRequest = isEvmWallet(options) && address && isConnected && provider

  if (!isReadyForRequest) {
    return
  }
  const balance = await options.provider.getBalance(address)
  return String(balance)
}

function useEVMBalance(options: TUseBalanceOptions) {
  const { isConnected, provider, address, chainId, updateDelay } = options
  const isSubscriptionIsAvailable = isEvmWallet(options) && address && isConnected && provider
  const queryClient = useQueryClient()
  const { data: balance } = useQuery(['evmBalance', address], () => balanceFetcher(options), {
    enabled: Boolean(isSubscriptionIsAvailable),
    retry: 2,
    refetchInterval: updateDelay ? updateDelay * 1000 : false,
    refetchOnWindowFocus: true
  })

  const getBalanceFromProvider = useCallback(() => {
    if (!isSubscriptionIsAvailable) {
      return
    }

    return queryClient.invalidateQueries(['evmBalance', address])
  }, [queryClient, isSubscriptionIsAvailable])

  // Subscribe to block changes
  useEffect(() => {
    if (isSubscriptionIsAvailable) {
      options.provider.on('block', getBalanceFromProvider)
    }

    return () => {
      if (options.provider && isSubscriptionIsAvailable) {
        options.provider.off('block', getBalanceFromProvider)
      }
    }
  }, [isSubscriptionIsAvailable, address, chainId, queryClient, options.provider])

  return balance
}

export { useEVMBalance }
