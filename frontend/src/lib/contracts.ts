import { kiteTestnet, PYUSD_ADDRESS, LENDING_POOL_ADDRESS, AGENT_REGISTRY_ADDRESS, X402_PROCESSOR_ADDRESS, ORACLE_WALLET_ADDRESS, SCORE_ATTESTATION_FEE } from './web3-config';
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useBalance } from 'wagmi';
import { parseEther } from 'viem';
// PYUSD Contract ABI (minimal)
export const PYUSD_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Lending Pool Contract ABI (minimal)
export const LENDING_POOL_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'lender', type: 'address' },
    ],
    name: 'getLenderPosition',
    outputs: [
      { internalType: 'uint256', name: 'deposited_amount', type: 'uint256' },
      { internalType: 'uint256', name: 'earned_interest', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_borrower', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'borrower', type: 'address' }],
    name: 'getBorrowerPosition',
    outputs: [
      { internalType: 'uint256', name: 'borrowedAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'collateralAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAssets',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalBorrowed',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalInterestAccrued',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalInterestCollected',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'borrower', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'Repaid',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'borrower', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'principalPayment', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'loanId', type: 'uint256' },
      { indexed: false, internalType: 'bool', name: 'fullyRepaid', type: 'bool' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'LoanRepayment',
    type: 'event',
  },
] as const;

export const AGENT_SCORE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'agent', type: 'address' }],
    name: 'getFullRecord',
    outputs: [
      {
        components: [
          { internalType: 'uint16', name: 'score', type: 'uint16' },
          { internalType: 'uint32', name: 'timestamp', type: 'uint32' },
          { internalType: 'uint8', name: 'paymentRate', type: 'uint8' },
          { internalType: 'uint8', name: 'diversity', type: 'uint8' },
          { internalType: 'uint32', name: 'txCount', type: 'uint32' },
          { internalType: 'uint16', name: 'agentAgeDays', type: 'uint16' },
        ],
        internalType: 'struct AgentScoreAttestation.ScoreRecord',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'agent', type: 'address' }],
    name: 'getScore',
    outputs: [
      { internalType: 'uint16', name: 'score', type: 'uint16' },
      { internalType: 'uint32', name: 'timestamp', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const usePYUSDBalance = (address: string | undefined) => {
  return useReadContract({
    address: PYUSD_ADDRESS,
    abi: PYUSD_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: kiteTestnet.id,
  });
};

export const useKiteBalance = (address: string | undefined) => {
  return useBalance({
    address: address ? (address as `0x${string}`) : undefined,
    chainId: kiteTestnet.id,
  });
};

export const usePYUSDDecimals = () => {
  return useReadContract({
    address: PYUSD_ADDRESS,
    abi: PYUSD_ABI,
    functionName: 'decimals',
    chainId: kiteTestnet.id,
  });
};

export const useDepositToLendingPool = (account?: string) => {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const publicClient = usePublicClient();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = async (amount: string): Promise<boolean> => {
    try {
      // PYUSD has 18 decimals on Kite Testnet
      const amountInWei = parseEther(amount);
      
      // Approve PYUSD spending
      const approveHash = await writeContractAsync({
        address: PYUSD_ADDRESS,
        abi: PYUSD_ABI,
        functionName: 'approve',
        args: [LENDING_POOL_ADDRESS, amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });
      
      // Wait for approval confirmation properly using Viem publicClient
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      const depositHash = await writeContractAsync({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'deposit',
        args: [amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });
      
      return !!depositHash;
    } catch (error) {
      console.error('Deposit failed:', error);
      throw error;
    }
  };

  return {
    deposit,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useWithdrawFromLendingPool = (account?: string) => {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = async (amount: string): Promise<boolean> => {
    try {
      const amountInWei = parseEther(amount);
      const withdrawHash = await writeContractAsync({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'withdraw',
        args: [amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });
      
      return !!withdrawHash;
    } catch (error) {
      console.error('Withdraw failed:', error);
      throw error;
    }
  };

  return {
    withdraw,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useLenderPosition = (address: string | undefined) => {
  return useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: 'getLenderPosition',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: kiteTestnet.id,
  });
};

export const useAgentOnChainData = (address: string | undefined) => {
  const result = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_SCORE_ABI,
    functionName: 'getFullRecord',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: kiteTestnet.id,
  });
  return { data: result.data, refetch: result.refetch, isLoading: result.isLoading, isError: result.isError, error: result.error };
};

export const useRegisterAgentOnChain = () => {
  return { 
    register: async () => { console.warn("Registry replaced by automated attestation"); return false; }, 
    isPending: false, 
    isConfirming: false, 
    isConfirmed: false 
  };
};

export const useBorrowFromLendingPool = (account?: string) => {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const publicClient = usePublicClient();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const borrow = async (amount: string): Promise<{ hash: string, success: boolean }> => {
    try {
      // PYUSD has 18 decimals on Kite Testnet
      const amountInWei = parseEther(amount);
      
      const borrowHash = await writeContractAsync({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'borrow',
        args: [amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });
      
      let success = false;
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: borrowHash });
        success = receipt.status === 'success';
      }
      
      return { hash: borrowHash, success };
    } catch (error) {
      console.error('Borrow failed:', error);
      throw error;
    }
  };

  return {
    borrow,
    isPending: isPending || isConfirming,
    isConfirmed,
    hash
  };
};

export const useBorrowerPosition = (address: string | undefined) => {
  const result = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: 'getBorrowerPosition',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: kiteTestnet.id,
  });
  return { data: result.data, refetch: result.refetch, isLoading: result.isLoading, isError: result.isError };
};

export const usePayAndAttestScore = (account?: string) => {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const payAndAttest = async (agentAddress: string): Promise<{ success: boolean; score?: number; grade?: string; attestTxHash?: string; explorerUrl?: string; error?: string }> => {
    try {
      // 1. Send the fee payment from the connected wallet to the oracle wallet
      const payHash = await writeContractAsync({
        address: PYUSD_ADDRESS,
        abi: PYUSD_ABI,
        functionName: 'transfer',
        args: [ORACLE_WALLET_ADDRESS, SCORE_ATTESTATION_FEE],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });

      // 2. Wait for the payment to actually confirm on-chain before using it as proof
      if (!publicClient) throw new Error("No public client available");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: payHash });
      if (receipt.status !== 'success') {
        return { success: false, error: "Payment transaction reverted on-chain" };
      }

      // 3. Build the x-payment header and call the gated oracle endpoint
      const paymentHeader = btoa(JSON.stringify({ txHash: payHash }));
      const oracleUrl = import.meta.env.VITE_ORACLE_API_URL || 'https://illustrious-cat-production.up.railway.app';
      const res = await fetch(`${oracleUrl}/score/${agentAddress}`, {
        headers: { 'x-payment': paymentHeader }
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { success: false, error: errBody.error || `Oracle returned ${res.status}` };
      }

      const data = await res.json();
      return { success: true, score: data.score, grade: data.grade, attestTxHash: data.txHash, explorerUrl: data.explorerUrl };
    } catch (err: any) {
      console.error("payAndAttest failed:", err);
      return { success: false, error: err?.shortMessage || err?.message || "Payment or attestation failed" };
    }
  };

  return { payAndAttest };
};

