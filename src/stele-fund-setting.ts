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
} from "../generated/schema"

export function handleSettingCreated(event: SettingCreatedEvent): void {
  let entity = new SettingCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
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
}