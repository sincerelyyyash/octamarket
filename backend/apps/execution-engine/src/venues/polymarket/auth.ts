import { ethers } from 'ethers';

const CLOB_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: 137, // Polygon mainnet
};

const LIMIT_ORDER_TYPE = {
  LimitOrder: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

export const signPolymarketOrder = async (
  privateKey: string,
  order: {
    salt: string;
    maker: string;
    signer: string;
    taker: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    expiration: string;
    nonce: string;
    feeRateBps: string;
    side: number;
    signatureType: number;
  },
  chainId: number
): Promise<string> => {
  const wallet = new ethers.Wallet(privateKey);
  const domain = { ...CLOB_DOMAIN, chainId };
  const signature = await wallet.signTypedData(domain, LIMIT_ORDER_TYPE, order);
  return signature;
};

export const getAddressFromPrivateKey = (privateKey: string): string => {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
};

