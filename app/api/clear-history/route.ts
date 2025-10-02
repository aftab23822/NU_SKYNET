import { NextRequest, NextResponse } from 'next/server';

// In-memory conversation storage (in production, use Redis or database)
const conversations = new Map();

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    const currentSessionId = sessionId || 'default-session';
    
    if (conversations.has(currentSessionId)) {
      conversations.delete(currentSessionId);
      console.log(`Cleared conversation history for session: ${currentSessionId}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Conversation history cleared for session: ${currentSessionId}`,
      sessionId: currentSessionId
    });
  } catch (error: any) {
    console.error('Error clearing history:', error);
    return NextResponse.json({
      error: 'Failed to clear history',
      message: error.message
    }, { status: 500 });
  }
}
