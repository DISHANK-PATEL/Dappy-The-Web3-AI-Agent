import { getBalanceTool } from './getBalance.js';
import { getWalletAddressTool } from './getWalletAddress.js';
import { readContractTool } from './readContract.js';
import { sendTransactionTool } from './sendTransaction.js';
import { writeContractTool } from './writeContract.js';
import { getContractAbiTool } from './getContractAbi.js';
import { getTransactionReceiptTool } from './getTransactionReceipt.js';
import { deployErc20Tool } from './deployErc20.js';
import { uniswapV3CreatePoolTool } from './uniswapV3createPool.js';
import { approveTokenAllowanceTool } from './approveTokenAllowance.js';
import { getTokenBalanceTool } from './getTokenBalance.js';
import { fetchPodcastDetailsTool } from './fetchPodcastDetails.js';
import { uploadToIpfsTool } from './uploadToIpfs.js';
import { verifyStatementTool } from './verifyStatement.js';

export interface ToolConfig<T = any> {
    definition: {
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: {
                type: 'object';
                properties: Record<string, unknown>;
                required: string[];
            };
        };
    };
    handler: (args: T) => Promise<any>;
}

export const tools: Record<string, ToolConfig> = {
    // == READ == \\
    get_balance: getBalanceTool,
    get_wallet_address: getWalletAddressTool,
    get_contract_abi: getContractAbiTool,
    read_contract: readContractTool,
    get_transaction_receipt: getTransactionReceiptTool,
    get_token_balance: getTokenBalanceTool,
    // get_contract_bytecode: getContractBytecodeTool,

    // == WRITE == \\
    send_transaction: sendTransactionTool,
    write_contract: writeContractTool,
    deploy_erc20: deployErc20Tool,
    create_uniswap_v3_pool: uniswapV3CreatePoolTool,
    approve_token_allowance: approveTokenAllowanceTool,
    fetch_podcast_details: fetchPodcastDetailsTool,
    upload_to_ipfs: uploadToIpfsTool,
    verify_statement: verifyStatementTool,
    // generate_diagram: generateDiagramTool,

    // Add more tools here...
};
