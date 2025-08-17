import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Deposit,
  DepositFee,
  Swap,
  Withdraw,
  WithdrawFee
} from "../generated/SteleFund/SteleFund"

export function createDepositEvent(
  fundId: BigInt,
  investor: Address,
  token: Address,
  amount: BigInt
): Deposit {
  let depositEvent = changetype<Deposit>(newMockEvent())

  depositEvent.parameters = new Array()

  depositEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return depositEvent
}

export function createDepositFeeEvent(
  fundId: BigInt,
  investor: Address,
  token: Address,
  amount: BigInt
): DepositFee {
  let depositFeeEvent = changetype<DepositFee>(newMockEvent())

  depositFeeEvent.parameters = new Array()

  depositFeeEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  depositFeeEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  depositFeeEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  depositFeeEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return depositFeeEvent
}

export function createSwapEvent(
  fundId: BigInt,
  investor: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: BigInt,
  amountOut: BigInt
): Swap {
  let swapEvent = changetype<Swap>(newMockEvent())

  swapEvent.parameters = new Array()

  swapEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  swapEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  swapEvent.parameters.push(
    new ethereum.EventParam("tokenIn", ethereum.Value.fromAddress(tokenIn))
  )
  swapEvent.parameters.push(
    new ethereum.EventParam("tokenOut", ethereum.Value.fromAddress(tokenOut))
  )
  swapEvent.parameters.push(
    new ethereum.EventParam(
      "amountIn",
      ethereum.Value.fromUnsignedBigInt(amountIn)
    )
  )
  swapEvent.parameters.push(
    new ethereum.EventParam(
      "amountOut",
      ethereum.Value.fromUnsignedBigInt(amountOut)
    )
  )

  return swapEvent
}

export function createWithdrawEvent(
  fundId: BigInt,
  investor: Address,
  token: Address,
  amount: BigInt,
  feeAmount: BigInt
): Withdraw {
  let withdrawEvent = changetype<Withdraw>(newMockEvent())

  withdrawEvent.parameters = new Array()

  withdrawEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam(
      "feeAmount",
      ethereum.Value.fromUnsignedBigInt(feeAmount)
    )
  )

  return withdrawEvent
}

export function createWithdrawFeeEvent(
  fundId: BigInt,
  manager: Address,
  token: Address,
  amount: BigInt
): WithdrawFee {
  let withdrawFeeEvent = changetype<WithdrawFee>(newMockEvent())

  withdrawFeeEvent.parameters = new Array()

  withdrawFeeEvent.parameters.push(
    new ethereum.EventParam("fundId", ethereum.Value.fromUnsignedBigInt(fundId))
  )
  withdrawFeeEvent.parameters.push(
    new ethereum.EventParam("manager", ethereum.Value.fromAddress(manager))
  )
  withdrawFeeEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  withdrawFeeEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return withdrawFeeEvent
}
