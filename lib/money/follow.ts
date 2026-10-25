/** Slots a deposit status call opened, from the book's nextDeposit before and after. */
export function openedSlots(before: number, after: number): number[] {
  const slots: number[] = [];
  for (let slot = before; slot < after; slot += 1) slots.push(slot);
  return slots;
}
