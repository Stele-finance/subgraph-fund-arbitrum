import { BigInt, BigDecimal, Address, log, Bytes } from '@graphprotocol/graph-ts'
import {
    WETH,
    ZERO_BD,
    USDC,
    UNISWAP_V3_FACTORY,
    ZERO_BI,
    ONE_BD,
    PRICE_CACHE_DURATION,
    POOL_LIQUIDITY_CACHE_DURATION,
    POOL_SLOT0_CACHE_DURATION,
} from './constants'
import { safeDiv } from './index'
import { UniswapV3Factory } from '../../generated/SteleFund/UniswapV3Factory'
import { UniswapV3Pool } from '../../generated/SteleFund/UniswapV3Pool'
import { fetchTokenDecimals } from './token'
import { PriceCache, Bundle, PoolInfo } from '../../generated/schema'

const Q192 = f64(2 ** 192)

export function sqrtPriceX96ToTokenPrices(sqrtPriceX96: BigInt, token0: Address, token1: Address, blockTimestamp: BigInt): BigDecimal[] {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal()
  let denom = BigDecimal.fromString(Q192.toString())
  
  // Use cached token decimals instead of direct RPC calls
  const token0DecimalsResult = fetchTokenDecimals(Bytes.fromHexString(token0.toHexString()), blockTimestamp)
  const token1DecimalsResult = fetchTokenDecimals(Bytes.fromHexString(token1.toHexString()), blockTimestamp)
  
  // Fallback to default 18 decimals if cache miss
  const token0Decimals = token0DecimalsResult ? token0DecimalsResult.toI32() : 18
  const token1Decimals = token1DecimalsResult ? token1DecimalsResult.toI32() : 18

  let price1 = num
    .div(denom)
    .times(BigDecimal.fromString(f64(10 ** token0Decimals).toString()))
    .div(BigDecimal.fromString(f64(10 ** token1Decimals).toString()))

  let price0 = safeDiv(BigDecimal.fromString('1'), price1)

  return [price0, price1]
}

function getEthPriceInUSD(blockTimestamp: BigInt): BigDecimal {
  const wethAddress = Address.fromString(WETH)
  const usdcAddress = Address.fromString(USDC)
  const fees = [500, 3000, 10000]

  let ethPriceInUSD = ZERO_BD
  let largestLiquidity = ZERO_BI

  for (let i=0; i<fees.length; i++) {
    // Use cached pool info instead of direct RPC calls
    let poolInfo = getCachedPoolInfo(wethAddress, usdcAddress, fees[i])
    if (poolInfo === null) {
      continue
    }
    
    // Use cached liquidity and slot0 instead of direct RPC calls
    let liquidity = getCachedPoolLiquidity(poolInfo, blockTimestamp)
    
    if (liquidity.gt(ZERO_BI) && liquidity.gt(largestLiquidity)) {
      // Use cached sqrtPriceX96 instead of RPC call
      let sqrtPriceX96 = getCachedSlot0(poolInfo, blockTimestamp)
      let token0 = Address.fromBytes(poolInfo.token0)
      let token1 = Address.fromBytes(poolInfo.token1)
      
      if (token0.equals(Address.fromString(WETH))) {
        ethPriceInUSD = sqrtPriceX96ToTokenPrices(sqrtPriceX96, token0, token1, blockTimestamp)[1]
      } else {
        ethPriceInUSD = sqrtPriceX96ToTokenPrices(sqrtPriceX96, token0, token1, blockTimestamp)[0]
      }
      largestLiquidity = liquidity
    }
  }

  return ethPriceInUSD
}

// Bundle-based ETH price caching (updates every 15 minutes)
export function getCachedEthPriceUSD(blockTimestamp: BigInt): BigDecimal {  
  let bundle = Bundle.load("1")
  if (bundle === null) {
    bundle = new Bundle("1")
    bundle.ethPriceUSD = BigDecimal.fromString("0")
    bundle.lastUpdateBlock = BigInt.fromI32(0)
    bundle.lastUpdateTimestamp = BigInt.fromI32(0)
  }
  
  // Update price only when 15 minutes have passed
  let timeDiff = blockTimestamp.minus(bundle.lastUpdateTimestamp)
  if (timeDiff.gt(BigInt.fromI32(PRICE_CACHE_DURATION))) {
    bundle.ethPriceUSD = getEthPriceInUSD(blockTimestamp)
    bundle.lastUpdateBlock = BigInt.fromI32(0) // Block-based caching not used
    bundle.lastUpdateTimestamp = blockTimestamp
    bundle.save()
  }
  
  return bundle.ethPriceUSD
}

