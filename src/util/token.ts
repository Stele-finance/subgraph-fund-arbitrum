import { BigInt, Address, Bytes } from '@graphprotocol/graph-ts'
import { ERC20 } from '../../generated/SteleFund/ERC20'
import { TOKEN_INFO_CACHE_DURATION, UNKNOWN } from './constants'
import { TokenCache } from '../../generated/schema'

// Token entity-based time caching for ERC20 calls optimization (1-week cache)
function getCachedTokenDecimals(tokenAddress: Bytes, blockTimestamp: BigInt): BigInt | null {  
  let token = TokenCache.load(tokenAddress)
  if (token !== null) {
    // Use cached value if not expired (within cache duration)
    let timeDiff = blockTimestamp.minus(token.updatedTimestamp)
    if (timeDiff.lt(BigInt.fromI32(TOKEN_INFO_CACHE_DURATION))) {
      return token.decimals
    }
  }
  
  // Cache miss or expired - fetch new data
  let contract = ERC20.bind(Address.fromBytes(tokenAddress))
  let decimalsResult = contract.try_decimals()
  if (!decimalsResult.reverted) {
    let decimals = BigInt.fromI32(decimalsResult.value)
    
    // Update or create Token entity (need both decimals and symbol)
    if (token === null) {
      token = new TokenCache(tokenAddress)
      token.tokenAddress = tokenAddress
      
      // Also fetch symbol to avoid schema validation error
      let symbolResult = contract.try_symbol()
      token.symbol = symbolResult.reverted ? UNKNOWN : symbolResult.value
    }
    token.decimals = decimals
    token.updatedTimestamp = blockTimestamp
    token.save()
    
    return decimals
  }
  return null
}

function getCachedTokenSymbol(tokenAddress: Bytes, blockTimestamp: BigInt): string {  
  let token = TokenCache.load(tokenAddress)
  if (token !== null) {
    // Use cached value if not expired (within cache duration)
    let timeDiff = blockTimestamp.minus(token.updatedTimestamp)
    if (timeDiff.lt(BigInt.fromI32(TOKEN_INFO_CACHE_DURATION))) {
      return token.symbol
    }
  }
  
  // Cache miss or expired - fetch new data
  let contract = ERC20.bind(Address.fromBytes(tokenAddress))
  let symbolResult = contract.try_symbol()
  let symbol = UNKNOWN
  if (!symbolResult.reverted) {
    symbol = symbolResult.value
  }
  
  // Update or create Token entity (need both decimals and symbol)
  if (token === null) {
    token = new TokenCache(tokenAddress)
    token.tokenAddress = tokenAddress
    // Also fetch decimals to avoid schema validation error
    let decimalsResult = contract.try_decimals()
    token.decimals = decimalsResult.reverted ? BigInt.fromI32(18) : BigInt.fromI32(decimalsResult.value)
  }
  token.symbol = symbol
  token.updatedTimestamp = blockTimestamp
  token.save()
  
  return symbol
}

export function fetchTokenDecimals(tokenAddress: Bytes, blockTimestamp: BigInt): BigInt | null {
  return getCachedTokenDecimals(tokenAddress, blockTimestamp)
}

export function fetchTokenSymbol(tokenAddress: Bytes, blockTimestamp: BigInt): string {
  return getCachedTokenSymbol(tokenAddress, blockTimestamp)
}