export const usePoolOnChainStats = () => {
  const { data, refetch, isLoading, isError } = useReadContracts({
    contracts: [
      { address: LENDING_POOL_ADDRESS, abi: LENDING_POOL_ABI, functionName: 'totalAssets' },
      { address: LENDING_POOL_ADDRESS, abi: LENDING_POOL_ABI, functionName: 'totalBorrowed' },
      { address: LENDING_POOL_ADDRESS, abi: LENDING_POOL_ABI, functionName: 'totalInterestAccrued' },
      { address: LENDING_POOL_ADDRESS, abi: LENDING_POOL_ABI, functionName: 'totalInterestCollected' },
      { address: PYUSD_ADDRESS, abi: PYUSD_ABI, functionName: 'balanceOf', args: [LENDING_POOL_ADDRESS] },
    ],
  });

  return {
    totalAssets: data?.[0]?.result as bigint | undefined,
    totalBorrowed: data?.[1]?.result as bigint | undefined,
    totalInterestAccrued: data?.[2]?.result as bigint | undefined,
    totalInterestCollected: data?.[3]?.result as bigint | undefined,
    availableLiquidity: data?.[4]?.result as bigint | undefined,
    isLoading,
    isError,
    refetch,
  };
};

export const useRepayLoan = (account?: string) => {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const repay = async (borrowerAddress: string, amount: string): Promise<{ hash: string; success: boolean }> => {
    try {
      const amountInWei = parseEther(amount);

      // Step 1: approve PYUSD spend by the LendingPool
      const approveHash = await writeContractAsync({
        address: PYUSD_ADDRESS,
        abi: PYUSD_ABI,
        functionName: 'approve',
        args: [LENDING_POOL_ADDRESS, amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Step 2: call repay(borrowerAddress, amount)
      const repayHash = await writeContractAsync({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'repay',
        args: [borrowerAddress as `0x${string}`, amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });

      let success = false;
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: repayHash });
        success = receipt.status === 'success';
      }

      return { hash: repayHash, success };
    } catch (error: any) {
      console.error('Repay failed:', error);
      throw error;
    }
  };

  return { repay };
};

export const useSimulateActivity = (account?: string) => {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  
  const simulate = async (onProgress: (msg: string) => void) => {
    // 10 distinct, well-known testnet addresses to interact with
    const targets = [
      "0x000000000000000000000000000000000000dEaD",
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444",
      "0x5555555555555555555555555555555555555555",
      "0x6666666666666666666666666666666666666666",
      "0x7777777777777777777777777777777777777777",
      "0x8888888888888888888888888888888888888888",
      "0x9999999999999999999999999999999999999999"
    ];
    
    // Transfer 0.01 PYUSD to each
    const amountInWei = parseEther("0.01");
    for (let i = 0; i < targets.length; i++) {
      onProgress(`Sending transaction ${i + 1} of 10...`);
      const hash = await writeContractAsync({
        address: PYUSD_ADDRESS,
        abi: PYUSD_ABI,
        functionName: 'transfer',
        args: [targets[i], amountInWei],
        chain: kiteTestnet,
        account: account as `0x${string}`,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
    }
  };

  return { simulate };
};
