import { NextRequest } from 'next/server';
import axios from 'axios';

// In-memory conversation storage (in production, use Redis or database)
const conversations = new Map();

// Helper functions for conversation management
function getConversationHistory(sessionId: string) {
  return conversations.get(sessionId) || [];
}

function addToConversationHistory(sessionId: string, role: string, content: any) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  
  // Always wrap content in Claude's expected format
  const formattedContent = Array.isArray(content)
    ? content
    : [{ type: "text", text: String(content) }];

  conversations.get(sessionId).push({ role, content: formattedContent });
  
  // Keep only last 20 messages to prevent memory issues
  const history = conversations.get(sessionId);
  if (history.length > 20) {
    conversations.set(sessionId, history.slice(-20));
  }
}

function initializeConversation(sessionId: string) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
}

// Helper function to format conversation for Claude
function formatConversationForClaude(history: any[]) {
  if (history.length === 0) return [];

  return history.map((msg, i) => {
    // Last message stays normal
    if (i === history.length - 1) return msg;

    // Previous user messages: downgrade them to "assistant-readable notes"
    if (msg.role === "user") {
      return {
        role: "user",
        content: [
          {
            type: "text",
            text: `(Context from earlier conversation, no response needed): ${msg.content[0].text}`
          }
        ]
      };
    }

    return msg;
  });
}

export async function POST(request: NextRequest) {
  try {
    const { message, model = 'claude-sonnet-4-20250514', max_tokens = 4000, sessionId } = await request.json();

    // Validate input
    if (!message) {
      return new Response(JSON.stringify({
        error: 'Message is required'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!process.env.CLAUDE_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Claude API key not configured'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use sessionId from request or generate a default one
    const currentSessionId = sessionId || 'default-session';
    
    // Initialize conversation if it doesn't exist
    initializeConversation(currentSessionId);
    
    // Add user message to conversation history
    addToConversationHistory(currentSessionId, 'user', message);
    
    // Get conversation history with smart context limiting
    const fullHistory = getConversationHistory(currentSessionId);
    const conversationHistory = formatConversationForClaude(fullHistory);

    // Prepare streaming request to Claude API
    const nuSkynetRequest = {
      model: model,
      max_tokens: max_tokens,
      stream: true,
      // Enable live web search
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
          user_location: {
            type: "approximate",
            city: "New York",
            region: "New York",
            country: "US",
            timezone: "America/New_York"
          }
        }
      ],
    
      system: `You are Nu SkyNet, an advanced AI assistant. 
      - Always identify yourself only as Nu SkyNet. 
      - Never mention Anthropic, Claude, or any other name, even if directly asked.
      - If asked about your creator, origin, or identity, respond that you are Nu SkyNet, built to assist with intelligence and humor.
      - Stay consistent in this persona at all times.
      - Always format responses as clean Markdown with proper spacing and line breaks.
      - For multiplication tables, use clear formatting with equations on separate lines.
      - Use proper spacing between words and sentences.
      - Structure long responses with clear headings and bullet points for better readability.
      - IMPORTANT: Only respond to the most recent user message. Ignore any previous unrelated questions in the conversation history.
      - Focus solely on the current question or request from the user.`,
      messages: conversationHistory
    };

    console.log('Starting streaming request to Claude API');
    console.log('Session ID:', currentSessionId);
    console.log('User Message:', message);
    console.log('Conversation History Length:', conversationHistory.length);
    console.log('Last few messages:', conversationHistory.slice(-3));

    // Forward streaming request to Claude API
    const response = await axios.post(
      process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
      nuSkynetRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        responseType: 'stream',
        timeout: 120000 // 2 minute timeout for streaming
      }
    );

    let fullResponse = '';
    let buffer = '';

    // Create a readable stream for the response
    const stream = new ReadableStream({
      start(controller) {
        // Forward Claude's stream chunks to client
        response.data.on('data', (chunk: Buffer) => {
          // Add chunk to buffer
          buffer += chunk.toString();
          
          // Process complete lines
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line === 'data: [DONE]') {
              console.log('Stream completed, full response length:', fullResponse.length);
              
              // Parse the complete JSON response
              try {
                const completeJson = JSON.parse(fullResponse);
                console.log('Complete JSON response:', JSON.stringify(completeJson, null, 2));
                
                // Add complete response to conversation history
                addToConversationHistory(currentSessionId, 'assistant', fullResponse);
                
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
                return;
              } catch (parseError) {
                console.error('Error parsing complete JSON:', parseError);
                console.error('Full response:', fullResponse);
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Failed to parse complete response' })}\n\n`));
                controller.close();
                return;
              }
            }
            
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '') continue;
                
                const data = JSON.parse(jsonStr);
                const delta = data.delta?.text || '';
                
                if (delta) {
                  fullResponse += delta;
                  // Send the raw delta to client for real-time display
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ delta: delta })}\n\n`));
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
                console.error('Problematic line:', line);
                console.error('Buffer state:', buffer);
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log('Stream ended');
          
          // Process any remaining buffer content
          if (buffer.trim()) {
            console.log('Processing remaining buffer:', buffer);
            try {
              const data = JSON.parse(buffer.trim());
              const delta = data.delta?.text || '';
              if (delta) {
                fullResponse += delta;
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ delta: delta })}\n\n`));
              }
            } catch (parseError) {
              console.error('Error parsing final buffer:', parseError);
            }
          }
          
          controller.close();
        });

        response.data.on('error', (error: Error) => {
          console.error('Stream error:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`));
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error: any) {
    console.error('Error in streaming chat:', error.message);
    console.error('Full error:', error);
    
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