export function getTokenPriceETH(token: Address, blockTimestamp: BigInt): BigDecimal | null {
  const tokenAddress = token
  const wethAddress = Address.fromString(WETH)
  const fees = [500, 3000, 10000]

  let tokenPriceETH = ZERO_BD
  let largestLiquidity = ZERO_BI

  const decimals = fetchTokenDecimals(Bytes.fromHexString(token.toHexString()), blockTimestamp)
  if (decimals === null) {
    log.debug('the decimals on {} token was null', [token.toHexString()])
    return null
  }

  if (token.equals(Address.fromString(WETH))) {
    return ONE_BD
  }

  for (let i=0; i<fees.length; i++) {
    // Use cached pool info instead of direct RPC calls
    let poolInfo = getCachedPoolInfo(tokenAddress, wethAddress, fees[i])
    if (poolInfo === null) {
      continue
    }
    
    // Use cached liquidity and slot0 instead of direct RPC calls
    let liquidity = getCachedPoolLiquidity(poolInfo, blockTimestamp)
    
    if (liquidity.gt(ZERO_BI) && liquidity.gt(largestLiquidity)) {
      // Use cached sqrtPriceX96 instead of RPC call
      let sqrtPriceX96 = getCachedSlot0(poolInfo, blockTimestamp)
      let token0 = Address.fromBytes(poolInfo.token0)
      let token1 = Address.fromBytes(poolInfo.token1)
      
      if (token0.equals(tokenAddress)) {
        tokenPriceETH = sqrtPriceX96ToTokenPrices(sqrtPriceX96, token0, token1, blockTimestamp)[1]
      } else {
        tokenPriceETH = sqrtPriceX96ToTokenPrices(sqrtPriceX96, token0, token1, blockTimestamp)[0]
      }
      largestLiquidity = liquidity
    }
  }

  return tokenPriceETH
}

// PriceCache-based token price caching (updates every 10 minutes)
export function getCachedTokenPriceETH(token: Address, blockTimestamp: BigInt): BigDecimal | null {
  // Generate cache ID with 10-minute intervals (round timestamp to 10-minute units)
  let cacheTimestamp = blockTimestamp.div(BigInt.fromI32(PRICE_CACHE_DURATION)).times(BigInt.fromI32(PRICE_CACHE_DURATION))
  let cacheId = token.toHexString() + "-" + cacheTimestamp.toString()
  let cached = PriceCache.load(cacheId)
  
  if (cached !== null) {
    return cached.priceETH  // Return cached price
  }
  
  // Cache miss - calculate new price
  let price = getTokenPriceETH(token, blockTimestamp)
  if (price !== null) {
    let cache = new PriceCache(cacheId)
    cache.tokenAddress = Bytes.fromHexString(token.toHexString())
    cache.priceETH = price
    cache.blockNumber = BigInt.fromI32(0) // Block-based caching not used
    cache.timestamp = cacheTimestamp
    cache.save()  // Save to database
  }
  
  return price
}

// Pool Info Caching Functions
function createPoolId(tokenA: Address, tokenB: Address, fee: i32): string {
  // Ensure tokenA < tokenB for consistent ID, convert to lowercase for case consistency
  let token0: string
  let token1: string
  let tokenALower = tokenA.toHexString().toLowerCase()
  let tokenBLower = tokenB.toHexString().toLowerCase()
  
  if (tokenALower < tokenBLower) {
    token0 = tokenALower
    token1 = tokenBLower
  } else {
    token0 = tokenBLower
    token1 = tokenALower
  }
  return token0 + "-" + token1 + "-" + fee.toString()
}

