import { ethereum, BigInt, Address, Bytes, BigDecimal } from '@graphprotocol/graph-ts'
import { 
  InfoSnapshot,
  FundSnapshot, 
  InvestorSnapshot,
  Info,
  Fund,
  Investor
} from '../../generated/schema'
import { STELE_FUND_INFO_ADDRESS, ZERO_BD } from './constants'

export function infoSnapshot(event: ethereum.Event): void {
  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  
  // Create daily snapshot ID based on timestamp
  let dayID = event.block.timestamp.toI32() / 86400
  let snapshotID = dayID.toString()
  
  let snapshot = InfoSnapshot.load(snapshotID)
  if (!snapshot) {
    snapshot = new InfoSnapshot(snapshotID)
  }
  
  snapshot.date = dayID * 86400
  snapshot.fundCount = info.fundCount
  snapshot.investorCount = info.investorCount
  snapshot.totalCurrentETH = info.totalCurrentETH
  snapshot.totalCurrentUSD = info.totalCurrentUSD
  snapshot.save()
}

export function fundSnapshot(
  fundId: BigInt,
  manager: Address,
  event: ethereum.Event,
  ethPriceInUSD: BigDecimal
): void {
  let fund = Fund.load(fundId.toString())
  if (!fund) return
  
  // Create snapshot ID with timestamp
  let snapshotID = fundId.toString() + '-' + event.block.timestamp.toString()
  
  let snapshot = new FundSnapshot(snapshotID)
  snapshot.timestamp = event.block.timestamp
  snapshot.fundId = fundId.toString()
  snapshot.manager = manager
  snapshot.investorCount = fund.investorCount
  snapshot.currentETH = fund.currentETH
  snapshot.currentUSD = fund.currentUSD
  snapshot.currentTokens = fund.currentTokens
  snapshot.currentTokensSymbols = fund.currentTokensSymbols
  snapshot.currentTokensDecimals = fund.currentTokensDecimals
  snapshot.currentTokensAmount = fund.currentTokensAmount
  
  // Calculate ETH and USD amounts for each token
  let tokensAmountETH: BigDecimal[] = []
  let tokensAmountUSD: BigDecimal[] = []
  
  for (let i = 0; i < fund.currentTokens.length; i++) {
    // This is simplified - in production you'd calculate actual token values
    tokensAmountETH.push(ZERO_BD)
    tokensAmountUSD.push(ZERO_BD)
  }
  
  snapshot.currentTokensAmountETH = tokensAmountETH
  snapshot.currentTokensAmountUSD = tokensAmountUSD
  snapshot.save()
}

export function investorSnapshot(
  fundId: BigInt,
  manager: Address,
  investor: Address,
  ethPriceInUSD: BigDecimal,
  event: ethereum.Event
): void {
  let investorID = fundId.toString() + '-' + investor.toHexString()
  let investorEntity = Investor.load(investorID)
  if (!investorEntity) return
  
  // Create snapshot ID with timestamp
  let snapshotID = fundId.toString() + '-' + investor.toHexString() + '-' + event.block.timestamp.toString()
  
  let snapshot = new InvestorSnapshot(snapshotID)
  snapshot.timestamp = event.block.timestamp
  snapshot.fundId = fundId.toString()
  snapshot.manager = manager
  snapshot.investor = investor
  snapshot.principalETH = investorEntity.principalETH
  snapshot.principalUSD = investorEntity.principalUSD
  snapshot.currentETH = investorEntity.currentETH
  snapshot.currentUSD = investorEntity.currentUSD
  
  // Set token arrays
  snapshot.tokens = investorEntity.currentTokens
  snapshot.tokensSymbols = investorEntity.currentTokensSymbols
  snapshot.tokensDecimals = investorEntity.currentTokensDecimals
  
  // Calculate ETH and USD amounts for each token
  let tokensAmountETH: BigDecimal[] = []
  let tokensAmountUSD: BigDecimal[] = []
  
  for (let i = 0; i < investorEntity.currentTokens.length; i++) {
    // This is simplified - in production you'd calculate actual token values
    tokensAmountETH.push(ZERO_BD)
    tokensAmountUSD.push(ZERO_BD)
  }
  
  snapshot.tokensAmountETH = tokensAmountETH
  snapshot.tokensAmountUSD = tokensAmountUSD
  snapshot.save()
}