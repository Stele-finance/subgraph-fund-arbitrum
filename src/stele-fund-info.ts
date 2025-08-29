import { Address, Bytes } from "@graphprotocol/graph-ts"
import {
  Create as CreateEvent,
  InfoCreated as InfoCreatedEvent,
  OwnerChanged as OwnerChangedEvent,
  Join as JoinEvent,
  SteleFundInfo
} from "../generated/SteleFundInfo/SteleFundInfo"
import {
  Info,
  Fund,
  Investor,
  Join,
  Create,
  InfoCreated,
  OwnerChanged as OwnerChangedEntity,
} from "../generated/schema"
import {
  STELE_FUND_INFO_ADDRESS,
  ZERO_BD,
  ZERO_BI,
  ONE_BI,
  ADDRESS_ZERO,
} from './util/constants'
import {
  getCachedEthPriceUSD,
} from './util/pricing'
import {
  infoSnapshot,
  fundSnapshot,
  investorSnapshot
} from './util/snapshots'
import {
  getInvestorID
} from './util/investor'

export function handleCreate(event: CreateEvent): void {
  let entity = new Create(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.fundId = event.params.fundId
  entity.manager = event.params.manager
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  info.fundCount = info.fundCount.plus(ONE_BI)
  info.investorCount = info.investorCount.plus(ONE_BI)
  info.save()

  let fund = new Fund(event.params.fundId.toString())
  fund.fundId = event.params.fundId.toString()
  fund.createdAtTimestamp = event.block.timestamp
  fund.updatedAtTimestamp = event.block.timestamp
  fund.manager = event.params.manager
  fund.investorCount = ONE_BI
  fund.currentETH = ZERO_BD
  fund.currentUSD = ZERO_BD
  fund.feeTokens = []
  fund.feeSymbols = []
  fund.feeTokensAmount = []
  fund.currentTokens = []
  fund.currentTokensSymbols = []
  fund.currentTokensDecimals = []
  fund.currentTokensAmount = []
  fund.save()

  const investorID = getInvestorID(event.params.fundId, event.params.manager)
  let investor = Investor.load(investorID)
  if (investor === null) {
    investor = new Investor(investorID)
    investor.createdAtTimestamp = event.block.timestamp
    investor.updatedAtTimestamp = event.block.timestamp
    investor.fundId = event.params.fundId.toString()
    investor.investor = event.params.manager
    investor.isManager = true
    investor.principalETH = ZERO_BD
    investor.principalUSD = ZERO_BD
    investor.currentETH = ZERO_BD
    investor.currentUSD = ZERO_BD
    investor.currentTokens = []
    investor.currentTokensSymbols = []
    investor.currentTokensDecimals = []
    investor.currentTokensAmount = []
    investor.profitETH = ZERO_BD
    investor.profitUSD = ZERO_BD
    investor.profitRatio = ZERO_BD
  }
  investor.save()

  // Create snapshots
  const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
  infoSnapshot(event)
  fundSnapshot(event.params.fundId, event.params.manager, event, ethPriceInUSD)
  investorSnapshot(event.params.fundId, event.params.manager, event.params.manager, ethPriceInUSD, event)
}

export function handleInfoCreated(event: InfoCreatedEvent): void {
  let entity = new InfoCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (info === null) {
    info = new Info(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
    info.fundCount = ZERO_BI
    info.investorCount = ZERO_BI
    info.totalCurrentETH = ZERO_BD
    info.totalCurrentUSD = ZERO_BD
    info.owner = Bytes.fromHexString(ADDRESS_ZERO)
    info.save()
  }
}

export function handleOwnerChanged(event: OwnerChangedEvent): void {
  let entity = new OwnerChangedEntity(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.oldOwner = event.params.owner
  entity.newOwner = event.params.newOwner
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  info.owner = event.params.newOwner
  info.save()
}

export function handleJoin(event: JoinEvent): void {
  let entity = new Join(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.fundId = event.params.fundId
  entity.investor = event.params.investor
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let info = Info.load(Bytes.fromHexString(STELE_FUND_INFO_ADDRESS))
  if (!info) return
  info.investorCount = info.investorCount.plus(ONE_BI)

  const fundId = event.params.fundId
  let fund = Fund.load(fundId.toString())
  if (fund !== null) {
    fund.investorCount = fund.investorCount.plus(ONE_BI)
    fund.updatedAtTimestamp = event.block.timestamp

    const investorID = getInvestorID(fundId, event.params.investor)
    let investor = Investor.load(investorID)
    if (investor === null) {
      investor = new Investor(investorID)
      investor.createdAtTimestamp = event.block.timestamp
      investor.updatedAtTimestamp = event.block.timestamp
      investor.fundId = fundId.toString()
      investor.investor = event.params.investor
      investor.isManager = false
      investor.principalETH = ZERO_BD
      investor.principalUSD = ZERO_BD
      investor.currentETH = ZERO_BD
      investor.currentUSD = ZERO_BD
      investor.currentTokens = []
      investor.currentTokensSymbols = []
      investor.currentTokensDecimals = []
      investor.currentTokensAmount = []
      investor.profitETH = ZERO_BD
      investor.profitUSD = ZERO_BD
      investor.profitRatio = ZERO_BD  
    }
    investor.updatedAtTimestamp = event.block.timestamp
    investor.save()
    fund.save()
    info.save()

    // Create snapshots
    const ethPriceInUSD = getCachedEthPriceUSD(event.block.timestamp)
    const managerAddress = SteleFundInfo.bind(Address.fromString(STELE_FUND_INFO_ADDRESS))
      .manager(fundId)
    investorSnapshot(fundId, managerAddress, event.params.investor, ethPriceInUSD, event)
    fundSnapshot(fundId, managerAddress, event, ethPriceInUSD)
    infoSnapshot(event)
  }
}