function getPoolInfo(tokenA: Address, tokenB: Address, fee: i32): PoolInfo | null {
  // Try to get pool address from factory
  let factory = UniswapV3Factory.bind(Address.fromString(UNISWAP_V3_FACTORY))
  let poolAddressResult = factory.try_getPool(tokenA, tokenB, fee)
  
  if (poolAddressResult.reverted || poolAddressResult.value.equals(Address.zero())) {
    // Pool doesn't exist
    return null
  }
  
  // Pool exists - get token0 and token1
  let pool = UniswapV3Pool.bind(poolAddressResult.value)
  let token0Result = pool.try_token0()
  let token1Result = pool.try_token1()
  
  if (token0Result.reverted || token1Result.reverted) {
    // Failed to get token info
    return null
  }
  
  // Create and populate PoolInfo
  let poolId = createPoolId(tokenA, tokenB, fee)
  let poolInfo = new PoolInfo(poolId)
  
  // Sort tokens for consistent storage, convert to lowercase for case consistency
  let tokenALower = tokenA.toHexString().toLowerCase()
  let tokenBLower = tokenB.toHexString().toLowerCase()
  
  if (tokenALower < tokenBLower) {
    poolInfo.tokenA = Bytes.fromHexString(tokenALower)
    poolInfo.tokenB = Bytes.fromHexString(tokenBLower)
  } else {
    poolInfo.tokenA = Bytes.fromHexString(tokenBLower)
    poolInfo.tokenB = Bytes.fromHexString(tokenALower)
  }
  poolInfo.fee = fee
  poolInfo.poolAddress = Bytes.fromHexString(poolAddressResult.value.toHexString())
  poolInfo.token0 = Bytes.fromHexString(token0Result.value.toHexString())
  poolInfo.token1 = Bytes.fromHexString(token1Result.value.toHexString())
  
  // Initialize liquidity and slot0 (will be updated on first use)
  poolInfo.liquidity = ZERO_BI
  poolInfo.liquidityUpdatedTimestamp = ZERO_BI
  poolInfo.sqrtPriceX96 = ZERO_BI
  poolInfo.slot0UpdatedTimestamp = ZERO_BI
  
  return poolInfo
}

function getCachedPoolInfo(tokenA: Address, tokenB: Address, fee: i32): PoolInfo | null {
  let poolId = createPoolId(tokenA, tokenB, fee)
  let cached = PoolInfo.load(poolId)
  
  if (cached !== null) {
    // Pool info is immutable - use cached value permanently
    return cached
  }
  
  // Cache miss - fetch new data
  let poolInfo = getPoolInfo(tokenA, tokenB, fee)
  
  // Only save to cache if pool exists
  if (poolInfo !== null) {
    poolInfo.save()
    return poolInfo
  }
  
  // Pool doesn't exist - don't cache, return null
  return null
}

// Pool liquidity caching function
function getCachedPoolLiquidity(poolInfo: PoolInfo, blockTimestamp: BigInt): BigInt {
  // Check if liquidity data is still valid (within 6 hours)
  let timeDiff = blockTimestamp.minus(poolInfo.liquidityUpdatedTimestamp)
  if (timeDiff.lt(BigInt.fromI32(POOL_LIQUIDITY_CACHE_DURATION))) {
    // Use cached liquidity
    return poolInfo.liquidity
  }
  
  // Update liquidity from RPC call
  let pool = UniswapV3Pool.bind(Address.fromBytes(poolInfo.poolAddress))
  let liquidityResult = pool.try_liquidity()
  
  if (liquidityResult.reverted) {
    // Return cached value if RPC fails
    return poolInfo.liquidity
  }
  
  // Update cached liquidity
  poolInfo.liquidity = liquidityResult.value
  poolInfo.liquidityUpdatedTimestamp = blockTimestamp
  poolInfo.save()
  
  return liquidityResult.value
}

// Pool slot0 caching function
function getCachedSlot0(poolInfo: PoolInfo, blockTimestamp: BigInt): BigInt {
  // Check if slot0 data is still valid (within 15 minutes)
  let timeDiff = blockTimestamp.minus(poolInfo.slot0UpdatedTimestamp)
  if (timeDiff.lt(BigInt.fromI32(POOL_SLOT0_CACHE_DURATION))) {
    // Use cached sqrtPriceX96
    return poolInfo.sqrtPriceX96
  }
  
  // Update slot0 from RPC call
  let pool = UniswapV3Pool.bind(Address.fromBytes(poolInfo.poolAddress))
  let slot0Result = pool.try_slot0()
  
  if (slot0Result.reverted) {
    // Return cached value if RPC fails
    return poolInfo.sqrtPriceX96
  }
  
  // Update cached slot0
  poolInfo.sqrtPriceX96 = slot0Result.value.getSqrtPriceX96()
  poolInfo.slot0UpdatedTimestamp = blockTimestamp
  poolInfo.save()
  
  return poolInfo.sqrtPriceX96
}