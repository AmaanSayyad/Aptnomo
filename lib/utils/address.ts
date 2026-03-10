import { ethers } from 'ethers';

/**
 * Validates CTC (EVM) wallet addresses only.
 */
export async function isValidAddress(address: string): Promise<boolean> {
  if (!address) return false;
  return ethers.isAddress(address);
}
