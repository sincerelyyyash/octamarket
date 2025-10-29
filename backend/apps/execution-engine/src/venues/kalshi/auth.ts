import crypto from 'crypto';

export const createKalshiSignature = (
  privateKeyPem: string,
  method: string,
  path: string,
  timestamp: string
): string => {
  const message = `${timestamp}${method}${path}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
};

export const createKalshiHeaders = (
  apiKey: string,
  signature: string,
  timestamp: string
): Record<string, string> => ({
  'KALSHI-ACCESS-KEY': apiKey,
  'KALSHI-ACCESS-SIGNATURE': signature,
  'KALSHI-ACCESS-TIMESTAMP': timestamp,
  'Content-Type': 'application/json',
});

