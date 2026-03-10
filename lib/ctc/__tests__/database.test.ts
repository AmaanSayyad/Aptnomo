// Unit tests for CreditCoin Database Module

const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockInsert = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
      insert: mockInsert,
    })),
  })),
}));

import { getHouseBalance, updateHouseBalance, createAuditLog } from '../database';

describe('Database Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHouseBalance', () => {
    it('should return balance for existing user', async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { balance: '100.5' }, 
              error: null 
            }),
          }),
        }),
      });

      const balance = await getHouseBalance('0x123');
      expect(balance).toBe('100.5');
    });

    it('should return 0 for non-existent user', async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST116' } 
            }),
          }),
        }),
      });

      const balance = await getHouseBalance('0x456');
      expect(balance).toBe('0');
    });
  });

  describe('updateHouseBalance', () => {
    it('should increase balance for deposit', async () => {
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { balance: '100.0' }, 
              error: null 
            }),
          }),
        }),
      });

      mockUpsert.mockResolvedValueOnce({ error: null });
      mockInsert.mockResolvedValueOnce({ error: null });

      const newBalance = await updateHouseBalance('0x123', '50.0', 'deposit', '0xabc');
      expect(newBalance).toBe('150.00000000');
    });

    it('should throw error for insufficient balance', async () => {
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { balance: '10.0' }, 
              error: null 
            }),
          }),
        }),
      });

      await expect(
        updateHouseBalance('0x123', '-50.0', 'withdraw')
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log entry', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await createAuditLog('0x123', 'deposit', '50.0', '100.0', '150.0', '0xabc');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_address: '0x123',
          currency: 'APT',
          operation: 'deposit',
          amount: '50.0',
          balance_before: '100.0',
          balance_after: '150.0',
          tx_hash: '0xabc',
        })
      );
    });

    it('should throw error for database failures', async () => {
      mockInsert.mockResolvedValue({ 
        error: { message: 'Database error' } 
      });

      await expect(
        createAuditLog('0x123', 'deposit', '50.0', '100.0', '150.0')
      ).rejects.toThrow('Failed to create audit log');
    });
  });
});
