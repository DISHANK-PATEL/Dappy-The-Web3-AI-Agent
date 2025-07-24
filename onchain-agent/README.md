# Dappy-The Web3 AI Agent

An AI-powered Web3 agent for querying podcast data and interacting with blockchain tools.

## Features

- AI Assistant powered by [OpenAI's Assistant API](https://platform.openai.com/docs/assistants/overview) with custom personality
- Direct blockchain interactions through [Viem](https://viem.sh/)
- Support for:
  - ERC20 token deployments and interactions
  - Contract reading and writing
  - Balance checking
  - Transaction management
  - Uniswap V3 pool creation

## Prerequisites

- Node.js (v18 or higher)
- TypeScript
- An OpenAI API key
- A wallet private key for the agent

## Getting Started

1. [Clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) the repository:

```bash
git clone https://github.com/DISHANK-PATEL/Dappy-The-Web3-AI-Agent.git

cd onchain-agent
```

2. Install dependencies:

```bash
npm install
```

3. Create the `.env` file and add your OpenAI API key and wallet private key:

```bash
OPENAI_API_KEY=your_openai_api_key
PRIVATE_KEY=your_wallet_private_key
MONGO_URL=your_mongo_url
```

4. Run the agent:

```bash
npm start
```
