import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { filterNuSkynet } from '@/lib/nuSkynetFilter';

// Text cleanup function for Claude responses
function cleanClaudeText(raw: string): string {
  return raw
    // Fix broken spacing around "is"
    .replace(/\bI[sS]\b/g, "is")
    // Fix "analys Is" → "analysis"
    .replace(/analys\s*is/gi, "analysis")
    .replace(/analys\s*Is/gi, "analysis")
    // Fix other common broken words
    .replace(/th\s*Is/gi, "this")
    .replace(/th\s*at/gi, "that")
    .replace(/w\s*ith/gi, "with")
    .replace(/w\s*hat/gi, "what")
    .replace(/w\s*hen/gi, "when")
    .replace(/w\s*here/gi, "where")
    .replace(/w\s*hy/gi, "why")
    .replace(/w\s*ho/gi, "who")
    .replace(/w\s*hich/gi, "which")
    // Add line breaks before Markdown headers
    .replace(/([^\n])(#+)/g, "$1\n$2")
    // Fix bullet formatting
    .replace(/•/g, "\n- ")
    // Fix numbered lists
    .replace(/(\d+\.)\s*([A-Z])/g, "\n$1 $2")
    // Add line breaks before bold text
    .replace(/([^\n])(\*\*[^*]+\*\*)/g, "$1\n$2")
    // Clean up multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    // Trim and ensure proper ending
    .trim();
}

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
    const { message, model = 'claude-opus-4-1-20250805', max_tokens = 10000, sessionId } = await request.json();

    // Validate input
    if (!message) {
      return NextResponse.json({
        error: 'Message is required'
      }, { status: 400 });
    }

    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json({
        error: 'Claude API key not configured'
      }, { status: 500 });
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

    // Prepare request to Claude API with full conversation history
    const nuSkynetRequest = {
      model: model,
      max_tokens: max_tokens,
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

    // Forward request to Claude API
    const response = await axios.post(
      process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
      nuSkynetRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Apply Nu Skynet filter to the response
    const { filtered, raw, skipped } = filterNuSkynet(response.data, request);
    
    // Add assistant response to conversation history
    const assistantMessage = filtered.content?.[0]?.text || '';
    addToConversationHistory(currentSessionId, 'assistant', [
      { type: "text", text: assistantMessage }
    ]);
    
    return NextResponse.json({
      success: true,
      data: filtered,
      meta: {
        brand: 'Nu SkyNet',
        filtered: !skipped,
        sessionId: currentSessionId
      }
    });

  } catch (error: any) {
    console.error('Error calling Claude API:', error.message);

    if (error.response) {
      return NextResponse.json({
        error: 'Claude API error',
        message: error.response.data?.error?.message || error.message,
        status: error.response.status
      }, { status: error.response.status });
    } else if (error.code === 'ECONNABORTED') {
      return NextResponse.json({
        error: 'Request timeout',
        message: 'The request to Claude API timed out'
      }, { status: 408 });
    } else {
      return NextResponse.json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      }, { status: 500 });
    }
  }
}
