import { Address, BigInt, log } from "@graphprotocol/graph-ts"
import {
  Deposit as DepositEvent,
  DepositFee as DepositFeeEvent,
  Swap as SwapEvent,
  Withdraw as WithdrawEvent,
  WithdrawFee as WithdrawFeeEvent,
} from "../generated/SteleFund/SteleFund"
import {
  SteleFundInfo
} from "../generated/SteleFundInfo/SteleFundInfo"
import {
  Fund,
  Deposit,
  DepositFee,
  Swap,
  Withdraw,
  WithdrawFee,
  Investor
} from "../generated/schema"
import {
  ZERO_BD,
  ZERO_BI,
  STELE_FUND_INFO_ADDRESS,
} from './util/constants'
import { exponentToBigDecimal } from "./util"
import {
  getCachedEthPriceUSD,
  getCachedTokenPriceETH,
} from './util/pricing'
import { fetchTokenSymbol, fetchTokenDecimals } from './util/token'

export function handleDeposit(event: DepositEvent): void {
  let entity = new Deposit(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.investor = event.params.investor
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  const fundId = event.params.fundId
  const managerAddress = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
    .try_manager(fundId)
  
  if (!managerAddress.reverted) {
    const decimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
    if (decimals === null) {
      log.debug('the decimals on {} token was null', [event.params.token.toHexString()])
      return
    }

    const tokenDecimal = exponentToBigDecimal(decimals)
    const tokenPriceETH = getCachedTokenPriceETH(event.params.token, event.block.timestamp)
    if (tokenPriceETH === null) return
    const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)

    const amountDecimal = event.params.amount.divDecimal(tokenDecimal)
    const amountETH = amountDecimal.times(tokenPriceETH)
    const amountUSD = amountETH.times(ethPriceInUSD)

    // Update investor
    const investorID = fundId.toString() + "-" + event.params.investor.toHexString()
    let investor = Investor.load(investorID)
    if (investor !== null) {
      investor.principalETH = investor.principalETH.plus(amountETH)
      investor.principalUSD = investor.principalUSD.plus(amountUSD)
      investor.updatedAtTimestamp = event.block.timestamp
      investor.save()
    }

    // Update fund
    let fund = Fund.load(fundId.toString())
    if (fund !== null) {
      fund.currentETH = fund.currentETH.plus(amountETH)
      fund.currentUSD = fund.currentUSD.plus(amountUSD)
      fund.updatedAtTimestamp = event.block.timestamp
      
      // Add token to fund if not already present
      let tokenAddress = event.params.token
      let tokenIndex = -1
      for (let i = 0; i < fund.currentTokens.length; i++) {
        if (fund.currentTokens[i].equals(tokenAddress)) {
          tokenIndex = i
          break
        }
      }
      
      if (tokenIndex === -1) {
        // New token
        let tokens = fund.currentTokens
        let symbols = fund.currentTokensSymbols
        let decimalsArray = fund.currentTokensDecimals
        let amounts = fund.currentTokensAmount
        
        tokens.push(tokenAddress)
        symbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
        decimalsArray.push(decimals)
        amounts.push(amountDecimal)
        
        fund.currentTokens = tokens
        fund.currentTokensSymbols = symbols
        fund.currentTokensDecimals = decimalsArray
        fund.currentTokensAmount = amounts
      } else {
        // Existing token
        let amounts = fund.currentTokensAmount
        amounts[tokenIndex] = amounts[tokenIndex].plus(amountDecimal)
        fund.currentTokensAmount = amounts
      }
      
      fund.save()
    }
  }
}

