import { BigInt, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts"
import {
  ProposalCreated as ProposalCreatedEvent,
  ProposalCanceled as ProposalCanceledEvent,
  ProposalExecuted as ProposalExecutedEvent,
  ProposalQueued as ProposalQueuedEvent,
  VoteCast as VoteCastEvent,
  VoteCastWithParams as VoteCastWithParamsEvent,
  ProposalThresholdSet as ProposalThresholdSetEvent,
  QuorumNumeratorUpdated as QuorumNumeratorUpdatedEvent,
  VotingDelaySet as VotingDelaySetEvent,
  VotingPeriodSet as VotingPeriodSetEvent,
  TimelockChange as TimelockChangeEvent
} from "../generated/SteleFundGovernor/SteleFundGovernor"
import {
  ProposalCreated,
  ProposalCanceled,
  ProposalExecuted,
  ProposalQueued,
  VoteCast,
  VoteCastWithParams,
  ProposalThresholdSet,
  QuorumNumeratorUpdated,
  VotingDelaySet,
  VotingPeriodSet,
  TimelockChange,
  Proposal,
  ProposalVoteResult,
  Vote
} from "../generated/schema"

const ZERO_BI = BigInt.fromI32(0)
const ZERO_BD = BigDecimal.fromString("0")
const HUNDRED_BD = BigDecimal.fromString("100")

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  // Create immutable ProposalCreated entity
  let proposalCreatedId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalCreated = new ProposalCreated(proposalCreatedId)
  proposalCreated.proposalId = event.params.proposalId
  proposalCreated.proposer = event.params.proposer
  proposalCreated.voteStart = event.params.voteStart
  proposalCreated.voteEnd = event.params.voteEnd
  proposalCreated.description = event.params.description
  proposalCreated.blockNumber = event.block.number
  proposalCreated.blockTimestamp = event.block.timestamp
  proposalCreated.transactionHash = event.transaction.hash
  
  // Handle targets array
  let targets: Array<Bytes> = []
  for (let i = 0; i < event.params.targets.length; i++) {
    targets.push(event.params.targets[i])
  }
  proposalCreated.targets = targets
  
  // Handle values array
  let values: Array<BigInt> = []
  for (let i = 0; i < event.params.values.length; i++) {
    values.push(event.params.values[i])
  }
  proposalCreated.values = values
  
  // Handle signatures array
  let signatures: Array<string> = []
  for (let i = 0; i < event.params.signatures.length; i++) {
    signatures.push(event.params.signatures[i])
  }
  proposalCreated.signatures = signatures
  
  // Handle calldatas array
  let calldatas: Array<Bytes> = []
  for (let i = 0; i < event.params.calldatas.length; i++) {
    calldatas.push(event.params.calldatas[i])
  }
  proposalCreated.calldatas = calldatas
  
  proposalCreated.save()
  
  // Create or update Proposal entity
  let proposalId = event.params.proposalId.toString()
  let proposal = new Proposal(proposalId)
  proposal.proposalId = event.params.proposalId
  proposal.proposer = event.params.proposer
  proposal.targets = targets
  proposal.values = values
  proposal.signatures = signatures
  proposal.calldatas = calldatas
  proposal.voteStart = event.params.voteStart
  proposal.voteEnd = event.params.voteEnd
  proposal.description = event.params.description
  proposal.status = "PENDING"
  proposal.createdAt = event.block.timestamp
  proposal.queuedAt = null
  proposal.executedAt = null
  proposal.canceledAt = null
  proposal.eta = null
  proposal.createdAtBlock = event.block.number
  proposal.lastUpdatedBlock = event.block.number
  proposal.save()
  
  // Create ProposalVoteResult entity
  let voteResult = new ProposalVoteResult(proposalId)
  voteResult.proposalId = event.params.proposalId
  voteResult.forVotes = ZERO_BI
  voteResult.againstVotes = ZERO_BI
  voteResult.abstainVotes = ZERO_BI
  voteResult.totalVotes = ZERO_BI
  voteResult.forPercentage = ZERO_BD
  voteResult.againstPercentage = ZERO_BD
  voteResult.abstainPercentage = ZERO_BD
  voteResult.voterCount = ZERO_BI
  voteResult.lastUpdatedBlock = event.block.number
  voteResult.lastUpdatedTimestamp = event.block.timestamp
  voteResult.isFinalized = false
  voteResult.save()
  
  // Link proposal to vote result
  proposal.voteResult = voteResult.id
  proposal.save()
  
  log.info("Proposal created: {}", [event.params.proposalId.toString()])
}

