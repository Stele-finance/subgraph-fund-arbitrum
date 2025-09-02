import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  ProposalCreated as ProposalCreatedEvent,
  VoteCast as VoteCastEvent,
  VoteCastWithParams as VoteCastWithParamsEvent,
  ProposalExecuted as ProposalExecutedEvent,
  ProposalQueued as ProposalQueuedEvent,
  ProposalCanceled as ProposalCanceledEvent
} from "../generated/SteleFundGovernor/SteleFundGovernor"
import {
  Proposal,
  Vote,
  VotingPower,
  ProposalExecuted,
  ProposalQueued,
  ProposalCanceled
} from "../generated/schema"

const ZERO_BI = BigInt.fromI32(0)

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  let proposalEntityId = Bytes.fromUTF8(event.params.proposalId.toString())
  let proposal = new Proposal(proposalEntityId)
  proposal.proposalId = event.params.proposalId
  proposal.proposer = event.params.proposer
  proposal.values = event.params.values
  proposal.signatures = event.params.signatures
  proposal.voteStart = event.params.voteStart
  proposal.voteEnd = event.params.voteEnd
  proposal.description = event.params.description
  proposal.status = "Pending"
  proposal.executed = false
  proposal.canceled = false
  proposal.queued = false
  proposal.eta = null
  proposal.blockNumber = event.block.number
  proposal.blockTimestamp = event.block.timestamp
  proposal.transactionHash = event.transaction.hash
  
  let targets: Array<Bytes> = new Array<Bytes>()
  for (let i = 0; i < event.params.targets.length; i++) {
    targets.push(event.params.targets[i])
  }
  proposal.targets = targets
  
  let calldatas: Array<Bytes> = new Array<Bytes>()
  for (let i = 0; i < event.params.calldatas.length; i++) {
    calldatas.push(event.params.calldatas[i])
  }
  proposal.calldatas = calldatas
  
  proposal.forVotes = ZERO_BI
  proposal.againstVotes = ZERO_BI
  proposal.abstainVotes = ZERO_BI
  proposal.totalVotes = ZERO_BI
  
  proposal.save()

  log.info("Proposal created: {}", [event.params.proposalId.toString()])
}

export function handleVoteCast(event: VoteCastEvent): void {
  let voteId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let vote = new Vote(voteId)
  vote.proposalId = event.params.proposalId
  vote.voter = event.params.voter
  vote.support = event.params.support
  vote.weight = event.params.weight
  vote.reason = event.params.reason
  vote.params = null
  vote.blockNumber = event.block.number
  vote.blockTimestamp = event.block.timestamp
  vote.transactionHash = event.transaction.hash
  vote.save()

  // Update Proposal vote totals
  let proposalEntityId = Bytes.fromUTF8(event.params.proposalId.toString())
  let proposal = Proposal.load(proposalEntityId)
  if (proposal) {
    if (event.params.support == 0) { // Against
      proposal.againstVotes = proposal.againstVotes.plus(event.params.weight)
    } else if (event.params.support == 1) { // For
      proposal.forVotes = proposal.forVotes.plus(event.params.weight)
    } else if (event.params.support == 2) { // Abstain
      proposal.abstainVotes = proposal.abstainVotes.plus(event.params.weight)
    }
    proposal.totalVotes = proposal.totalVotes.plus(event.params.weight)
    proposal.save()
  }

  // Create VotingPower entry
  let votingPowerId = event.params.voter.toHexString() + "-" + event.block.number.toString()
  let votingPower = new VotingPower(votingPowerId)
  votingPower.voter = event.params.voter
  votingPower.blockNumber = event.block.number
  votingPower.votingPower = event.params.weight
  votingPower.timestamp = event.block.timestamp
  votingPower.transactionHash = event.transaction.hash
  votingPower.save()

  log.info("Vote cast: Proposal {} by {} with weight {}", [
    event.params.proposalId.toString(),
    event.params.voter.toHexString(),
    event.params.weight.toString()
  ])
}

