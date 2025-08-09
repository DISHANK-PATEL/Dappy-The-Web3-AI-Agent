import axios from 'axios';
import * as cheerio from 'cheerio'; // Replaced puppeteer with cheerio

// Gemini API configuration
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function serperSearch(query: string, limit = 5) {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    throw new Error('SERPER_API_KEY not found in environment variables');
  }
  
  try {
    const data = JSON.stringify({
      "q": query,
      "num": limit
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/search',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      data: data
    };

    const response = await axios.request(config);
    const results = response.data;
    
    let searchResults = [];
    
    // Check for direct answer (Answer Box)
    if (results.answerBox) {
      searchResults.push({
        title: 'Direct Answer',
        link: results.answerBox.link || '',
        snippet: results.answerBox.answer || results.answerBox.snippet || '',
        type: 'answer'
      });
    }

    // Check for knowledge graph (summary panel)
    if (results.knowledgeGraph) {
      searchResults.push({
        title: results.knowledgeGraph.title || 'Summary',
        link: results.knowledgeGraph.source?.link || '',
        snippet: results.knowledgeGraph.description || '',
        type: 'summary'
      });
    }

    // Add organic search results
    if (results.organic && results.organic.length > 0) {
      const organicResults = results.organic.slice(0, limit).map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet || '',
        type: 'organic'
      }));
      searchResults = searchResults.concat(organicResults);
    }

    return searchResults.slice(0, limit);
  } catch (error: any) {
    console.error('Error fetching search results:', error.message);
    throw error;
  }
}