export function handleVoteCast(event: VoteCastEvent): void {
  // Create immutable VoteCast entity
  let voteCastId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let voteCast = new VoteCast(voteCastId)
  voteCast.voter = event.params.voter
  voteCast.proposalId = event.params.proposalId
  voteCast.support = event.params.support
  voteCast.weight = event.params.weight
  voteCast.reason = event.params.reason
  voteCast.blockNumber = event.block.number
  voteCast.blockTimestamp = event.block.timestamp
  voteCast.transactionHash = event.transaction.hash
  voteCast.save()
  
  // Create Vote entity
  let voteId = event.params.proposalId.toString() + "-" + event.params.voter.toHexString()
  let vote = Vote.load(voteId)
  if (vote == null) {
    vote = new Vote(voteId)
    vote.proposalId = event.params.proposalId
    vote.voter = event.params.voter
    vote.support = event.params.support
    vote.weight = event.params.weight
    vote.reason = event.params.reason
    vote.blockNumber = event.block.number
    vote.blockTimestamp = event.block.timestamp
    vote.transactionHash = event.transaction.hash
    vote.save()
    
    // Update voter count in ProposalVoteResult
    let proposalId = event.params.proposalId.toString()
    let voteResult = ProposalVoteResult.load(proposalId)
    if (voteResult) {
      voteResult.voterCount = voteResult.voterCount.plus(BigInt.fromI32(1))
      voteResult.save()
    }
  }
  
  // Update ProposalVoteResult
  let proposalId = event.params.proposalId.toString()
  let voteResult = ProposalVoteResult.load(proposalId)
  if (voteResult) {
    if (event.params.support == 0) { // Against
      voteResult.againstVotes = voteResult.againstVotes.plus(event.params.weight)
    } else if (event.params.support == 1) { // For
      voteResult.forVotes = voteResult.forVotes.plus(event.params.weight)
    } else if (event.params.support == 2) { // Abstain
      voteResult.abstainVotes = voteResult.abstainVotes.plus(event.params.weight)
    }
    
    voteResult.totalVotes = voteResult.totalVotes.plus(event.params.weight)
    
    // Calculate percentages
    if (voteResult.totalVotes.gt(ZERO_BI)) {
      let totalVotesBD = new BigDecimal(voteResult.totalVotes)
      voteResult.forPercentage = new BigDecimal(voteResult.forVotes).times(HUNDRED_BD).div(totalVotesBD)
      voteResult.againstPercentage = new BigDecimal(voteResult.againstVotes).times(HUNDRED_BD).div(totalVotesBD)
      voteResult.abstainPercentage = new BigDecimal(voteResult.abstainVotes).times(HUNDRED_BD).div(totalVotesBD)
    }
    
    voteResult.lastUpdatedBlock = event.block.number
    voteResult.lastUpdatedTimestamp = event.block.timestamp
    voteResult.save()
  }
  
  // Update Proposal status if voting has started
  let proposal = Proposal.load(proposalId)
  if (proposal && event.block.timestamp >= proposal.voteStart && proposal.status == "PENDING") {
    proposal.status = "ACTIVE"
    proposal.lastUpdatedBlock = event.block.number
    proposal.save()
  }
  
  log.info("Vote cast: Proposal {} by {} with weight {}", [
    event.params.proposalId.toString(),
    event.params.voter.toHexString(),
    event.params.weight.toString()
  ])
}

