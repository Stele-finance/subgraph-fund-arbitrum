import { Address, Bytes, BigInt, log } from "@graphprotocol/graph-ts"
import {
  SettingCreated as SettingCreatedEvent,
  ManagerFeeChanged as ManagerFeeChangedEvent,
  OwnerChanged as OwnerChangedEvent,
  WhiteListTokenAdded as WhiteListTokenAddedEvent,
  WhiteListTokenRemoved as WhiteListTokenRemovedEvent,
} from "../generated/SteleFundSetting/SteleFundSetting"
import {
  SettingCreated,
  ManagerFeeChanged,
  OwnerChanged,
  WhiteListTokenAdded,
  WhiteListTokenRemoved,
  Setting,
  WhiteListToken
} from "../generated/schema"
import { 
  STELE_FUND_SETTING_ADDRESS,
  ADDRESS_ZERO,
  DECIMAL_18,
  WETH
} from './util/constants'
import { fetchTokenSymbol, fetchTokenDecimals } from './util/token'

export function handleSettingCreated(event: SettingCreatedEvent): void {
  let entity = new SettingCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let setting = Setting.load(Bytes.fromHexString(STELE_FUND_SETTING_ADDRESS))
  if (setting === null) {
    setting = new Setting(Bytes.fromHexString(STELE_FUND_SETTING_ADDRESS))
    setting.managerFee = BigInt.fromString("10000")
    setting.minPoolAmount = BigInt.fromString(DECIMAL_18)
    setting.owner = Bytes.fromHexString(ADDRESS_ZERO)
    setting.save()
  }
  
  const weth = new WhiteListToken(Bytes.fromHexString(WETH))
  weth.id = Bytes.fromHexString(WETH)
  weth.address = Bytes.fromHexString(WETH)
  const wethDecimals = fetchTokenDecimals(Bytes.fromHexString(WETH), event.block.timestamp)
  weth.decimals = wethDecimals !== null ? wethDecimals : BigInt.fromI32(18)
  weth.symbol = fetchTokenSymbol(Bytes.fromHexString(WETH), event.block.timestamp)
  weth.updatedTimestamp = event.block.timestamp
  weth.isWhiteListToken = true
  weth.save()
}

export function handleManagerFeeChanged(event: ManagerFeeChangedEvent): void {
  let entity = new ManagerFeeChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.managerFee = event.params.managerFee
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let setting = Setting.load(Bytes.fromHexString(STELE_FUND_SETTING_ADDRESS))
  if (!setting) return
  setting.managerFee = event.params.managerFee
  setting.save()
}

export function handleOwnerChanged(event: OwnerChangedEvent): void {
  let entity = new OwnerChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.oldOwner = event.params.oldOwner
  entity.newOwner = event.params.newOwner
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let setting = Setting.load(Bytes.fromHexString(STELE_FUND_SETTING_ADDRESS))
  if (!setting) return
  setting.owner = event.params.newOwner
  setting.save()
}

export function handleWhiteListTokenAdded(event: WhiteListTokenAddedEvent): void {
  let entity = new WhiteListTokenAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.token = event.params.token
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let token = WhiteListToken.load(event.params.token)
  if (!token) {
    token = new WhiteListToken(event.params.token)
    token.id = event.params.token
    token.address = event.params.token
    const tokenDecimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
    token.decimals = tokenDecimals !== null ? tokenDecimals : BigInt.fromI32(18)
    token.symbol = fetchTokenSymbol(event.params.token, event.block.timestamp)
    token.updatedTimestamp = event.block.timestamp
    token.isWhiteListToken = true
    token.save()
  } else {
    token.updatedTimestamp = event.block.timestamp
    token.isWhiteListToken = true
    token.save()
  }
}

export function handleWhiteListTokenRemoved(event: WhiteListTokenRemovedEvent): void {
  let entity = new WhiteListTokenRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.token = event.params.token
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let token = WhiteListToken.load(event.params.token)
  if (token) {
    token.updatedTimestamp = event.block.timestamp
    token.isWhiteListToken = false
    token.save()
  }
}