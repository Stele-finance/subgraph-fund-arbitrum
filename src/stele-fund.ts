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
  USDC_DECIMALS,
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
      // Update investor share from InvestorShare entity
      let investorShare = InvestorShare.load(investorShareId)
      if (investorShare !== null) {
        investor.share = investorShare.share
      }
      
      // Calculate investor's current portfolio based on their share
      let fundInfoContract = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
      let tokensResult = fundInfoContract.try_getFundTokens(fundId)
      
      if (!tokensResult.reverted && fundShare !== null && fundShare.totalShare.gt(ZERO_BI)) {
        let contractTokens = tokensResult.value
        let investorRatio = BigDecimal.fromString(investor.share ? investor.share!.toString() : "0")
          .div(BigDecimal.fromString(fundShare.totalShare.toString()))
        
        let tokens: Array<Bytes> = []
        let tokensSymbols: Array<string> = []
        let tokensDecimals: Array<BigInt> = []
        let tokensAmount: Array<BigDecimal> = []
        let totalAmountUSD = ZERO_BD
        
        for (let i = 0; i < contractTokens.length; i++) {
          let token = contractTokens[i]
          let tokenAddress = Address.fromBytes(token.token)
          let tokenDecimals = fetchTokenDecimals(tokenAddress, event.block.timestamp)
          
          if (tokenDecimals !== null) {
            let decimalDivisor = exponentToBigDecimal(tokenDecimals)
            let fundTokenAmount = BigDecimal.fromString(token.amount.toString()).div(decimalDivisor)
            let investorTokenAmount = fundTokenAmount.times(investorRatio)
            
            if (investorTokenAmount.gt(ZERO_BD)) {
              tokens.push(token.token)
              tokensSymbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
              tokensDecimals.push(tokenDecimals)
              tokensAmount.push(investorTokenAmount)
              
              // Calculate USD value
              let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
              if (tokenPriceETH !== null) {
                let valueETH = investorTokenAmount.times(tokenPriceETH)
                totalAmountUSD = totalAmountUSD.plus(valueETH.times(ethPriceInUSD))
              }
            }
          }
        }
        
        investor.tokens = tokens
        investor.tokensSymbols = tokensSymbols
        investor.tokensDecimals = tokensDecimals
        investor.tokensAmount = tokensAmount
        investor.amountUSD = totalAmountUSD
        
        // Calculate profit: current USD value - principal (share in USDC raw)
        if (investor.share && investor.share!.gt(ZERO_BI)) {
          let principalUSD = BigDecimal.fromString(investor.share!.toString())
            .div(USDC_DECIMALS) // Convert USDC raw to decimal
          
          investor.profitUSD = totalAmountUSD.minus(principalUSD)
          investor.profitRatio = investor.profitUSD.div(principalUSD)
        } else {
          investor.profitUSD = ZERO_BD
          investor.profitRatio = ZERO_BD
        }
      }
      
      investor.updatedAtTimestamp = event.block.timestamp
      investor.save()
    }

    // Update fund
    let fund = Fund.load(fundId.toString())
    if (fund !== null) {
      // Update share with FundShare totalShare (USDC raw amount)
      fund.share = event.params.totalShare
      fund.amountUSD = fund.amountUSD.plus(amountUSD)
      
      // Calculate Fund profit: current USD value - principal (share is USDC raw)
      if (fund.share.gt(ZERO_BI)) {
        let shareUSD = BigDecimal.fromString(fund.share.toString())
          .div(USDC_DECIMALS) // Convert USDC raw to decimal
        
        // Calculate profit: current value - principal
        fund.profitUSD = fund.amountUSD.minus(shareUSD)
        
        // Calculate profit ratio
        fund.profitRatio = fund.profitUSD.div(shareUSD)
      } else {
        fund.profitUSD = ZERO_BD
        fund.profitRatio = ZERO_BD
      }
      
      fund.updatedAtTimestamp = event.block.timestamp
      
      // Add token to fund if not already present
      let tokenAddress = event.params.token
      let tokenIndex = -1
      for (let i = 0; i < fund.tokens.length; i++) {
        if (fund.tokens[i].equals(tokenAddress)) {
          tokenIndex = i
          break
        }
      }
      
      if (tokenIndex === -1) {
        // New token
        let tokens = fund.tokens
        let symbols = fund.tokensSymbols
        let decimalsArray = fund.tokensDecimals
        let amounts = fund.tokensAmount
        
        tokens.push(tokenAddress)
        symbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
        decimalsArray.push(decimals)
        amounts.push(amountDecimal)
        
        fund.tokens = tokens
        fund.tokensSymbols = symbols
        fund.tokensDecimals = decimalsArray
        fund.tokensAmount = amounts
      } else {
        // Existing token
        let amounts = fund.tokensAmount
        amounts[tokenIndex] = amounts[tokenIndex].plus(amountDecimal)
        fund.tokensAmount = amounts
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
    
    for (let i = 0; i < fund.tokens.length; i++) {
      if (fund.tokens[i].equals(event.params.tokenIn)) {
        tokenInIndex = i
      }
      if (fund.tokens[i].equals(event.params.tokenOut)) {
        tokenOutIndex = i
      }
    }

    // Update tokenIn balance (decrease)
    if (tokenInIndex !== -1) {
      let amounts = fund.tokensAmount
      amounts[tokenInIndex] = amounts[tokenInIndex].minus(amountIn)
      if (amounts[tokenInIndex].le(ZERO_BD)) {
        // Remove token if balance is zero
        let tokens = fund.tokens
        let symbols = fund.tokensSymbols
        let decimalsArray = fund.tokensDecimals
        
        tokens.splice(tokenInIndex, 1)
        symbols.splice(tokenInIndex, 1)
        decimalsArray.splice(tokenInIndex, 1)
        amounts.splice(tokenInIndex, 1)
        
        fund.tokens = tokens
        fund.tokensSymbols = symbols
        fund.tokensDecimals = decimalsArray
      }
      fund.tokensAmount = amounts
    }

    // Update tokenOut balance (increase)
    if (tokenOutIndex === -1) {
      // New token
      let tokens = fund.tokens
      let symbols = fund.tokensSymbols
      let decimalsArray = fund.tokensDecimals
      let amounts = fund.tokensAmount
      
      tokens.push(event.params.tokenOut)
      symbols.push(fetchTokenSymbol(event.params.tokenOut, event.block.timestamp))
      if (tokenOutDecimals !== null) {
        decimalsArray.push(tokenOutDecimals)
      } else {
        decimalsArray.push(BigInt.fromI32(18)) // default to 18 decimals
      }
      amounts.push(amountOut)
      
      fund.tokens = tokens
      fund.tokensSymbols = symbols
      fund.tokensDecimals = decimalsArray
      fund.tokensAmount = amounts
    } else {
      // Existing token
      let amounts = fund.tokensAmount
      amounts[tokenOutIndex] = amounts[tokenOutIndex].plus(amountOut)
      fund.tokensAmount = amounts
    }

    // Update ETH and USD values
    const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
    let totalETH = ZERO_BD
    let totalUSD = ZERO_BD
    
    for (let i = 0; i < fund.tokens.length; i++) {
      let tokenPriceETH = getCachedTokenPriceETH(Address.fromBytes(fund.tokens[i]), event.block.timestamp)
      if (tokenPriceETH !== null) {
        let valueETH = fund.tokensAmount[i].times(tokenPriceETH)
        totalETH = totalETH.plus(valueETH)
        totalUSD = totalUSD.plus(valueETH.times(ethPriceInUSD))
      }
    }
    
    fund.amountUSD = totalUSD
    
    // Calculate Fund profit: current USD value - principal (share in USDC raw)
    if (fund.share.gt(ZERO_BI)) {
      // Convert share (USDC raw) to decimal
      let principalUSD = BigDecimal.fromString(fund.share.toString())
        .div(USDC_DECIMALS) // Convert USDC raw to decimal
              
      // Calculate profit: current value - principal
      fund.profitUSD = fund.amountUSD.minus(principalUSD)
      
      // Calculate profit ratio
      fund.profitRatio = fund.profitUSD.div(principalUSD)
    } else {
      fund.profitUSD = ZERO_BD
      fund.profitRatio = ZERO_BD
    }
    
    fund.updatedAtTimestamp = event.block.timestamp
    fund.save()

    // Update all investors after swap (token composition changed)
    const managerAddress = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
      .try_manager(fundId)
    
    if (!managerAddress.reverted) {
      // Get FundShare for total share calculation
      let fundShare = FundShare.load(fundId.toString())
      
      if (fundShare !== null && fundShare.totalShare.gt(ZERO_BI)) {
        // Update all investors' portfolios
        // Note: In a real implementation, you might want to track all investors
        // For now, we'll update the transaction sender (investor)
        const investorID = getInvestorID(fundId, event.transaction.from)
        let investor = Investor.load(investorID)
        
        if (investor !== null) {
          // Get actual fund tokens from contract
          let fundInfoContract = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
          let tokensResult = fundInfoContract.try_getFundTokens(fundId)
          
          if (!tokensResult.reverted && investor.share) {
            let contractTokens = tokensResult.value
            let investorRatio = BigDecimal.fromString(investor.share!.toString())
              .div(BigDecimal.fromString(fundShare.totalShare.toString()))
            
            let tokens: Array<Bytes> = []
            let tokensSymbols: Array<string> = []
            let tokensDecimals: Array<BigInt> = []
            let tokensAmount: Array<BigDecimal> = []
            let totalAmountUSD = ZERO_BD
            
            for (let i = 0; i < contractTokens.length; i++) {
              let token = contractTokens[i]
              let tokenAddress = Address.fromBytes(token.token)
              let tokenDecimals = fetchTokenDecimals(tokenAddress, event.block.timestamp)
              
              if (tokenDecimals !== null) {
                let decimalDivisor = exponentToBigDecimal(tokenDecimals)
                let fundTokenAmount = BigDecimal.fromString(token.amount.toString()).div(decimalDivisor)
                let investorTokenAmount = fundTokenAmount.times(investorRatio)
                
                if (investorTokenAmount.gt(ZERO_BD)) {
                  tokens.push(token.token)
                  tokensSymbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
                  tokensDecimals.push(tokenDecimals)
                  tokensAmount.push(investorTokenAmount)
                  
                  // Calculate USD value
                  let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
                  if (tokenPriceETH !== null) {
                    let valueETH = investorTokenAmount.times(tokenPriceETH)
                    totalAmountUSD = totalAmountUSD.plus(valueETH.times(ethPriceInUSD))
                  }
                }
              }
            }
            
            investor.tokens = tokens
            investor.tokensSymbols = tokensSymbols
            investor.tokensDecimals = tokensDecimals
            investor.tokensAmount = tokensAmount
            investor.amountUSD = totalAmountUSD
            
            // Calculate profit: current USD value - principal (share in USDC raw)
            if (investor.share && investor.share!.gt(ZERO_BI)) {
              let principalUSD = BigDecimal.fromString(investor.share!.toString())
                .div(USDC_DECIMALS) // Convert USDC raw to decimal
              
              investor.profitUSD = totalAmountUSD.minus(principalUSD)
              investor.profitRatio = investor.profitUSD.div(principalUSD)
            } else {
              investor.profitUSD = ZERO_BD
              investor.profitRatio = ZERO_BD
            }
            
            investor.updatedAtTimestamp = event.block.timestamp
            investor.save()
          }
        }
      }
    }
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
  // Contract uses basis points: 1 = 0.01%, 100 = 1%, 10000 = 100%
  let withdrawalPercentage = BigDecimal.fromString(event.params.percentage.toString())
    .div(BigDecimal.fromString("10000"))
  
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
      let fundTokens = tokensResult.value
      let investorRatio = BigDecimal.fromString(event.params.share.toString())
        .div(BigDecimal.fromString(event.params.totalShare.toString()))
      
      // Calculate investor's current portfolio
      let tokens: Array<Bytes> = []
      let tokensSymbols: Array<string> = []
      let tokensDecimals: Array<BigInt> = []
      let tokensAmount: Array<BigDecimal> = []
      let totalCurrentUSD = ZERO_BD
      
      const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
      
      for (let i = 0; i < fundTokens.length; i++) {
        let token = fundTokens[i]
        let tokenAddress = Address.fromBytes(token.token)
        let tokenDecimals = fetchTokenDecimals(tokenAddress, event.block.timestamp)
        
        if (tokenDecimals !== null) {
          let decimalDivisor = exponentToBigDecimal(tokenDecimals)
          let fundTokenAmount = BigDecimal.fromString(token.amount.toString()).div(decimalDivisor)
          let investorTokenAmount = fundTokenAmount.times(investorRatio)
          
          if (investorTokenAmount.gt(ZERO_BD)) {
            tokens.push(token.token)
            tokensSymbols.push(fetchTokenSymbol(tokenAddress, event.block.timestamp))
            tokensDecimals.push(tokenDecimals)
            tokensAmount.push(investorTokenAmount)
            
            // Calculate ETH and USD value
            let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
            if (tokenPriceETH !== null) {
              let valueETH = investorTokenAmount.times(tokenPriceETH)
              totalCurrentUSD = totalCurrentUSD.plus(valueETH.times(ethPriceInUSD))
            }
          }
        }
      }
      
      // Update investor's current portfolio
      investor.tokens = tokens
      investor.tokensSymbols = tokensSymbols
      investor.tokensDecimals = tokensDecimals
      investor.tokensAmount = tokensAmount
      investor.amountUSD = totalCurrentUSD
      
      // Update investor share
      investor.share = event.params.share
      
      // Calculate profit: current USD value - principal (share in USDC raw)
      if (investor.share && investor.share!.gt(ZERO_BI)) {
        // Convert share (USDC raw) to decimal
        let principalUSD = BigDecimal.fromString(investor.share!.toString())
          .div(USDC_DECIMALS) // Convert USDC raw to decimal
                  
        // Calculate profit: current value - principal
        investor.profitUSD = totalCurrentUSD.minus(principalUSD)
        
        // Calculate profit ratio
        investor.profitRatio = investor.profitUSD.div(principalUSD)
      } else {
        investor.profitUSD = ZERO_BD
        investor.profitRatio = ZERO_BD
      }
    }
    
    investor.updatedAtTimestamp = event.block.timestamp
    investor.save()
  }

  // Load Fund entity first to get pre-withdrawal data for calculation
  let fund = Fund.load(fundId.toString())
  
  // Store pre-withdrawal data for withdrawal amount calculation
  let preWithdrawTokens: Array<Bytes> = []
  let preWithdrawAmounts: Array<BigDecimal> = []
  if (fund !== null) {
    preWithdrawTokens = fund.tokens
    preWithdrawAmounts = fund.tokensAmount
  }
  
  // Update Fund entity with actual contract data (post-withdrawal)
  if (fund !== null) {
    // Update share with FundShare totalShare (USDC raw amount)
    fund.share = event.params.totalShare
    // Get actual fund tokens from contract (post-withdrawal state)
    let fundInfoContract = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
    let tokensResult = fundInfoContract.try_getFundTokens(fundId)
    
    if (!tokensResult.reverted) {
      let contractTokens = tokensResult.value
      let fundCurrentTokens: Array<Bytes> = []
      let fundCurrentTokensSymbols: Array<string> = []
      let fundCurrentTokensDecimals: Array<BigInt> = []
      let fundCurrentTokensAmount: Array<BigDecimal> = []
      let fundTotalETH = ZERO_BD
      let fundTotalUSD = ZERO_BD
      
      const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
      
      for (let i = 0; i < contractTokens.length; i++) {
        let token = contractTokens[i]
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
      fund.tokens = fundCurrentTokens
      fund.tokensSymbols = fundCurrentTokensSymbols
      fund.tokensDecimals = fundCurrentTokensDecimals
      fund.tokensAmount = fundCurrentTokensAmount
      fund.amountUSD = fundTotalUSD
    }
    
    // Calculate Fund profit: current USD value - principal (share in USDC raw)
    if (fund.share.gt(ZERO_BI)) {
      // Convert share (USDC raw) to decimal
      let principalUSD = BigDecimal.fromString(fund.share.toString())
        .div(USDC_DECIMALS) // Convert USDC raw to decimal
              
      // Calculate profit: current value - principal
      fund.profitUSD = fund.amountUSD.minus(principalUSD)
      
      // Calculate profit ratio
      fund.profitRatio = fund.profitUSD.div(principalUSD)
    } else {
      fund.profitUSD = ZERO_BD
      fund.profitRatio = ZERO_BD
    }
    
    fund.updatedAtTimestamp = event.block.timestamp
    fund.save()
  }
  
  // Calculate withdrawn amount USD based on pre-withdrawal tokens
  if (withdrawalPercentage.gt(ZERO_BD) && preWithdrawTokens.length > 0) {
    let totalWithdrawnUSD = ZERO_BD
    let totalWithdrawnETH = ZERO_BD
    const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
    
    // Use pre-withdrawal data to calculate withdrawn amounts
    for (let i = 0; i < preWithdrawTokens.length; i++) {
      let tokenAddress = Address.fromBytes(preWithdrawTokens[i])
      // Calculate withdrawn amount: preWithdrawAmount × percentage
      let withdrawnAmount = preWithdrawAmounts[i].times(withdrawalPercentage)
      
      // Calculate ETH and USD value of withdrawn tokens
      let tokenPriceETH = getCachedTokenPriceETH(tokenAddress, event.block.timestamp)
      if (tokenPriceETH !== null) {
        let valueETH = withdrawnAmount.times(tokenPriceETH)
        totalWithdrawnETH = totalWithdrawnETH.plus(valueETH)
        totalWithdrawnUSD = totalWithdrawnUSD.plus(valueETH.times(ethPriceInUSD))
      }
    }
    
    // Update the Withdraw entity with calculated USD amount
    entity.amountUSD = totalWithdrawnUSD
    entity.save()
    
    // Update investor's principal (subtract withdrawn amount)
    if (investor !== null) {
      // Note: principalUSD was removed from Investor schema
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