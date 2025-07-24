import axios from 'axios';

async function googleCseSearch(query: string, limit = 3) {
  const apiKey = 'AIzaSyBGUTGMUSGz9TWVtgQ9lwIwt1PBikzswa4'; // HARDCODED API KEY
  const cx = 'c23519848826c4a0c'; // HARDCODED CSE ID
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cx,
        q: query,
        num: limit
      }
    });
    const items = response.data.items || [];
    return items.slice(0, limit).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet || ''
    }));
  } catch (error: any) {
    return [];
  }
}

export const verifyStatementTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'verify_statement',
      description: 'Fact-check a statement using Google search and return a summary and evidence URLs.',
      parameters: {
        type: 'object' as const,
        properties: {
          statement: {
            type: 'string',
            description: 'The statement to verify.'
          }
        },
        required: ['statement'],
      },
    },
  },
  handler: async ({ statement }: { statement: string }) => {
    const results = await googleCseSearch(statement, 3);
    if (results.length === 0) {
      return {
        report: 'No web evidence found for fact-checking. Please try a different statement.',
        evidence: []
      };
    }
    const evidenceBlock = results
      .map((r: any, i: number) => `${i+1}. ${r.title}\n   URL: ${r.link}\n   Snippet: ${r.snippet}`)
      .join("\n\n");
    return {
      report: `Fact-checking completed.\n\nEvidence:\n${evidenceBlock}`,
      evidence: results.map((r: any) => r.link)
    };
  },
}; 