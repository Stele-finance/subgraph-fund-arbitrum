import { Address, BigInt, BigDecimal, log, Bytes } from "@graphprotocol/graph-ts"
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
  Investor,
  FundShare,
  InvestorShare
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
import { getInvestorID } from './util/investor'

export function handleDeposit(event: DepositEvent): void {
  let entity = new Deposit(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.investor = event.params.investor
  entity.token = event.params.token
  
  // Update FundShare entity
  let fundShareId = event.params.fundId.toString()
  let fundShare = FundShare.load(fundShareId)
  if (fundShare === null) {
    fundShare = new FundShare(fundShareId)
    fundShare.fundId = event.params.fundId
  }
  fundShare.totalShare = event.params.totalShare
  fundShare.blockNumber = event.block.number
  fundShare.blockTimestamp = event.block.timestamp
  fundShare.transactionHash = event.transaction.hash
  fundShare.save()

  // Update InvestorShare entity
  let investorShareId = getInvestorID(event.params.fundId, event.params.investor)
  let investorShare = InvestorShare.load(investorShareId)
  if (investorShare === null) {
    investorShare = new InvestorShare(investorShareId)
    investorShare.fundId = event.params.fundId
    investorShare.investor = event.params.investor
  }
  investorShare.share = event.params.share
  investorShare.blockNumber = event.block.number
  investorShare.blockTimestamp = event.block.timestamp
  investorShare.transactionHash = event.transaction.hash
  investorShare.save()
  
  // Convert raw amount to formatted amount
  let tokenDecimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
  if (tokenDecimals !== null) {
    let decimalDivisor = exponentToBigDecimal(tokenDecimals)
    let formattedAmount = BigDecimal.fromString(event.params.amount.toString())
      .div(decimalDivisor)
    entity.amount = formattedAmount
  } else {
    log.warning('[DEPOSIT] Failed to get decimals for token: {}', [event.params.token.toHexString()])
    entity.amount = BigDecimal.fromString("0")
  }
  
  // Fetch token symbol
  entity.symbol = fetchTokenSymbol(event.params.token, event.block.timestamp)
  
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

    // Use the formatted amount from entity.amount instead of raw amount
    const amountDecimal = entity.amount
    const amountETH = amountDecimal.times(tokenPriceETH)
    const amountUSD = amountETH.times(ethPriceInUSD)

    // Update investor
    const investorID = getInvestorID(fundId, event.params.investor)
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
  entity.manager = event.params.investor  // In SteleFund contract, the second param is still 'investor' but it's actually the manager
  entity.token = event.params.token
  
  // Convert raw amount to formatted amount
  let tokenDecimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
  if (tokenDecimals !== null) {
    let decimalDivisor = exponentToBigDecimal(tokenDecimals)
    let formattedAmount = BigDecimal.fromString(event.params.amount.toString())
      .div(decimalDivisor)
    entity.amount = formattedAmount
  } else {
    log.warning('[DEPOSIT_FEE] Failed to get decimals for token: {}', [event.params.token.toHexString()])
    entity.amount = BigDecimal.fromString("0")
  }
  
  // Fetch token symbol
  entity.symbol = fetchTokenSymbol(event.params.token, event.block.timestamp)
  
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
  
  // Convert raw amounts to formatted amounts
  let tokenInDecimals = fetchTokenDecimals(event.params.tokenIn, event.block.timestamp)
  let tokenOutDecimals = fetchTokenDecimals(event.params.tokenOut, event.block.timestamp)
  
  if (tokenInDecimals !== null) {
    let decimalDivisor = exponentToBigDecimal(tokenInDecimals)
    let formattedAmount = BigDecimal.fromString(event.params.amountIn.toString())
      .div(decimalDivisor)
    entity.tokenInAmount = formattedAmount
  } else {
    log.warning('[SWAP] Failed to get decimals for tokenIn: {}', [event.params.tokenIn.toHexString()])
    entity.tokenInAmount = BigDecimal.fromString("0")
  }
  
  if (tokenOutDecimals !== null) {
    let decimalDivisor = exponentToBigDecimal(tokenOutDecimals)
    let formattedAmount = BigDecimal.fromString(event.params.amountOut.toString())
      .div(decimalDivisor)
    entity.tokenOutAmount = formattedAmount
  } else {
    log.warning('[SWAP] Failed to get decimals for tokenOut: {}', [event.params.tokenOut.toHexString()])
    entity.tokenOutAmount = BigDecimal.fromString("0")
  }
  
  // Fetch token symbols
  entity.tokenInSymbol = fetchTokenSymbol(event.params.tokenIn, event.block.timestamp)
  entity.tokenOutSymbol = fetchTokenSymbol(event.params.tokenOut, event.block.timestamp)
  
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  const fundId = event.params.fundId
  let fund = Fund.load(fundId.toString())
  if (fund !== null) {
    // Use the formatted amounts from entity
    const amountIn = entity.tokenInAmount
    const amountOut = entity.tokenOutAmount
    const tokenOutDecimals = fetchTokenDecimals(event.params.tokenOut, event.block.timestamp)

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
      if (tokenOutDecimals !== null) {
        decimalsArray.push(tokenOutDecimals)
      } else {
        decimalsArray.push(BigInt.fromI32(18)) // default to 18 decimals
      }
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
  
  const fundId = event.params.fundId
  const investorID = getInvestorID(fundId, event.params.investor)
  
  // Get current (pre-withdrawal) shares
  let fundShare = FundShare.load(fundId.toString())
  let investorShare = InvestorShare.load(investorID)
  
  // Use percentage directly from event parameters
  let withdrawalPercentage = BigDecimal.fromString(event.params.percentage.toString())
    .div(BigDecimal.fromString("10000")) // Assuming percentage is in basis points (10000 = 100%)
  
  entity.percentage = withdrawalPercentage
  entity.amountUSD = ZERO_BD // Will be calculated based on actual withdrawn tokens
  
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  // Update FundShare entity with post-withdrawal values
  if (fundShare !== null) {
    fundShare.totalShare = event.params.totalShare
    fundShare.blockNumber = event.block.number
    fundShare.blockTimestamp = event.block.timestamp
    fundShare.transactionHash = event.transaction.hash
    fundShare.save()
  }

  // Update InvestorShare entity with post-withdrawal values
  if (investorShare !== null) {
    investorShare.share = event.params.share
    investorShare.blockNumber = event.block.number
    investorShare.blockTimestamp = event.block.timestamp
    investorShare.transactionHash = event.transaction.hash
    investorShare.save()
  }

  // Update investor share and portfolio
  let investor = Investor.load(investorID)
  if (investor !== null && fundShare !== null) {
    investor.share = event.params.share
    investor.updatedAtTimestamp = event.block.timestamp
    
    // Get actual fund tokens from contract
    let fundInfoContract = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
    let tokensResult = fundInfoContract.try_getFundTokens(fundId)
    
    if (!tokensResult.reverted && event.params.totalShare.gt(ZERO_BI)) {
      let tokens = tokensResult.value
      let investorRatio = BigDecimal.fromString(event.params.share.toString())
        .div(BigDecimal.fromString(event.params.totalShare.toString()))
      
      // Calculate investor's current portfolio
      let currentTokens: Array<Bytes> = []
      let currentTokensSymbols: Array<string> = []
      let currentTokensDecimals: Array<BigInt> = []
      let currentTokensAmount: Array<BigDecimal> = []
      let totalCurrentETH = ZERO_BD
      let totalCurrentUSD = ZERO_BD
      
      const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
      
      for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i]
        let tokenAddress = Address.fromBytes(token.token)
        let tokenDecimals = fetchTokenDecimals(tokenAddress, event.block.timestamp)
        
        if (tokenDecimals !== null) {
          let decimalDivisor = exponentToBigDecimal(tokenDecimals)
          let fundTokenAmount = BigDecimal.fromString(token.amount.toString()).div(decimalDivisor)
          let investorTokenAmount = fundTokenAmount.times(investorRatio)
          
          if (investorTokenAmount.gt(ZERO_BD)) {
            currentTokens.push(token.token)
            currentTokensSymbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
            currentTokensDecimals.push(tokenDecimals)
            currentTokensAmount.push(investorTokenAmount)
            
            // Calculate ETH and USD value
            let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
            if (tokenPriceETH !== null) {
              let valueETH = investorTokenAmount.times(tokenPriceETH)
              totalCurrentETH = totalCurrentETH.plus(valueETH)
              totalCurrentUSD = totalCurrentUSD.plus(valueETH.times(ethPriceInUSD))
            }
          }
        }
      }
      
      // Update investor's current portfolio
      investor.currentTokens = currentTokens
      investor.currentTokensSymbols = currentTokensSymbols
      investor.currentTokensDecimals = currentTokensDecimals
      investor.currentTokensAmount = currentTokensAmount
      investor.currentETH = totalCurrentETH
      investor.currentUSD = totalCurrentUSD
      
      // Calculate profit
      investor.profitETH = totalCurrentETH.minus(investor.principalETH)
      investor.profitUSD = totalCurrentUSD.minus(investor.principalUSD)
      if (investor.principalUSD.gt(ZERO_BD)) {
        investor.profitRatio = investor.profitUSD.div(investor.principalUSD)
      } else {
        investor.profitRatio = ZERO_BD
      }
    }
    
    investor.save()
  }

  // Update Fund entity with actual contract data
  let fund = Fund.load(fundId.toString())
  if (fund !== null) {
    // Get actual fund tokens from contract
    let fundInfoContract = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
    let tokensResult = fundInfoContract.try_getFundTokens(fundId)
    
    if (!tokensResult.reverted) {
      let tokens = tokensResult.value
      let fundCurrentTokens: Array<Bytes> = []
      let fundCurrentTokensSymbols: Array<string> = []
      let fundCurrentTokensDecimals: Array<BigInt> = []
      let fundCurrentTokensAmount: Array<BigDecimal> = []
      let fundTotalETH = ZERO_BD
      let fundTotalUSD = ZERO_BD
      
      const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
      
      for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i]
        let tokenAddress = Address.fromBytes(token.token)
        let tokenDecimals = fetchTokenDecimals(tokenAddress, event.block.timestamp)
        
        if (tokenDecimals !== null) {
          let decimalDivisor = exponentToBigDecimal(tokenDecimals)
          let tokenAmount = BigDecimal.fromString(token.amount.toString()).div(decimalDivisor)
          
          if (tokenAmount.gt(ZERO_BD)) {
            fundCurrentTokens.push(token.token)
            fundCurrentTokensSymbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
            fundCurrentTokensDecimals.push(tokenDecimals)
            fundCurrentTokensAmount.push(tokenAmount)
            
            // Calculate ETH and USD value
            let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
            if (tokenPriceETH !== null) {
              let valueETH = tokenAmount.times(tokenPriceETH)
              fundTotalETH = fundTotalETH.plus(valueETH)
              fundTotalUSD = fundTotalUSD.plus(valueETH.times(ethPriceInUSD))
            }
          }
        }
      }
      
      // Update fund with actual contract data
      fund.currentTokens = fundCurrentTokens
      fund.currentTokensSymbols = fundCurrentTokensSymbols
      fund.currentTokensDecimals = fundCurrentTokensDecimals
      fund.currentTokensAmount = fundCurrentTokensAmount
      fund.currentETH = fundTotalETH
      fund.currentUSD = fundTotalUSD
    }
    
    fund.updatedAtTimestamp = event.block.timestamp
    fund.save()
  }
  
  // Calculate withdrawn amount USD based on actual tokens withdrawn
  if (withdrawalPercentage.gt(ZERO_BD)) {
    let totalWithdrawnUSD = ZERO_BD
    let totalWithdrawnETH = ZERO_BD
    const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
    
    // Get pre-withdrawal fund tokens to calculate withdrawn amounts
    let fundInfoContract = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
    let preWithdrawTokensResult = fundInfoContract.try_getFundTokens(fundId)
    
    if (!preWithdrawTokensResult.reverted) {
      let preWithdrawTokens = preWithdrawTokensResult.value
      
      // Calculate withdrawn amount for each token
      for (let i = 0; i < preWithdrawTokens.length; i++) {
        let token = preWithdrawTokens[i]
        let tokenAddress = Address.fromBytes(token.token)
        let tokenDecimals = fetchTokenDecimals(tokenAddress, event.block.timestamp)
        
        if (tokenDecimals !== null) {
          let decimalDivisor = exponentToBigDecimal(tokenDecimals)
          // Pre-withdrawal amount (from historical data or calculation)
          let preWithdrawAmount = BigDecimal.fromString(token.amount.toString()).div(decimalDivisor)
          // Calculate withdrawn amount based on percentage
          let withdrawnAmount = preWithdrawAmount.times(withdrawalPercentage).div(BigDecimal.fromString("1").minus(withdrawalPercentage))
          
          // Calculate ETH and USD value of withdrawn tokens
          let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
          if (tokenPriceETH !== null) {
            let valueETH = withdrawnAmount.times(tokenPriceETH)
            totalWithdrawnETH = totalWithdrawnETH.plus(valueETH)
            totalWithdrawnUSD = totalWithdrawnUSD.plus(valueETH.times(ethPriceInUSD))
          }
        }
      }
    }
    
    // Update the Withdraw entity with calculated USD amount
    entity.amountUSD = totalWithdrawnUSD
    entity.save()
    
    // Update investor's principal (subtract withdrawn amount)
    if (investor !== null) {
      investor.principalETH = investor.principalETH.minus(totalWithdrawnETH)
      investor.principalUSD = investor.principalUSD.minus(totalWithdrawnUSD)
      investor.save()
    }
  }
}

export function handleWithdrawFee(event: WithdrawFeeEvent): void {
  let entity = new WithdrawFee(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.fundId = event.params.fundId
  entity.manager = event.params.manager
  entity.token = event.params.token
  
  // Convert raw amount to formatted amount
  let tokenDecimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
  if (tokenDecimals !== null) {
    let decimalDivisor = exponentToBigDecimal(tokenDecimals)
    let formattedAmount = BigDecimal.fromString(event.params.amount.toString())
      .div(decimalDivisor)
    entity.amount = formattedAmount
  } else {
    log.warning('[WITHDRAW_FEE] Failed to get decimals for token: {}', [event.params.token.toHexString()])
    entity.amount = BigDecimal.fromString("0")
  }
  
  // Fetch token symbol
  entity.symbol = fetchTokenSymbol(event.params.token, event.block.timestamp)
  
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