import { Bytes, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  SettingCreated as SettingCreatedEvent,
  ManagerFeeChanged as ManagerFeeChangedEvent,
  MaxSlippageChanged as MaxSlippageChangedEvent,
  MaxTokensChanged as MaxTokensChangedEvent,
  OwnerChanged as OwnerChangedEvent,
  AddToken as AddTokenEvent,
  RemoveToken as RemoveTokenEvent,
  SteleFundSetting
} from "../generated/SteleFundSetting/SteleFundSetting"
import {
  SettingCreated,
  ManagerFeeChanged,
  MaxSlippageChanged,
  MaxTokensChanged,
  OwnerChanged,
  Setting,
  InvestableToken,
  AddToken,
  RemoveToken
} from "../generated/schema"
import { 
  STELE_FUND_SETTING_ADDRESS,
  ADDRESS_ZERO,
  WETH,
  USDC,
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
    
    // Fetch values from contract
    let contract = SteleFundSetting.bind(Address.fromString(STELE_FUND_SETTING_ADDRESS))
    setting.managerFee = contract.managerFee()
    setting.maxSlippage = contract.maxSlippage()
    setting.maxTokens = contract.maxTokens()
    setting.owner = contract.owner()
    setting.save()
  }
  
  const weth = new InvestableToken(Bytes.fromHexString(WETH))
  weth.id = Bytes.fromHexString(WETH)
  weth.address = Bytes.fromHexString(WETH)
  const wethDecimals = fetchTokenDecimals(Bytes.fromHexString(WETH), event.block.timestamp)
  weth.decimals = wethDecimals !== null ? wethDecimals : BigInt.fromI32(18)
  weth.symbol = fetchTokenSymbol(Bytes.fromHexString(WETH), event.block.timestamp)
  weth.updatedTimestamp = event.block.timestamp
  weth.isInvestable = true
  weth.save()
  
  // Initialize Stele Fund Token
  const usdc = new InvestableToken(Bytes.fromHexString(USDC))
  usdc.id = Bytes.fromHexString(USDC)
  usdc.address = Bytes.fromHexString(USDC)
  const usdcDecimals = fetchTokenDecimals(Bytes.fromHexString(USDC), event.block.timestamp)
  usdc.decimals = usdcDecimals !== null ? usdcDecimals : BigInt.fromI32(6)
  usdc.symbol = fetchTokenSymbol(Bytes.fromHexString(USDC), event.block.timestamp)
  usdc.updatedTimestamp = event.block.timestamp
  usdc.isInvestable = true
  usdc.save()
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

export function handleAddToken(event: AddTokenEvent): void {
  // Create AddToken event entity (missing)
  let entity = new AddToken(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.token = event.params.token
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let investableToken = InvestableToken.load(event.params.token)
  if (!investableToken) {
    investableToken = new InvestableToken(event.params.token)
    investableToken.address = event.params.token
    const tokenDecimals = fetchTokenDecimals(event.params.token, event.block.timestamp)
    investableToken.decimals = tokenDecimals !== null ? tokenDecimals : BigInt.fromI32(18)
    investableToken.symbol = fetchTokenSymbol(event.params.token, event.block.timestamp)
    investableToken.updatedTimestamp = event.block.timestamp
    investableToken.isInvestable = true
    investableToken.save()
  } else {
    investableToken.updatedTimestamp = event.block.timestamp
    investableToken.isInvestable = true
    investableToken.save()
  }
}

export function handleRemoveToken(event: RemoveTokenEvent): void {
  // Create RemoveToken event entity (missing)
  let entity = new RemoveToken(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.token = event.params.token
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let investableToken = InvestableToken.load(event.params.token)
  if (investableToken) {
    investableToken.updatedTimestamp = event.block.timestamp
    investableToken.isInvestable = false
    investableToken.save()
  }
}

export function handleMaxSlippageChanged(event: MaxSlippageChangedEvent): void {
  let entity = new MaxSlippageChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.maxSlippage = event.params.maxSlippage
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let setting = Setting.load(Bytes.fromHexString(STELE_FUND_SETTING_ADDRESS))
  if (!setting) return
  setting.maxSlippage = event.params.maxSlippage
  setting.save()
}

export function handleMaxTokensChanged(event: MaxTokensChangedEvent): void {
  let entity = new MaxTokensChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.maxTokens = event.params.maxTokens
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let setting = Setting.load(Bytes.fromHexString(STELE_FUND_SETTING_ADDRESS))
  if (!setting) return
  setting.maxTokens = event.params.maxTokens
  setting.save()
}