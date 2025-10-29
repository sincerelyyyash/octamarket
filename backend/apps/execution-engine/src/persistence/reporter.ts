import axios from 'axios';
import type { EngineConfig } from '../lib/config.js';

export type ExecState = 'SUBMITTED' | 'FILLED' | 'FAILED';

export const reportState = async (
  config: EngineConfig,
  intentId: string,
  state: ExecState,
  payload: Record<string, any>
) => {
  const url = `${config.server.baseUrl}/internal/trades/${intentId}/state`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.server.internalToken) headers['Authorization'] = `Bearer ${config.server.internalToken}`;
  try {
    await axios.post(url, { state, ...payload }, { headers, timeout: 10000 });
  } catch {
    // swallow in MVP
  }
};


