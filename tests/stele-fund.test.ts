import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { Deposit } from "../generated/schema"
import { Deposit as DepositEvent } from "../generated/SteleFund/SteleFund"
import { handleDeposit } from "../src/stele-fund"
import { createDepositEvent } from "./stele-fund-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let fundId = BigInt.fromI32(234)
    let investor = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let token = Address.fromString("0x0000000000000000000000000000000000000001")
    let amount = BigInt.fromI32(234)
    let newDepositEvent = createDepositEvent(fundId, investor, token, amount)
    handleDeposit(newDepositEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("Deposit created and stored", () => {
    assert.entityCount("Deposit", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "Deposit",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "fundId",
      "234"
    )
    assert.fieldEquals(
      "Deposit",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "investor",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "Deposit",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "token",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "Deposit",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "amount",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
