import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { ONE_BD, ZERO_BD } from './constants'

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = 0; i < decimals.toI32(); i++) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
  if (amount1.equals(ZERO_BD)) {
    return ZERO_BD
  } else {
    return amount0.div(amount1)
  }
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == BigInt.fromI32(0)) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}