/** Taxa prep simulada por envio (demo): base + por unidade. */
export function computeShipmentFeeDemo(totalUnits: number): number {
  const u = Math.max(0, Math.floor(totalUnits));
  return Math.round((3 + 0.05 * u) * 100) / 100;
}
