import { Address, BigInt } from '@graphprotocol/graph-ts'

export function getInvestorID(fundID: BigInt, investor: Address): string {
  const investorID = fundID.toString() + '-' + investor.toHexString().toUpperCase()
  return investorID
}