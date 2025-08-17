import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { FundCreated } from "../generated/schema"
import { FundCreated as FundCreatedEvent } from "../generated/SteleFundInfo/SteleFundInfo"
import { handleFundCreated } from "../src/stele-fund-info"
import { createFundCreatedEvent } from "./stele-fund-info-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let fundId = BigInt.fromI32(234)
    let manager = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let newFundCreatedEvent = createFundCreatedEvent(fundId, manager)
    handleFundCreated(newFundCreatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("FundCreated created and stored", () => {
    assert.entityCount("FundCreated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "FundCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "fundId",
      "234"
    )
    assert.fieldEquals(
      "FundCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "manager",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
