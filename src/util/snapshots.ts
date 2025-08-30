import { ethereum, BigInt, Address, Bytes, BigDecimal } from '@graphprotocol/graph-ts'
import { 
  InfoSnapshot,
  FundSnapshot, 
  InvestorSnapshot,
  Info,
  Fund,
  Investor
} from '../../generated/schema'
import { STELE_FUND_INFO_ADDRESS, ZERO_BD, ZERO_BI } from './constants'

export function infoSnapshot(event: ethereum.Event): void {
  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  
  // Create daily snapshot ID based on timestamp  
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let snapshotID = dayID.toString()
  
  let snapshot = InfoSnapshot.load(snapshotID)
  if (snapshot == null) {
    snapshot = new InfoSnapshot(snapshotID)
    snapshot.date = dayID * 86400
    snapshot.fundCount = info.fundCount
    snapshot.investorCount = info.investorCount
    snapshot.totalAmountUSD = info.totalAmountUSD
    snapshot.save()
  }
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
  snapshot.share = fund.share
  snapshot.amountUSD = fund.amountUSD
  snapshot.profitUSD = fund.profitUSD
  snapshot.profitRatio = fund.profitRatio
  snapshot.tokens = fund.tokens
  snapshot.tokensSymbols = fund.tokensSymbols
  snapshot.tokensDecimals = fund.tokensDecimals
  snapshot.tokensAmount = fund.tokensAmount
  
  // Calculate USD amounts for each token
  let tokensAmountUSD: BigDecimal[] = []
  
  for (let i = 0; i < fund.tokens.length; i++) {
    // This is simplified - in production you'd calculate actual token values
    tokensAmountUSD.push(ZERO_BD)
  }
  snapshot.tokensAmountUSD = tokensAmountUSD
  snapshot.save()
}

export function investorSnapshot(
  fundId: BigInt,
  manager: Address,
  investor: Address,
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
  // Note: InvestorSnapshot now has share, amountUSD, profitUSD, profitRatio
  if (investorEntity.share) {
    snapshot.share = investorEntity.share!
  } else {
    snapshot.share = ZERO_BI
  }
  snapshot.amountUSD = investorEntity.amountUSD
  snapshot.profitUSD = investorEntity.profitUSD
  snapshot.profitRatio = investorEntity.profitRatio
  
  // Set token arrays
  snapshot.tokens = investorEntity.tokens
  snapshot.tokensSymbols = investorEntity.tokensSymbols
  snapshot.tokensDecimals = investorEntity.tokensDecimals
  
  // Calculate USD amounts for each token
  let tokensAmountUSD: BigDecimal[] = []
  
  for (let i = 0; i < investorEntity.tokens.length; i++) {
    // This is simplified - in production you'd calculate actual token values
    tokensAmountUSD.push(ZERO_BD)
  }
  snapshot.tokensAmountUSD = tokensAmountUSD
  snapshot.save()
}