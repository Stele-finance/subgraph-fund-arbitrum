import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')

// Arbitrum addresses
export const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
export const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
export const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

// Stele Fund Addresses
export const STELE_FUND_SETTING_ADDRESS = '0x16774b77de5B970B4B6cE57C1Fcd5383759145D4' // TODO: Replace with actual address
export const STELE_FUND_INFO_ADDRESS = '0xe71a6E1B4516756716dd00DBa33D29eAEDc116Bc' // TODO: Replace with actual address
export const STELE_FUND_TOKEN_ADDRESS = '0x08C9c9EE6F161c6056060BF6AC7fE85e38638619' // TODO: Replace with actual address

// Cache durations (in seconds)
export const PRICE_CACHE_DURATION = 900 // 15 minutes
export const POOL_INFO_CACHE_DURATION = 604800 // 1 week
export const POOL_LIQUIDITY_CACHE_DURATION = 21600 // 6 hours
export const POOL_SLOT0_CACHE_DURATION = 900 // 15 minutes
export const TOKEN_INFO_CACHE_DURATION = 604800 // 1 week

export const UNKNOWN = 'Unknown'
export const DECIMAL_18 = '1000000000000000000'

// Transaction types
export const TYPE_DEPOSIT = 'DEPOSIT'
export const TYPE_WITHDRAW = 'WITHDRAW'
export const TYPE_NORMAL = 'NORMAL'