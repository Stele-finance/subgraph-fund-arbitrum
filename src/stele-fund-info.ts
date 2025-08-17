import {
  FundCreated as FundCreatedEvent,
  InfoCreated as InfoCreatedEvent,
  OwnerChanged as OwnerChangedEvent,
  Subscribe as SubscribeEvent,
} from "../generated/SteleFundInfo/SteleFundInfo"
import {
  FundCreated,
  InfoCreated,
  OwnerChanged,
  Subscribe,
} from "../generated/schema"

export function handleFundCreated(event: FundCreatedEvent): void {
  let entity = new FundCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.fundId = event.params.fundId
  entity.manager = event.params.manager
  
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
}

export function handleInfoCreated(event: InfoCreatedEvent): void {
  let entity = new InfoCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
}

export function handleOwnerChanged(event: OwnerChangedEvent): void {
  let entity = new OwnerChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.oldOwner = event.params.owner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSubscribe(event: SubscribeEvent): void {
  let entity = new Subscribe(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.fundId = event.params.fundId
  entity.investor = event.params.investor

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
}