// ** MODIFIED FUNCTION: Uses axios and cheerio instead of Puppeteer **
async function scrapeWebPage(url: string): Promise<string> {
  try {
    // Step 1: Fetch the raw HTML of the page using axios
    const response = await axios.get(url, {
      headers: {
        // Use a standard browser user-agent to prevent blocking
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      timeout: 20000 // Set a 20-second timeout for the request
    });

    // Step 2: Load the HTML content into cheerio
    const $ = cheerio.load(response.data);

    // Step 3: Remove elements that don't contain main content
    $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, noscript').remove();

    // Step 4: Find the most likely main content container, or fall back to the body
    const mainContent = $('main, article, .content, .post, .entry, #content, .main').first();
    const contentSource = mainContent.length ? mainContent : $('body');

    // Step 5: Extract the text, clean up whitespace, and limit the length
    let text = contentSource.text();
    text = text.replace(/\s+/g, ' ').trim();
    
    return text.substring(0, 10000);

  } catch (error: any) {
    console.error(`Error scraping ${url}:`, error.message);
    if (axios.isAxiosError(error) && error.response) {
      return `Error scraping this page: Failed to fetch URL with status code ${error.response.status}.`;
    }
    return `Error scraping this page: ${error.message}`;
  }
}

async function cleanDataWithGemini(scrapedData: any[], query: string) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    
         const prompt = `
You are a veteran investigative fact-checker with decades of experience in political analysis, media scrutiny, and truth verification. You are known for your meticulous attention to detail and ability to uncover hidden agendas.

**CRITICAL INSTRUCTION: You must provide EXTREMELY DETAILED analysis. Each section should be 3-5 paragraphs with specific examples, quotes, and evidence from the scraped content. Do NOT be brief or superficial.**

Given the transcript/statement below, perform a comprehensive fact-check analysis using the SCRAPED WEB CONTENT:

**TRANSCRIPT TO VERIFY:**
"${query}"

**SCRAPED WEB CONTENT:**
${scrapedData.map((item, index) => `SOURCE ${index + 1}: ${item.title}\nURL: ${item.url}\nCONTENT: ${item.content.substring(0, 3000)}...`).join('\n\n')}

**REQUIRED ANALYSIS FORMAT (BE EXTREMELY DETAILED):**

1. **FACTUAL VERIFICATION (3-5 detailed paragraphs):**
   - Analyze each specific claim in the statement using the scraped content
   - Quote specific evidence from sources that support or contradict claims
   - Identify dates, numbers, names, and facts that can be verified
   - Note any contradictions between sources and explain discrepancies
   - Rate the reliability of each claim based on available evidence

2. **MOTIVATION & BENEFIT ANALYSIS (3-5 detailed paragraphs):**
   - Deep dive into what the speaker personally gains from these claims
   - Analyze who else benefits politically, financially, or socially
   - Examine timing of statements in relation to events or elections
   - Identify potential conflicts of interest or hidden agendas
   - Connect motivations to broader political or economic context

3. **INTENT & FRAMING ANALYSIS (3-5 detailed paragraphs):**
   - Analyze the specific language and rhetoric used
   - Identify loaded words, emotional triggers, or manipulative techniques
   - Examine how the narrative is constructed and what it omits
   - Analyze the target audience and how they're meant to react
   - Identify any logical fallacies or misleading comparisons

4. **SENTIMENT & TONE ANALYSIS (3-5 detailed paragraphs):**
   - Detailed analysis of emotional language and tone
   - Identify specific words that create emotional responses
   - Analyze whether tone is inflammatory, defensive, aggressive, or manipulative
   - Examine how emotions are used to influence perception
   - Identify any attempts to create fear, anger, or other strong emotions

5. **FINAL VERDICT (2-3 detailed paragraphs):**
   - Provide a clear TRUE/FALSE verdict with specific confidence percentage
   - Explain exactly which claims are true/false based on evidence
   - Detail the reasoning process using specific examples from sources
   - Address any uncertainties or limitations in the analysis
   - Provide a confidence level explanation

6. **DETAILED RESOURCE ANALYSIS (1-2 paragraphs per source):**
   - Analyze each source's credibility in detail
   - Identify any biases or conflicts of interest in sources
   - Note conflicting information between sources
   - Rate source reliability and explain why

**RESPONSE FORMAT (JSON):**
{
  "factualVerification": "EXTREMELY DETAILED analysis with specific examples, quotes, and evidence from scraped content (3-5 paragraphs)",
  "motivationAnalysis": "DEEP DIVE analysis of speaker gains, timing, conflicts of interest, and broader context (3-5 paragraphs)",
  "intentFraming": "DETAILED analysis of language, rhetoric, narrative construction, and manipulation techniques (3-5 paragraphs)",
  "sentimentTone": "COMPREHENSIVE analysis of emotional language, tone, and psychological manipulation (3-5 paragraphs)",
  "finalVerdict": "TRUE/FALSE with specific confidence percentage and detailed reasoning",
  "verdictReasoning": "EXTREMELY DETAILED explanation using specific evidence, addressing uncertainties, and providing confidence level explanation (2-3 paragraphs)",
  "resourceList": [
    {
      "url": "source_url",
      "credibility": "High/Medium/Low with detailed explanation",
      "relevance": "Detailed analysis of how it supports/contradicts the claim",
      "keyEvidence": "Specific quotes and facts from this source",
      "biasAnalysis": "Analysis of any biases or conflicts of interest"
    }
  ],
  "summary": "Comprehensive executive summary with key findings and implications (2-3 paragraphs)"
}

**CRITICAL: You must provide EXTREMELY DETAILED analysis. Each section should be substantial with specific examples, quotes, and thorough analysis. Do NOT be brief or superficial. Use the scraped content extensively as evidence.**
`;

    const response = await axios.post(GEMINI_URL, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      }
    });

    const text = response.data.candidates[0].content.parts[0].text;
    
    try {
      // Try to parse as JSON
      const cleanedData = JSON.parse(text);
      return cleanedData;
    } catch (parseError) {
      // If JSON parsing fails, return structured text
               return {
           factualVerification: "Data processing completed with detailed analysis",
           motivationAnalysis: "Comprehensive analysis of speaker motivations and benefits",
           intentFraming: "Detailed analysis of presentation and narrative construction",
           sentimentTone: "Comprehensive analysis of emotional tone and manipulation",
           finalVerdict: "UNCLEAR",
           verdictReasoning: "JSON parsing failed, using fallback analysis",
           resourceList: scrapedData.map((item: any) => ({
             url: item.url,
             credibility: "Medium - requires further verification",
             relevance: "Content analysis completed, relevance determined",
             keyEvidence: item.content.substring(0, 300),
             biasAnalysis: "Source bias analysis pending"
           })),
           summary: "Data cleaned by Gemini but JSON parsing failed, using enhanced fallback analysis",
           rawGeminiResponse: text
         };
    }
  } catch (error: any) {
    console.error('Error cleaning data with Gemini:', error.message);
         // Fallback to original results if Gemini fails
     return {
       factualVerification: "Analysis failed due to Gemini error - using enhanced fallback",
       motivationAnalysis: "Unable to analyze motivations - requires Gemini processing",
       intentFraming: "Framing analysis unavailable - requires Gemini processing",
       sentimentTone: "Tone analysis unavailable - requires Gemini processing",
       finalVerdict: "UNCLEAR",
       verdictReasoning: "Gemini processing failed - using enhanced fallback analysis",
       resourceList: scrapedData.map((item: any) => ({
         url: item.url,
         credibility: "Unknown - requires Gemini analysis",
         relevance: item.content.substring(0, 300),
         keyEvidence: "Processing failed - content available but analysis incomplete",
         biasAnalysis: "Bias analysis unavailable - requires Gemini processing"
       })),
       summary: "Data cleaning failed due to Gemini error, using enhanced fallback with available content"
     };
  }
}

