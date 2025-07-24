import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export const uploadToIpfsTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'upload_to_ipfs',
      description: 'Upload a file to IPFS via Pinata. Accepts any file type.',
      parameters: {
        type: 'object' as const,
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to upload (on the server).'
          }
        },
        required: ['filePath'],
      },
    },
  },
  handler: async ({ filePath }: { filePath: string }) => {
    const PINATA_API_KEY = process.env.PINATA_API_KEY;
    const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
      return { error: 'Pinata API keys not set in environment' };
    }
    try {
      const data = new FormData();
      data.append('file', fs.createReadStream(filePath));
      const pinataRes = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        data,
        {
          maxBodyLength: Infinity,
          headers: {
            ...data.getHeaders(),
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_API_KEY,
          },
        }
      );
      return { ipfsHash: pinataRes.data.IpfsHash, url: `https://gateway.pinata.cloud/ipfs/${pinataRes.data.IpfsHash}` };
    } catch (err: any) {
      return { error: err.message || 'Failed to upload to IPFS' };
    }
  },
}; 