export type RiskContext = {
  perTradeLimit?: number;
  dailyLimit?: number;
};

export const preTradeRiskCheck = (
  qty: number,
  price: number,
  ctx: RiskContext
): { ok: boolean; reason?: string } => {
  const notional = qty * price;
  if (ctx.perTradeLimit != null && notional > ctx.perTradeLimit) {
    return { ok: false, reason: 'PER_TRADE_LIMIT' };
  }
  return { ok: true };
};