export function handleVoteCastWithParams(event: VoteCastWithParamsEvent): void {
  // Create immutable VoteCastWithParams entity
  let voteCastWithParamsId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let voteCastWithParams = new VoteCastWithParams(voteCastWithParamsId)
  voteCastWithParams.voter = event.params.voter
  voteCastWithParams.proposalId = event.params.proposalId
  voteCastWithParams.support = event.params.support
  voteCastWithParams.weight = event.params.weight
  voteCastWithParams.reason = event.params.reason
  voteCastWithParams.params = event.params.params
  voteCastWithParams.blockNumber = event.block.number
  voteCastWithParams.blockTimestamp = event.block.timestamp
  voteCastWithParams.transactionHash = event.transaction.hash
  voteCastWithParams.save()
  
  // Create Vote entity
  let voteId = event.params.proposalId.toString() + "-" + event.params.voter.toHexString()
  let vote = Vote.load(voteId)
  if (vote == null) {
    vote = new Vote(voteId)
    vote.proposalId = event.params.proposalId
    vote.voter = event.params.voter
    vote.support = event.params.support
    vote.weight = event.params.weight
    vote.reason = event.params.reason
    vote.blockNumber = event.block.number
    vote.blockTimestamp = event.block.timestamp
    vote.transactionHash = event.transaction.hash
    vote.save()
    
    // Update voter count
    let proposalId = event.params.proposalId.toString()
    let voteResult = ProposalVoteResult.load(proposalId)
    if (voteResult) {
      voteResult.voterCount = voteResult.voterCount.plus(BigInt.fromI32(1))
      voteResult.save()
    }
  }
  
  // Update ProposalVoteResult (same logic as handleVoteCast)
  let proposalId = event.params.proposalId.toString()
  let voteResult = ProposalVoteResult.load(proposalId)
  if (voteResult) {
    if (event.params.support == 0) { // Against
      voteResult.againstVotes = voteResult.againstVotes.plus(event.params.weight)
    } else if (event.params.support == 1) { // For
      voteResult.forVotes = voteResult.forVotes.plus(event.params.weight)
    } else if (event.params.support == 2) { // Abstain
      voteResult.abstainVotes = voteResult.abstainVotes.plus(event.params.weight)
    }
    
    voteResult.totalVotes = voteResult.totalVotes.plus(event.params.weight)
    
    // Calculate percentages
    if (voteResult.totalVotes.gt(ZERO_BI)) {
      let totalVotesBD = new BigDecimal(voteResult.totalVotes)
      voteResult.forPercentage = new BigDecimal(voteResult.forVotes).times(HUNDRED_BD).div(totalVotesBD)
      voteResult.againstPercentage = new BigDecimal(voteResult.againstVotes).times(HUNDRED_BD).div(totalVotesBD)
      voteResult.abstainPercentage = new BigDecimal(voteResult.abstainVotes).times(HUNDRED_BD).div(totalVotesBD)
    }
    
    voteResult.lastUpdatedBlock = event.block.number
    voteResult.lastUpdatedTimestamp = event.block.timestamp
    voteResult.save()
  }
  
  // Update Proposal status if voting has started
  let proposal = Proposal.load(proposalId)
  if (proposal && event.block.timestamp >= proposal.voteStart && proposal.status == "PENDING") {
    proposal.status = "ACTIVE"
    proposal.lastUpdatedBlock = event.block.number
    proposal.save()
  }
  
  log.info("Vote cast with params: Proposal {} by {} with weight {}", [
    event.params.proposalId.toString(),
    event.params.voter.toHexString(),
    event.params.weight.toString()
  ])
}

export function handleProposalQueued(event: ProposalQueuedEvent): void {
  // Create immutable ProposalQueued entity
  let proposalQueuedId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalQueued = new ProposalQueued(proposalQueuedId)
  proposalQueued.proposalId = event.params.proposalId
  proposalQueued.eta = event.params.etaSeconds
  proposalQueued.blockNumber = event.block.number
  proposalQueued.blockTimestamp = event.block.timestamp
  proposalQueued.transactionHash = event.transaction.hash
  proposalQueued.save()
  
  // Update Proposal entity
  let proposalId = event.params.proposalId.toString()
  let proposal = Proposal.load(proposalId)
  if (proposal) {
    proposal.status = "QUEUED"
    proposal.queuedAt = event.block.timestamp
    proposal.eta = event.params.etaSeconds
    proposal.lastUpdatedBlock = event.block.number
    proposal.save()
  }
  
  log.info("Proposal queued: {} with eta {}", [
    event.params.proposalId.toString(),
    event.params.etaSeconds.toString()
  ])
}

export function handleProposalExecuted(event: ProposalExecutedEvent): void {
  // Create immutable ProposalExecuted entity
  let proposalExecutedId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalExecuted = new ProposalExecuted(proposalExecutedId)
  proposalExecuted.proposalId = event.params.proposalId
  proposalExecuted.blockNumber = event.block.number
  proposalExecuted.blockTimestamp = event.block.timestamp
  proposalExecuted.transactionHash = event.transaction.hash
  proposalExecuted.save()
  
  // Update Proposal entity
  let proposalId = event.params.proposalId.toString()
  let proposal = Proposal.load(proposalId)
  if (proposal) {
    proposal.status = "EXECUTED"
    proposal.executedAt = event.block.timestamp
    proposal.lastUpdatedBlock = event.block.number
    proposal.save()
  }
  
  // Mark vote result as finalized
  let voteResult = ProposalVoteResult.load(proposalId)
  if (voteResult) {
    voteResult.isFinalized = true
    voteResult.lastUpdatedBlock = event.block.number
    voteResult.lastUpdatedTimestamp = event.block.timestamp
    voteResult.save()
  }
  
  log.info("Proposal executed: {}", [event.params.proposalId.toString()])
}

