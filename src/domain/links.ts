/** Route for the source document behind a journal entry, if it has a page. */
export function sourceLink(sourceType: string | null, sourceId: string | null): string | null {
  if (!sourceType || !sourceId) return null;
  switch (sourceType) {
    case 'sale':
      return `/sales/${sourceId}`;
    case 'purchase':
      return `/purchases/${sourceId}`;
    case 'payment':
      return `/payments/${sourceId}`;
    case 'expense':
      return `/expenses/${sourceId}`;
    case 'other_income':
      return '/income';
    case 'fixed_asset':
      return '/assets';
    default:
      return null;
  }
}

export function sourceLabel(sourceType: string | null): string {
  switch (sourceType) {
    case 'sale': return 'Sale';
    case 'purchase': return 'Purchase';
    case 'payment': return 'Payment';
    case 'expense': return 'Expense';
    case 'other_income': return 'Other income';
    case 'fixed_asset': return 'Fixed asset';
    case 'opening': return 'Opening balance';
    case 'adjustment': return 'Transfer / adjustment';
    case 'deposit': return 'Deposit';
    case 'withdrawal': return 'Withdrawal';
    default: return 'Entry';
  }
}
