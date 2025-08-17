import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  FundCreated,
  InfoCreated,
  OwnerChanged,
  Subscribe
} from "../generated/SteleFundInfo/SteleFundInfo"

export function createFundCreatedEvent(
  fundId: BigInt,
  manager: Address
): FundCreated {
  let fundCreatedEvent = changetype<FundCreated>(newMockEvent())

  fundCreatedEvent.parameters = new Array()

  fundCreatedEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  fundCreatedEvent.parameters.push(
    new ethereum.EventParam("manager", ethereum.Value.fromAddress(manager))
  )

  return fundCreatedEvent
}

export function createInfoCreatedEvent(): InfoCreated {
  let infoCreatedEvent = changetype<InfoCreated>(newMockEvent())

  infoCreatedEvent.parameters = new Array()

  return infoCreatedEvent
}

export function createOwnerChangedEvent(
  owner: Address,
  newOwner: Address
): OwnerChanged {
  let ownerChangedEvent = changetype<OwnerChanged>(newMockEvent())

  ownerChangedEvent.parameters = new Array()

  ownerChangedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  ownerChangedEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownerChangedEvent
}

export function createSubscribeEvent(
  fundId: BigInt,
  investor: Address
): Subscribe {
  let subscribeEvent = changetype<Subscribe>(newMockEvent())

  subscribeEvent.parameters = new Array()

  subscribeEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  subscribeEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )

  return subscribeEvent
}
