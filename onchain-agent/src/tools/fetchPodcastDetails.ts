import { MongoClient } from "mongodb";

function buildPodcastQueryFromMessage(message: string): object {
    // Extracts the name before 'podcast details' in the message
    const match = message.match(/fetch me (.+) podcast details/i);
    if (match && match[1]) {
        const name = match[1].trim();
        return {
            $or: [
                { title: { $regex: name, $options: "i" } },
                { description: { $regex: name, $options: "i" } }
            ]
        };
    }
    // Default: return all
    return {};
}

export const fetchPodcastDetailsTool = {
  definition: {
    type: 'function',
    function: {
      name: 'fetch_podcast_details',
      description: 'Fetch podcast details from MongoDB using a natural language prompt.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'A natural language prompt describing the podcast data to fetch.'
          }
        },
        required: ['prompt'] as string[],
      },
    },
  } as const,
  handler: async ({ prompt }: { prompt: string }) => {
    const MONGO_URL = process.env.MONGO_URL;
    if (!MONGO_URL) return { error: 'MONGO_URL not set in environment' };
    let result = '';
    try {
      const query = buildPodcastQueryFromMessage(prompt);
      const client = new MongoClient(MONGO_URL);
      await client.connect();
      const db = client.db();
      const coll = db.collection('podcasts');
      const data = await coll.find(query).limit(10).toArray();
      // Clean up ObjectId for readability
      const cleanData = data.map(doc => ({ ...doc, _id: doc._id?.toString() }));
      result = JSON.stringify(cleanData, null, 2);
      await client.close();
    } catch (err: any) {
      result = `MongoDB Error: ${err.message}`;
    }
    return result;
  },
}; 