export const verifyStatementTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'verify_statement',
      description: 'Fact-check a statement using web search, scraping, and Gemini 2.0 Flash for comprehensive analysis.',
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
    try {
      // Step 1: Search using Serper API
      console.log('🔍 Searching with Serper API...');
      const searchResults = await serperSearch(statement, 4);
      
      if (searchResults.length === 0) {
        return {
          report: '❌ No web evidence found for fact-checking. Please try a different statement.',
          evidence: [],
          cleanedData: null
        };
      }
      
      // Step 2: Scrape the found URLs
      console.log('🌐 Scraping web pages...');
      const scrapedData = [];
      
      for (const result of searchResults) {
        if (result.link) {
          console.log(`Scraping: ${result.link}`);
          const content = await scrapeWebPage(result.link);
          scrapedData.push({
            title: result.title,
            url: result.link,
            content: content,
            type: result.type
          });
        }
      }
      
      if (scrapedData.length === 0) {
        return {
          report: '❌ Failed to scrape any web pages. Please try again.',
          evidence: [],
          cleanedData: null
        };
      }
      
      // Step 3: Clean and analyze with Gemini 2.0 Flash
      console.log('🧠 Analyzing with Gemini 2.0 Flash...');
      const cleanedData = await cleanDataWithGemini(scrapedData, statement);
      
             // Step 4: Store Serper API links in separate array for resource list
       const serperResourceList = searchResults
         .filter(result => result.link)
         .map((result, i) => ({
           title: result.title,
           url: result.link,
           snippet: result.snippet || 'No snippet available',
           type: result.type
         }));
       
       // Step 5: Format the response with working links from Serper API
       const workingLinks = serperResourceList
         .map((result, i) => {
           return `${i + 1}. **${result.title}**\n   🔗 ${result.url}\n   📝 ${result.snippet}`;
         })
         .join("\n\n");
       
       return {
         report: `🔍 **INVESTIGATIVE FACT-CHECK REPORT** 🔍\n\n📋 **STATEMENT VERIFIED:** "${statement}"\n\n` +
                 `1️⃣ **FACTUAL VERIFICATION:**\n${cleanedData.factualVerification}\n\n` +
                 `2️⃣ **MOTIVATION & BENEFIT ANALYSIS:**\n${cleanedData.motivationAnalysis}\n\n` +
                 `3️⃣ **INTENT & FRAMING:**\n${cleanedData.intentFraming}\n\n` +
                 `4️⃣ **SENTIMENT & TONE:**\n${cleanedData.sentimentTone}\n\n` +
                 `5️⃣ **FINAL VERDICT:** ${cleanedData.finalVerdict}\n\n` +
                 `📝 **VERDICT REASONING:**\n${cleanedData.verdictReasoning}\n\n` +
                 `6️⃣ **WORKING SOURCE LINKS:**\n${workingLinks}\n\n` +
                 `📊 **EXECUTIVE SUMMARY:**\n${cleanedData.summary}`,
         evidence: serperResourceList.map(r => r.url),
         cleanedData: cleanedData,
         serperResources: serperResourceList
       };
      
    } catch (error: any) {
      console.error('Error in verify statement:', error.message);
      return {
        report: `❌ Error during fact-checking: ${error.message}`,
        evidence: [],
        cleanedData: null
      };
    }
  },
};