export function handleVoteCastWithParams(event: VoteCastWithParamsEvent): void {
  let voteId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let vote = new Vote(voteId)
  vote.proposalId = event.params.proposalId
  vote.voter = event.params.voter
  vote.support = event.params.support
  vote.weight = event.params.weight
  vote.reason = event.params.reason
  vote.params = event.params.params
  vote.blockNumber = event.block.number
  vote.blockTimestamp = event.block.timestamp
  vote.transactionHash = event.transaction.hash
  vote.save()

  // Update Proposal vote totals
  let proposalEntityId = Bytes.fromUTF8(event.params.proposalId.toString())
  let proposal = Proposal.load(proposalEntityId)
  if (proposal) {
    if (event.params.support == 0) { // Against
      proposal.againstVotes = proposal.againstVotes.plus(event.params.weight)
    } else if (event.params.support == 1) { // For
      proposal.forVotes = proposal.forVotes.plus(event.params.weight)
    } else if (event.params.support == 2) { // Abstain
      proposal.abstainVotes = proposal.abstainVotes.plus(event.params.weight)
    }
    proposal.totalVotes = proposal.totalVotes.plus(event.params.weight)
    proposal.save()
  }

  // Create VotingPower entry
  let votingPowerId = event.params.voter.toHexString() + "-" + event.block.number.toString()
  let votingPower = new VotingPower(votingPowerId)
  votingPower.voter = event.params.voter
  votingPower.blockNumber = event.block.number
  votingPower.votingPower = event.params.weight
  votingPower.timestamp = event.block.timestamp
  votingPower.transactionHash = event.transaction.hash
  votingPower.save()

  log.info("Vote cast with params: Proposal {} by {} with weight {}", [
    event.params.proposalId.toString(),
    event.params.voter.toHexString(),
    event.params.weight.toString()
  ])
}

export function handleProposalExecuted(event: ProposalExecutedEvent): void {
  let proposalExecutedId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalExecuted = new ProposalExecuted(proposalExecutedId)
  proposalExecuted.proposalId = event.params.proposalId
  proposalExecuted.blockNumber = event.block.number
  proposalExecuted.blockTimestamp = event.block.timestamp
  proposalExecuted.transactionHash = event.transaction.hash
  proposalExecuted.save()

  // Note: Proposal status update would need to be done differently
  // as we would need to store proposal ID mapping to find the correct entity

  log.info("Proposal executed: {}", [event.params.proposalId.toString()])
}

export function handleProposalQueued(event: ProposalQueuedEvent): void {
  let proposalQueuedId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalQueued = new ProposalQueued(proposalQueuedId)
  proposalQueued.proposalId = event.params.proposalId
  proposalQueued.eta = event.params.etaSeconds
  proposalQueued.blockNumber = event.block.number
  proposalQueued.blockTimestamp = event.block.timestamp
  proposalQueued.transactionHash = event.transaction.hash
  proposalQueued.save()

  // Note: Proposal status update would need to be done differently
  // as we would need to store proposal ID mapping to find the correct entity

  log.info("Proposal queued: {} with eta {}", [
    event.params.proposalId.toString(),
    event.params.etaSeconds.toString()
  ])
}

export function handleProposalCanceled(event: ProposalCanceledEvent): void {
  let proposalCanceledId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let proposalCanceled = new ProposalCanceled(proposalCanceledId)
  proposalCanceled.proposalId = event.params.proposalId
  proposalCanceled.blockNumber = event.block.number
  proposalCanceled.blockTimestamp = event.block.timestamp
  proposalCanceled.transactionHash = event.transaction.hash
  proposalCanceled.save()

  // Note: Proposal status update would need to be done differently
  // as we would need to store proposal ID mapping to find the correct entity

  log.info("Proposal canceled: {}", [event.params.proposalId.toString()])
}