export function handleProposalCanceled(event: ProposalCanceledEvent): void {
  // Create immutable ProposalCanceled entity
  let proposalCanceledId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalCanceled = new ProposalCanceled(proposalCanceledId)
  proposalCanceled.proposalId = event.params.proposalId
  proposalCanceled.blockNumber = event.block.number
  proposalCanceled.blockTimestamp = event.block.timestamp
  proposalCanceled.transactionHash = event.transaction.hash
  proposalCanceled.save()
  
  // Update Proposal entity
  let proposalId = event.params.proposalId.toString()
  let proposal = Proposal.load(proposalId)
  if (proposal) {
    proposal.status = "CANCELED"
    proposal.canceledAt = event.block.timestamp
    proposal.lastUpdatedBlock = event.block.number
    proposal.save()
  }
  
  // Mark vote result as finalized
  let voteResult = ProposalVoteResult.load(proposalId)
  if (voteResult) {
    voteResult.isFinalized = true
    voteResult.lastUpdatedBlock = event.block.number
    voteResult.lastUpdatedTimestamp = event.block.timestamp
    voteResult.save()
  }
  
  log.info("Proposal canceled: {}", [event.params.proposalId.toString()])
}

export function handleProposalThresholdSet(event: ProposalThresholdSetEvent): void {
  let id = event.transaction.hash.concatI32(event.logIndex.toI32())
  let thresholdSet = new ProposalThresholdSet(id)
  thresholdSet.oldProposalThreshold = event.params.oldProposalThreshold
  thresholdSet.newProposalThreshold = event.params.newProposalThreshold
  thresholdSet.blockNumber = event.block.number
  thresholdSet.blockTimestamp = event.block.timestamp
  thresholdSet.transactionHash = event.transaction.hash
  thresholdSet.save()
  
  log.info("Proposal threshold set: {} -> {}", [
    event.params.oldProposalThreshold.toString(),
    event.params.newProposalThreshold.toString()
  ])
}

export function handleQuorumNumeratorUpdated(event: QuorumNumeratorUpdatedEvent): void {
  let id = event.transaction.hash.concatI32(event.logIndex.toI32())
  let quorumUpdated = new QuorumNumeratorUpdated(id)
  quorumUpdated.oldQuorumNumerator = event.params.oldQuorumNumerator
  quorumUpdated.newQuorumNumerator = event.params.newQuorumNumerator
  quorumUpdated.blockNumber = event.block.number
  quorumUpdated.blockTimestamp = event.block.timestamp
  quorumUpdated.transactionHash = event.transaction.hash
  quorumUpdated.save()
  
  log.info("Quorum numerator updated: {} -> {}", [
    event.params.oldQuorumNumerator.toString(),
    event.params.newQuorumNumerator.toString()
  ])
}

export function handleVotingDelaySet(event: VotingDelaySetEvent): void {
  let id = event.transaction.hash.concatI32(event.logIndex.toI32())
  let votingDelaySet = new VotingDelaySet(id)
  votingDelaySet.oldVotingDelay = event.params.oldVotingDelay
  votingDelaySet.newVotingDelay = event.params.newVotingDelay
  votingDelaySet.blockNumber = event.block.number
  votingDelaySet.blockTimestamp = event.block.timestamp
  votingDelaySet.transactionHash = event.transaction.hash
  votingDelaySet.save()
  
  log.info("Voting delay set: {} -> {}", [
    event.params.oldVotingDelay.toString(),
    event.params.newVotingDelay.toString()
  ])
}

export function handleVotingPeriodSet(event: VotingPeriodSetEvent): void {
  let id = event.transaction.hash.concatI32(event.logIndex.toI32())
  let votingPeriodSet = new VotingPeriodSet(id)
  votingPeriodSet.oldVotingPeriod = event.params.oldVotingPeriod
  votingPeriodSet.newVotingPeriod = event.params.newVotingPeriod
  votingPeriodSet.blockNumber = event.block.number
  votingPeriodSet.blockTimestamp = event.block.timestamp
  votingPeriodSet.transactionHash = event.transaction.hash
  votingPeriodSet.save()
  
  log.info("Voting period set: {} -> {}", [
    event.params.oldVotingPeriod.toString(),
    event.params.newVotingPeriod.toString()
  ])
}

export function handleTimelockChange(event: TimelockChangeEvent): void {
  let id = event.transaction.hash.concatI32(event.logIndex.toI32())
  let timelockChange = new TimelockChange(id)
  timelockChange.oldTimelock = event.params.oldTimelock
  timelockChange.newTimelock = event.params.newTimelock
  timelockChange.blockNumber = event.block.number
  timelockChange.blockTimestamp = event.block.timestamp
  timelockChange.transactionHash = event.transaction.hash
  timelockChange.save()
  
  log.info("Timelock changed: {} -> {}", [
    event.params.oldTimelock.toHexString(),
    event.params.newTimelock.toHexString()
  ])
}