import { describe, expect, it } from 'vitest';
import { replayInventoryState } from './inventoryReplay';

describe('replayInventoryState', () => {
  it('starts from opening stock baseline', () => {
    const result = replayInventoryState(10, 1000, []);
    expect(result).toEqual({ qty: 10, avgCost: 1000 });
  });

  it('applies purchase WAC then sale qty reduction', () => {
    const result = replayInventoryState(10, 1000, [
      { kind: 'purchase', date: '2026-01-02', created_at: 'a', qty: 5, unit_price: 2000 },
      { kind: 'sale', date: '2026-01-03', created_at: 'b', qty: 3, unit_price: 0 },
    ]);
    // opening 10@1000 + purchase 5@2000 => qty 15, avg = (10*1000+5*2000)/15 = 1333
    expect(result.qty).toBe(12);
    expect(result.avgCost).toBe(1333);
  });

  it('restores sale qty when sale event removed from replay', () => {
    const withSale = replayInventoryState(0, 0, [
      { kind: 'purchase', date: '2026-01-01', created_at: 'a', qty: 10, unit_price: 500 },
      { kind: 'sale', date: '2026-01-02', created_at: 'b', qty: 4, unit_price: 0 },
    ]);
    const withoutSale = replayInventoryState(0, 0, [
      { kind: 'purchase', date: '2026-01-01', created_at: 'a', qty: 10, unit_price: 500 },
    ]);
    expect(withSale.qty).toBe(6);
    expect(withoutSale.qty).toBe(10);
  });
});

describe('isReversibleBankSource', () => {
  it('allows manual banking entries only', async () => {
    const { isReversibleBankSource } = await import('./banking');
    expect(isReversibleBankSource('deposit')).toBe(true);
    expect(isReversibleBankSource('withdrawal')).toBe(true);
    expect(isReversibleBankSource('adjustment')).toBe(true);
    expect(isReversibleBankSource('sale')).toBe(false);
    expect(isReversibleBankSource('payment')).toBe(false);
  });
});
