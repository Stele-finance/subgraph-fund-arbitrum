import { Bytes, log } from "@graphprotocol/graph-ts"
import {
  Transfer as TransferEvent,
  DelegateChanged as DelegateChangedEvent,
  DelegateVotesChanged as DelegateVotesChangedEvent
} from "../generated/Token/Token"
import {
  VotingPower,
  DelegateChanged,
  DelegateVotesChanged,
  TokenTransfer
} from "../generated/schema"

export function handleTransfer(event: TransferEvent): void {
  // Create simple transfer record
  let transferId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transfer = new TokenTransfer(transferId)
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.value = event.params.value
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  transfer.transactionHash = event.transaction.hash
  transfer.save()

  log.info('[TOKEN] Transfer: {} tokens from {} to {}', [
    event.params.value.toString(),
    event.params.from.toHexString(),
    event.params.to.toHexString()
  ])
}

export function handleDelegateChanged(event: DelegateChangedEvent): void {
  // Create simple delegate change record
  let delegateChangeId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let delegateChange = new DelegateChanged(delegateChangeId)
  delegateChange.delegator = event.params.delegator
  delegateChange.fromDelegate = event.params.fromDelegate
  delegateChange.toDelegate = event.params.toDelegate
  delegateChange.blockNumber = event.block.number
  delegateChange.blockTimestamp = event.block.timestamp
  delegateChange.transactionHash = event.transaction.hash
  delegateChange.save()

  log.info('[TOKEN] Delegate changed: {} from {} to {}', [
    event.params.delegator.toHexString(),
    event.params.fromDelegate.toHexString(),
    event.params.toDelegate.toHexString()
  ])
}

export function handleDelegateVotesChanged(event: DelegateVotesChangedEvent): void {
  // Create simple votes change record
  let votesChangeId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let votesChange = new DelegateVotesChanged(votesChangeId)
  votesChange.delegate = event.params.delegate
  votesChange.previousBalance = event.params.previousBalance
  votesChange.newBalance = event.params.newBalance
  votesChange.blockNumber = event.block.number
  votesChange.blockTimestamp = event.block.timestamp
  votesChange.transactionHash = event.transaction.hash
  votesChange.save()

  // Create/update VotingPower entry
  let votingPowerId = event.params.delegate.toHexString() + "-" + event.block.number.toString()
  let votingPower = new VotingPower(votingPowerId)
  votingPower.voter = event.params.delegate
  votingPower.blockNumber = event.block.number
  votingPower.votingPower = event.params.newBalance
  votingPower.timestamp = event.block.timestamp
  votingPower.transactionHash = event.transaction.hash
  votingPower.save()

  log.info('[TOKEN] Delegate votes changed: {} from {} to {}', [
    event.params.delegate.toHexString(),
    event.params.previousBalance.toString(),
    event.params.newBalance.toString()
  ])
}