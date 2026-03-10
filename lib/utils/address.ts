import { AccountAddress } from '@aptos-labs/ts-sdk';

/**
 * Validates Aptos wallet addresses only.
 */
export async function isValidAddress(address: string): Promise<boolean> {
  if (!address) return false;
  try {
    AccountAddress.from(address);
    return true;
  } catch {
    return false;
  }
}
