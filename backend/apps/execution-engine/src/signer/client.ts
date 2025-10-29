import axios from 'axios';
import type { EngineConfig } from '../lib/config.js';

export type KalshiCredentials = {
  apiKey: string;
  privateKeyPem: string;
};

export type PolymarketCredentials = {
  privateKey: string; // EVM private key for signing
  chainId: number;
  clobEndpoint: string;
};

export class SignerClient {
  constructor(private config: EngineConfig) {}

  private getAuthHeaders(): Record<string, string> {
    const token = process.env.SIGNER_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getKalshiCredentials(): Promise<KalshiCredentials> {
    const url = `${this.config.signer.baseUrl}/credentials/kalshi`;
    const resp = await axios.get(url, { timeout: 10000, headers: this.getAuthHeaders() });
    return resp.data as KalshiCredentials;
  }

  async getPolymarketCredentials(): Promise<PolymarketCredentials> {
    const url = `${this.config.signer.baseUrl}/credentials/polymarket`;
    const resp = await axios.get(url, { timeout: 10000, headers: this.getAuthHeaders() });
    return resp.data as PolymarketCredentials;
  }

  async signKalshiRequest(payload: {
    method: string;
    path: string;
    timestamp: string;
  }): Promise<string> {
    const url = `${this.config.signer.baseUrl}/sign/kalshi`;
    const resp = await axios.post(url, payload, { timeout: 10000, headers: this.getAuthHeaders() });
    return resp.data.signature;
  }

  async signPolymarketOrder(payload: {
    order: any;
    chainId: number;
  }): Promise<{ signature: string; address: string }> {
    const url = `${this.config.signer.baseUrl}/sign/polymarket`;
    const resp = await axios.post(url, payload, { timeout: 10000, headers: this.getAuthHeaders() });
    return resp.data;
  }
}