export function handleDepositFee(event: DepositFeeEvent): void {
  let entity = new DepositFee(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.investor = event.params.investor
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
}

export function handleSwap(event: SwapEvent): void {
  let entity = new Swap(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.investor = event.transaction.from
  entity.tokenIn = event.params.tokenIn
  entity.tokenOut = event.params.tokenOut
  entity.amountIn = event.params.amountIn
  entity.amountOut = event.params.amountOut
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  const fundId = event.params.fundId
  let fund = Fund.load(fundId.toString())
  if (fund !== null) {
    const tokenInDecimals = fetchTokenDecimals(event.params.tokenIn, event.block.timestamp)
    const tokenOutDecimals = fetchTokenDecimals(event.params.tokenOut, event.block.timestamp)
    
    if (tokenInDecimals === null || tokenOutDecimals === null) {
      log.debug('token decimals was null', [])
      return
    }

    const tokenInDecimal = exponentToBigDecimal(tokenInDecimals)
    const tokenOutDecimal = exponentToBigDecimal(tokenOutDecimals)
    const amountIn = event.params.amountIn.divDecimal(tokenInDecimal)
    const amountOut = event.params.amountOut.divDecimal(tokenOutDecimal)

    // Update token balances
    let tokenInIndex = -1
    let tokenOutIndex = -1
    
    for (let i = 0; i < fund.currentTokens.length; i++) {
      if (fund.currentTokens[i].equals(event.params.tokenIn)) {
        tokenInIndex = i
      }
      if (fund.currentTokens[i].equals(event.params.tokenOut)) {
        tokenOutIndex = i
      }
    }

    // Update tokenIn balance (decrease)
    if (tokenInIndex !== -1) {
      let amounts = fund.currentTokensAmount
      amounts[tokenInIndex] = amounts[tokenInIndex].minus(amountIn)
      if (amounts[tokenInIndex].le(ZERO_BD)) {
        // Remove token if balance is zero
        let tokens = fund.currentTokens
        let symbols = fund.currentTokensSymbols
        let decimalsArray = fund.currentTokensDecimals
        
        tokens.splice(tokenInIndex, 1)
        symbols.splice(tokenInIndex, 1)
        decimalsArray.splice(tokenInIndex, 1)
        amounts.splice(tokenInIndex, 1)
        
        fund.currentTokens = tokens
        fund.currentTokensSymbols = symbols
        fund.currentTokensDecimals = decimalsArray
      }
      fund.currentTokensAmount = amounts
    }

    // Update tokenOut balance (increase)
    if (tokenOutIndex === -1) {
      // New token
      let tokens = fund.currentTokens
      let symbols = fund.currentTokensSymbols
      let decimalsArray = fund.currentTokensDecimals
      let amounts = fund.currentTokensAmount
      
      tokens.push(event.params.tokenOut)
      symbols.push(fetchTokenSymbol(event.params.tokenOut, event.block.timestamp))
      decimalsArray.push(tokenOutDecimals)
      amounts.push(amountOut)
      
      fund.currentTokens = tokens
      fund.currentTokensSymbols = symbols
      fund.currentTokensDecimals = decimalsArray
      fund.currentTokensAmount = amounts
    } else {
      // Existing token
      let amounts = fund.currentTokensAmount
      amounts[tokenOutIndex] = amounts[tokenOutIndex].plus(amountOut)
      fund.currentTokensAmount = amounts
    }

    // Update ETH and USD values
    const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
    let totalETH = ZERO_BD
    let totalUSD = ZERO_BD
    
    for (let i = 0; i < fund.currentTokens.length; i++) {
      let tokenPriceETH = getCachedTokenPriceETH(Address.fromBytes(fund.currentTokens[i]), event.block.timestamp)
      if (tokenPriceETH !== null) {
        let valueETH = fund.currentTokensAmount[i].times(tokenPriceETH)
        totalETH = totalETH.plus(valueETH)
        totalUSD = totalUSD.plus(valueETH.times(ethPriceInUSD))
      }
    }
    
    fund.currentETH = totalETH
    fund.currentUSD = totalUSD
    fund.updatedAtTimestamp = event.block.timestamp
    fund.save()
  }
}

export function handleWithdraw(event: WithdrawEvent): void {
  let entity = new Withdraw(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.investor = event.params.investor
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.feeAmount = event.params.feeAmount
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  const fundId = event.params.fundId
  const decimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
  if (decimals === null) {
    log.debug('the decimals on {} token was null', [event.params.token.toHexString()])
    return
  }

  const tokenDecimal = exponentToBigDecimal(decimals)
  const tokenPriceETH = getCachedTokenPriceETH(event.params.token, event.block.timestamp)
  if (tokenPriceETH === null) return
  const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
  
  const amountDecimal = event.params.amount.divDecimal(tokenDecimal)
  const amountETH = amountDecimal.times(tokenPriceETH)
  const amountUSD = amountETH.times(ethPriceInUSD)

  // Update investor
  const investorID = fundId.toString() + "-" + event.params.investor.toHexString()
  let investor = Investor.load(investorID)
  if (investor !== null) {
    investor.principalETH = investor.principalETH.minus(amountETH)
    investor.principalUSD = investor.principalUSD.minus(amountUSD)
    investor.updatedAtTimestamp = event.block.timestamp
    investor.save()
  }

  // Update fund
  let fund = Fund.load(fundId.toString())
  if (fund !== null) {
    fund.currentETH = fund.currentETH.minus(amountETH)
    fund.currentUSD = fund.currentUSD.minus(amountUSD)
    fund.updatedAtTimestamp = event.block.timestamp
    
    // Update token balance
    for (let i = 0; i < fund.currentTokens.length; i++) {
      if (fund.currentTokens[i].equals(event.params.token)) {
        let amounts = fund.currentTokensAmount
        amounts[i] = amounts[i].minus(amountDecimal)
        
        if (amounts[i].le(ZERO_BD)) {
          // Remove token if balance is zero
          let tokens = fund.currentTokens
          let symbols = fund.currentTokensSymbols
          let decimalsArray = fund.currentTokensDecimals
          
          tokens.splice(i, 1)
          symbols.splice(i, 1)
          decimalsArray.splice(i, 1)
          amounts.splice(i, 1)
          
          fund.currentTokens = tokens
          fund.currentTokensSymbols = symbols
          fund.currentTokensDecimals = decimalsArray
        }
        fund.currentTokensAmount = amounts
        break
      }
    }
    
    // Handle fee
    if (event.params.feeAmount.gt(ZERO_BI)) {
      const feeDecimal = event.params.feeAmount.divDecimal(tokenDecimal)
      
      // Add to fee tokens
      let feeIndex = -1
      for (let i = 0; i < fund.feeTokens.length; i++) {
        if (fund.feeTokens[i].equals(event.params.token)) {
          feeIndex = i
          break
        }
      }
      
      if (feeIndex === -1) {
        // New fee token
        let feeTokens = fund.feeTokens
        let feeSymbols = fund.feeSymbols
        let feeAmounts = fund.feeTokensAmount
        
        feeTokens.push(event.params.token)
        feeSymbols.push(fetchTokenSymbol(event.params.token, event.block.timestamp))
        feeAmounts.push(feeDecimal)
        
        fund.feeTokens = feeTokens
        fund.feeSymbols = feeSymbols
        fund.feeTokensAmount = feeAmounts
      } else {
        // Existing fee token
        let feeAmounts = fund.feeTokensAmount
        feeAmounts[feeIndex] = feeAmounts[feeIndex].plus(feeDecimal)
        fund.feeTokensAmount = feeAmounts
      }
    }
    
    fund.save()
  }
}

export function handleWithdrawFee(event: WithdrawFeeEvent): void {
  let entity = new WithdrawFee(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.manager = event.params.manager
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
  
  const fundId = event.params.fundId
  let fund = Fund.load(fundId.toString())
  if (fund !== null) {
    // Remove from fee tokens
    for (let i = 0; i < fund.feeTokens.length; i++) {
      if (fund.feeTokens[i].equals(event.params.token)) {
        let feeTokens = fund.feeTokens
        let feeSymbols = fund.feeSymbols
        let feeAmounts = fund.feeTokensAmount
        
        feeTokens.splice(i, 1)
        feeSymbols.splice(i, 1)
        feeAmounts.splice(i, 1)
        
        fund.feeTokens = feeTokens
        fund.feeSymbols = feeSymbols
        fund.feeTokensAmount = feeAmounts
        break
      }
    }
    
    fund.updatedAtTimestamp = event.block.timestamp
    fund.save()
  }
}