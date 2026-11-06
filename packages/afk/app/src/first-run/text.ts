export function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}
