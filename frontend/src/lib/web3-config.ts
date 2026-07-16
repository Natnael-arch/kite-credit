import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected, coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors';

export const kiteTestnet = defineChain({
  id: 2368,
  name: 'Kite AI Testnet',
  nativeCurrency: {
    name: 'KITE',
    symbol: 'KITE',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-testnet.gokite.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: 'KiteScan',
      url: 'https://testnet.kitescan.ai',
    },
  },
  testnet: true,
});

export const PYUSD_ADDRESS = '0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9' as const;
export const LENDING_POOL_ADDRESS = '0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE' as const;
export const AGENT_REGISTRY_ADDRESS = '0x71DA928CbCF09515112eE792123b1F32A2229458' as const;
export const X402_PROCESSOR_ADDRESS = '0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337' as const;

export const config = createConfig({
  chains: [kiteTestnet],
  connectors: [
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'default-project-id',
      metadata: {
        name: 'KiteCredit',
        description: 'AI Agent Credit Protocol',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://kitecredit.ai',
        icons: ['https://kitecredit.ai/icon.png'],
      },
    }),
    metaMask(),
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: "KiteCredit",
    }),
  ],
  transports: {
    [kiteTestnet.id]: http(),
  },
});
