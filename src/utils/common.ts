import { PublicKey } from '@solana/web3.js'
import type { BytesLike } from 'ethers'
import { ethers } from 'ethers'
import type { Hexable } from 'ethers/lib/utils'
import isMobile from 'ismobilejs'

import {
  COSMOS_CHAINS,
  EVM_BASE_TOKEN_ADDRESS,
  EVM_ENS_POSTFIX,
  NETWORK_IDS,
  SOLANA_BASE_TOKEN_ADDRESS,
  SOLANA_ENS_POSTFIX,
  SOL_CHAINS,
  WALLET_SUBNAME
} from '../constants'
import { checkEnsValid, parseAddressFromEnsSolana } from './solana'
import { getNetworkById, supportedNetworkIds } from '@/networks'

export const { BigNumber } = ethers

export const toHex = (value: BytesLike | Hexable | number | bigint) => ethers.utils.hexlify(value)

const addressRegExpList = {
  [NETWORK_IDS.TON]: /^[a-zA-Z0-9_-]*$/,
  [NETWORK_IDS.TONTestnet]: /^[a-zA-Z0-9_-]*$/,
  [NETWORK_IDS.Cosmos]: /^(cosmos1)[0-9a-z]{38}$/,
  [NETWORK_IDS.Osmosis]: /^(osmo1)[0-9a-z]{38}$/,
  [NETWORK_IDS.Sifchain]: /^(sif1)[0-9a-z]{38}$/,
  [NETWORK_IDS.BTC]: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/,
  [NETWORK_IDS.Litecoin]: /^(L|M|3)[A-Za-z0-9]{33}$|^(ltc1)[0-9A-Za-z]{39}$/,
  [NETWORK_IDS.BCH]: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^[0-9A-Za-z]{42,42}$/
}

export const isEvmChain = (chainId: number) => chainId > 0
export const isCosmosChain = (chainId: number) => COSMOS_CHAINS.includes(chainId as any)
export const isSolChain = (chainId: number) => SOL_CHAINS.includes(chainId as any)

export const isValidAddress = async (chainId: number, address: string) => {
  if (isEvmChain(chainId)) {
    // Chain ID > 0 === EVM-like network
    if (address.slice(-4) === EVM_ENS_POSTFIX) {
      const rpc = getNetworkById(NETWORK_IDS.Ethereum).rpc_url
      const provider = new ethers.providers.JsonRpcProvider(rpc)
      const result = await provider.resolveName(address)
      return !!result
    }
    return ethers.utils.isAddress(address)
  }
  if (chainId === NETWORK_IDS.Solana || chainId === NETWORK_IDS.SolanaTestnet) {
    try {
      if (address.slice(-4) === SOLANA_ENS_POSTFIX) {
        await checkEnsValid(address)
        return true
      }
      return Boolean(new PublicKey(address))
    } catch (e) {
      return false
    }
  }
  if (chainId === NETWORK_IDS.TON || chainId === NETWORK_IDS.TONTestnet) {
    // example:
    // EQBj0KYB_PG6zg_F3sjLwFkJ5C02aw0V10Dhd256c-Sr3BvF
    // EQCudP0_Xu7qi-aCUTCNsjXHvi8PNNL3lGfq2Wcmbg2oN-Jg
    // EQAXqKCSrUFgPKMlCKlfyT2WT7GhVzuHyXiPtDvT9s5FMp5o
    const prefix = address.slice(0, 2)
    return (
      address.length === 48
      && (prefix === 'EQ' || prefix === 'kQ' || prefix === 'Ef' || prefix === 'UQ')
      && addressRegExpList[chainId].test(address)
    )
  }

  if (chainId === NETWORK_IDS.Cosmos
      || chainId === NETWORK_IDS.Osmosis
      || chainId === NETWORK_IDS.Sifchain
      || chainId === NETWORK_IDS.BTC
      || chainId === NETWORK_IDS.BCH
      || chainId === NETWORK_IDS.Litecoin) {
    return addressRegExpList[chainId].test(address)
  }

  throw new Error(`Not implemented or wrong chainId ${chainId}`)
}

export const shortenAddress = (address: string) => {
  if (address.length) {
    if (address[address.length - 4] === '.') {
      // If ENS - Return ENS name
      return address
    }
    return [address.slice(0, address.slice(0, 2) === '0x' ? 6 : 4), '...', address.slice(address.length - 4)].join('')
  }

  return ''
}

export const getAddressUrl = (chainId: number, address: string) => {
  if (!chainId || !address || !supportedNetworkIds.includes(chainId)) {
    return undefined
  }

  const network = getNetworkById(chainId)
  const explorerUrl = network.data.params[0].blockExplorerUrls[0]

  if (isEvmChain(network.chain_id) || [NETWORK_IDS.Solana, ...COSMOS_CHAINS].includes(network.chain_id as any)) {
    return `${explorerUrl}/address/${address}`
  }

  if (network.chain_id === NETWORK_IDS.SolanaTestnet) {
    return `${explorerUrl}/account/${address}?cluster=testnet`
  }

  throw new Error(`getAddressUrl: not implemented for chainId ${chainId}`)
}

export const getTxUrl = (chainId: number, txHash: string): string | undefined => {
  if (!chainId || !txHash || !supportedNetworkIds.includes(chainId)) {
    return undefined
  }

  const network = getNetworkById(chainId)
  const explorerUrl = network.data.params[0].blockExplorerUrls[0]

  if (network.chain_id > 0 || [NETWORK_IDS.Solana].includes(network.chain_id as any)) {
    return `${explorerUrl}/tx/${txHash}`
  }

  if (network.chain_id === NETWORK_IDS.SolanaTestnet) {
    return `${explorerUrl}/tx/${txHash}?cluster=testnet`
  }

  if ([...COSMOS_CHAINS].includes(network.chain_id as any)) {
    return `${explorerUrl}/transactions/${txHash}`
  }

  throw new Error(`getTxUrl: not implemented for chainId ${chainId}`)
}

export const getNativeTokenAddress = (chainId: number) => {
  if (chainId === NETWORK_IDS.Solana || chainId === NETWORK_IDS.SolanaTestnet) {
    return SOLANA_BASE_TOKEN_ADDRESS
  }

  return EVM_BASE_TOKEN_ADDRESS
}

export const parseAddressFromEns = async (input: string) => {
  if (input.slice(-4) === SOLANA_ENS_POSTFIX) {
    return parseAddressFromEnsSolana(input)
  }

  if (input.slice(-4) === EVM_ENS_POSTFIX) {
    const rpc = getNetworkById(NETWORK_IDS.Ethereum).rpc_url
    const provider = new ethers.providers.JsonRpcProvider(rpc)
    return provider.resolveName(input) as Promise<string>
  }
  return input
}

const openLink = (url: string) => window?.open(url, '_blank')

export const goMetamask = () => {
  if (isMobile(window.navigator).any) {
    const locationHref = window.location.href
    let locationHrefNoProtocol = locationHref.replace('http://', '')
    locationHrefNoProtocol = locationHrefNoProtocol.replace('https://', '')
    window.location.href = `https://metamask.app.link/dapp/${locationHrefNoProtocol}`
  } else {
    openLink('https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn')
  }
}

export const goPhantom = () => openLink('https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa')

export const goKeplr = () => openLink('https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap')

export const mapRawWalletSubName = (subName: string) => {
  if (subName.toLowerCase().includes('gnosis safe')) {
    return WALLET_SUBNAME.GnosisSafe
  }
  return subName
}
