/**
 * Waterfall allocation: distributes paid_amount across components in order,
 * returning remaining balance per component.
 */
export interface FeeComponentBalance {
  id: string;
  fee_type: string;
  original_amount: number;
  paid: number;
  remaining: number;
}

export function computeComponentBalances(
  components: { id: string; fee_type: string; amount: number }[],
  paidAmount: number
): FeeComponentBalance[] {
  let remaining = paidAmount;

  return components.map(c => {
    const amt = Number(c.amount);
    const allocated = Math.min(remaining, amt);
    remaining -= allocated;
    return {
      id: c.id,
      fee_type: c.fee_type,
      original_amount: amt,
      paid: Math.round(allocated * 100) / 100,
      remaining: Math.round((amt - allocated) * 100) / 100,
    };
  });
}

/**
 * Same result as computeComponentBalances, but payments that recorded a real
 * fee_item_id (the admin's "Pay <component>" button, or a submission naming
 * exactly one item) are credited to that exact component first. Only the
 * leftover pool from payments with no known target ("Pay All", or a
 * submission spanning several items) falls back to the order-based
 * waterfall. Passing every payment with fee_item_id unset reduces to plain
 * computeComponentBalances(components, sum of amounts).
 */
export function allocateComponentBalances(
  components: { id: string; fee_type: string; amount: number }[],
  payments: { amount: number; fee_item_id?: string | null }[]
): FeeComponentBalance[] {
  const directPaid = new Map<string, number>();
  let unattributed = 0;

  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) continue;
    if (p.fee_item_id && components.some(c => c.id === p.fee_item_id)) {
      directPaid.set(p.fee_item_id, (directPaid.get(p.fee_item_id) || 0) + amt);
    } else {
      unattributed += amt;
    }
  }

  let pool = unattributed;
  return components.map(c => {
    const amt = Number(c.amount);
    const direct = Math.min(directPaid.get(c.id) || 0, amt);
    const capacity = amt - direct;
    const fromPool = Math.min(pool, capacity);
    pool -= fromPool;
    const paid = Math.round((direct + fromPool) * 100) / 100;
    return {
      id: c.id,
      fee_type: c.fee_type,
      original_amount: amt,
      paid,
      remaining: Math.round((amt - paid) * 100) / 100,
    };
  });
}
