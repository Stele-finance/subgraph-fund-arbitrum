import { ethereum, BigInt, Address, Bytes, BigDecimal } from '@graphprotocol/graph-ts'
import { 
  InfoSnapshot,
  InfoWeeklySnapshot,
  InfoMonthlySnapshot,
  FundSnapshot, 
  FundWeeklySnapshot,
  FundMonthlySnapshot,
  InvestorSnapshot,
  InvestorWeeklySnapshot,
  InvestorMonthlySnapshot,
  Info,
  Fund,
  Investor
} from '../../generated/schema'
import { STELE_FUND_INFO_ADDRESS, ZERO_BD, ZERO_BI } from './constants'
import { getInvestorID } from './investor'

export function infoSnapshot(event: ethereum.Event): void {
  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  
  let timestamp = event.block.timestamp.toI32()
  let dayID = Math.floor(timestamp / 86400) as i32 // explicit floor division
  
  let snapshot = InfoSnapshot.load(dayID.toString())
  if (snapshot == null) {
    snapshot = new InfoSnapshot(dayID.toString())
  }
  
  snapshot.timestamp = event.block.timestamp
  snapshot.fundCount = info.fundCount
  snapshot.investorCount = info.investorCount
  snapshot.totalAmountUSD = info.totalAmountUSD
  snapshot.save()
}

export function fundSnapshot(
  fundId: BigInt,
  manager: Address,
  event: ethereum.Event,
): void {
  let fund = Fund.load(fundId.toString())
  if (!fund) return
  
  let timestamp = event.block.timestamp.toI32()
  let dayID = Math.floor(timestamp / 86400) as i32 // explicit floor division
  let snapshotID = fundId.toString() + '-' + dayID.toString()
  
  let snapshot = FundSnapshot.load(snapshotID)
  if (snapshot == null) {
    snapshot = new FundSnapshot(snapshotID)
  }
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
  let investorID = getInvestorID(fundId, investor)
  let investorEntity = Investor.load(investorID)
  if (!investorEntity) return
  
  let timestamp = event.block.timestamp.toI32()
  let dayID = Math.floor(timestamp / 86400) as i32 // explicit floor division
  let snapshotID = fundId.toString() + '-' + investor.toHexString() + '-' + dayID.toString()
  
  let snapshot = InvestorSnapshot.load(snapshotID)
  if (snapshot == null) {
    snapshot = new InvestorSnapshot(snapshotID)
  }
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
  snapshot.save()
}

// Weekly snapshot functions
export function infoWeeklySnapshot(event: ethereum.Event): void {
  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  
  let timestamp = event.block.timestamp.toI32()
  let weekID = Math.floor(timestamp / (86400 * 7)) as i32 // explicit floor division
  
  let snapshot = InfoWeeklySnapshot.load(weekID.toString())
  if (snapshot == null) {
    snapshot = new InfoWeeklySnapshot(weekID.toString())
  }
  
  snapshot.timestamp = event.block.timestamp
  snapshot.fundCount = info.fundCount
  snapshot.investorCount = info.investorCount
  snapshot.totalAmountUSD = info.totalAmountUSD
  snapshot.save()
}

export function fundWeeklySnapshot(
  fundId: BigInt,
  manager: Address,
  event: ethereum.Event
): void {
  let fund = Fund.load(fundId.toString())
  if (!fund) return
  
  let timestamp = event.block.timestamp.toI32()
  let weekID = Math.floor(timestamp / (86400 * 7)) as i32 // explicit floor division
  
  let snapshot = FundWeeklySnapshot.load(fundId.toString() + "-" + weekID.toString())
  if (snapshot == null) {
    snapshot = new FundWeeklySnapshot(fundId.toString() + "-" + weekID.toString())
  }
  
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
    tokensAmountUSD.push(ZERO_BD)
  }
  snapshot.tokensAmountUSD = tokensAmountUSD
  snapshot.save()
}

export function investorWeeklySnapshot(
  fundId: BigInt,
  manager: Address,
  investor: Address,
  event: ethereum.Event
): void {
  let investorID = getInvestorID(fundId, investor)
  let investorEntity = Investor.load(investorID)
  if (!investorEntity) return
  
  let timestamp = event.block.timestamp.toI32()
  let weekID = Math.floor(timestamp / (86400 * 7)) as i32 // explicit floor division
  
  let snapshot = InvestorWeeklySnapshot.load(investorID + "-" + weekID.toString())
  if (snapshot == null) {
    snapshot = new InvestorWeeklySnapshot(investorID + "-" + weekID.toString())
  }
  
  snapshot.timestamp = event.block.timestamp
  snapshot.fundId = fundId.toString()
  snapshot.manager = manager
  snapshot.investor = investor
  
  if (investorEntity.share) {
    snapshot.share = investorEntity.share!
  } else {
    snapshot.share = ZERO_BI
  }
  snapshot.amountUSD = investorEntity.amountUSD
  snapshot.profitUSD = investorEntity.profitUSD
  snapshot.profitRatio = investorEntity.profitRatio
  snapshot.save()
}

// Monthly snapshot functions
export function infoMonthlySnapshot(event: ethereum.Event): void {
  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  
  let timestamp = event.block.timestamp.toI32()
  let monthID = Math.floor(timestamp / (86400 * 30)) as i32 // explicit floor division
  
  let snapshot = InfoMonthlySnapshot.load(monthID.toString())
  if (snapshot == null) {
    snapshot = new InfoMonthlySnapshot(monthID.toString())
  }
  
  snapshot.timestamp = event.block.timestamp
  snapshot.fundCount = info.fundCount
  snapshot.investorCount = info.investorCount
  snapshot.totalAmountUSD = info.totalAmountUSD
  snapshot.save()
}

export function fundMonthlySnapshot(
  fundId: BigInt,
  manager: Address,
  event: ethereum.Event
): void {
  let fund = Fund.load(fundId.toString())
  if (!fund) return
  
  let timestamp = event.block.timestamp.toI32()
  let monthID = Math.floor(timestamp / (86400 * 30)) as i32 // explicit floor division
  
  let snapshot = FundMonthlySnapshot.load(fundId.toString() + "-" + monthID.toString())
  if (snapshot == null) {
    snapshot = new FundMonthlySnapshot(fundId.toString() + "-" + monthID.toString())
  }
  
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
    tokensAmountUSD.push(ZERO_BD)
  }
  snapshot.tokensAmountUSD = tokensAmountUSD
  snapshot.save()
}

export function investorMonthlySnapshot(
  fundId: BigInt,
  manager: Address,
  investor: Address,
  event: ethereum.Event
): void {
  let investorID = getInvestorID(fundId, investor)
  let investorEntity = Investor.load(investorID)
  if (!investorEntity) return
  
  let timestamp = event.block.timestamp.toI32()
  let monthID = Math.floor(timestamp / (86400 * 30)) as i32 // explicit floor division
  
  let snapshot = InvestorMonthlySnapshot.load(investorID + "-" + monthID.toString())
  if (snapshot == null) {
    snapshot = new InvestorMonthlySnapshot(investorID + "-" + monthID.toString())
  }
  
  snapshot.timestamp = event.block.timestamp
  snapshot.fundId = fundId.toString()
  snapshot.manager = manager
  snapshot.investor = investor
  
  if (investorEntity.share) {
    snapshot.share = investorEntity.share!
  } else {
    snapshot.share = ZERO_BI
  }
  snapshot.amountUSD = investorEntity.amountUSD
  snapshot.profitUSD = investorEntity.profitUSD
  snapshot.profitRatio = investorEntity.profitRatio
  snapshot.save()
}