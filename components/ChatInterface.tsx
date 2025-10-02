'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Zap, Sparkles, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import dynamic from 'next/dynamic';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface StructuredResponse {
  response_type: 'multiplication_table' | 'general_response' | 'list_response';
  title?: string;
  content?: string;
  summary?: string;
  table?: Array<{
    multiplier: number;
    result: number;
    equation: string;
  }>;
  patterns?: string[];
  items?: Array<{
    item: string;
    description?: string;
  }>;
}

// Component to render structured JSON responses
const StructuredResponseRenderer: React.FC<{ content: string }> = ({ content }) => {
  try {
    const parsedData: StructuredResponse = JSON.parse(content);
    
    switch (parsedData.response_type) {
      case 'multiplication_table':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-blue-400">{parsedData.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parsedData.table?.map((row, index) => (
                <div key={index} className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                  <div className="font-mono text-lg">{row.equation}</div>
                  <div className="text-sm text-slate-400">Result: {row.result}</div>
                </div>
              ))}
            </div>
            {parsedData.patterns && parsedData.patterns.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Patterns:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {parsedData.patterns.map((pattern, index) => (
                    <li key={index} className="text-slate-300">{pattern}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        
      case 'list_response':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-blue-400">{parsedData.title}</h2>
            <div className="space-y-2">
              {parsedData.items?.map((item, index) => (
                <div key={index} className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                  <div className="font-semibold text-slate-100">{item.item}</div>
                  {item.description && (
                    <div className="text-sm text-slate-400 mt-1">{item.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'general_response':
      default:
        return (
          <div className="space-y-3">
            <div className="text-slate-100 whitespace-pre-wrap">{parsedData.content}</div>
            {parsedData.summary && (
              <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-600/50">
                <div className="text-sm font-semibold text-blue-300 mb-1">Summary:</div>
                <div className="text-sm text-slate-300">{parsedData.summary}</div>
              </div>
            )}
          </div>
        );
    }
  } catch (error) {
    // Fallback to plain text if JSON parsing fails
    return <div className="whitespace-pre-wrap text-slate-100">{content}</div>;
  }
};

interface UserSession {
  sessionId: string;
  userId: string;
  messages: Message[];
  wordCount: number;
  lastUpdated: Date;
  sessionName?: string;
}

interface User {
  userId: string;
  userName?: string;
  createdAt: Date;
  lastActive: Date;
  totalSessions: number;
}

// Client-side only timestamp component to avoid hydration issues
const Timestamp: React.FC<{ timestamp: Date; className?: string }> = ({ timestamp, className }) => {
  const [formattedTime, setFormattedTime] = useState('');

  useEffect(() => {
    setFormattedTime(timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    }));
  }, [timestamp]);

  return <span className={className}>{formattedTime}</span>;
};

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m Nu Skynet, an advanced AI assistant. How can I help you today?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [currentMessageWords, setCurrentMessageWords] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const MAX_INPUT_WORDS = 1000; // Maximum words allowed in single message input

  // Generate unique user ID
  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Generate unique session ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Get or create user ID
  const getOrCreateUserId = (): string => {
    let userId = localStorage.getItem('nu_skynet_user_id');
    if (!userId) {
      userId = generateUserId();
      localStorage.setItem('nu_skynet_user_id', userId);
    }
    return userId;
  };

  // Load session from localStorage (user-specific)
  const loadSession = (sessionId: string, targetUserId?: string): UserSession | null => {
    try {
      const userIdToUse = targetUserId || userId;
      if (!userIdToUse) {
        console.log('No userId available for loading session');
        return null;
      }
      
      const saved = localStorage.getItem(`chat_session_${userIdToUse}_${sessionId}`);
      console.log(`Looking for session: chat_session_${userIdToUse}_${sessionId}`);
      console.log('Found saved data:', saved ? 'Yes' : 'No');
      
      if (saved) {
        const session = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        session.messages = session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        session.lastUpdated = new Date(session.lastUpdated);
        console.log('Successfully loaded session:', session);
        return session;
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
    return null;
  };

  // Save session to localStorage (user-specific)
  const saveSession = (session: UserSession) => {
    try {
      localStorage.setItem(`chat_session_${userId}_${session.sessionId}`, JSON.stringify(session));
      // Update session list
      updateSessionList();
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Get all saved sessions for current user
  const getAllSessions = (targetUserId?: string): UserSession[] => {
    try {
      const userIdToUse = targetUserId || userId;
      if (!userIdToUse) return [];
      
      const sessions: UserSession[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`chat_session_${userIdToUse}_`)) {
          const sessionId = key.replace(`chat_session_${userIdToUse}_`, '');
          const session = loadSession(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
      }
      return sessions.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  };

  // Update session list in localStorage (user-specific)
  const updateSessionList = () => {
    const sessions = getAllSessions();
    localStorage.setItem(`chat_sessions_list_${userId}`, JSON.stringify(sessions.map(s => ({
      sessionId: s.sessionId,
      sessionName: s.sessionName || `Session ${new Date(s.lastUpdated).toLocaleDateString()}`,
      lastUpdated: s.lastUpdated,
      messageCount: s.messages.length
    }))));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Auto-scroll when:
    // 1. Not currently streaming, OR
    // 2. Streaming and message is growing (scroll every few updates)
    const lastMessage = messages[messages.length - 1];
    const shouldScroll = !isStreaming || 
      (isStreaming && lastMessage && lastMessage.text.length > 0);
    
    if (shouldScroll) {
      // Use a small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [messages, isStreaming]);

  // Update current message word count as user types
  useEffect(() => {
    setCurrentMessageWords(estimateWords(inputMessage));
  }, [inputMessage]);

  // Get or create active session for user
  const getOrCreateActiveSession = (userId: string): UserSession => {
    const activeSessionKey = `active_session_${userId}`;
    const activeSessionId = localStorage.getItem(activeSessionKey);
    
    if (activeSessionId) {
      const existingSession = loadSession(activeSessionId, userId);
      if (existingSession && existingSession.userId === userId) {
        console.log('Loading existing active session:', existingSession.sessionId);
        return existingSession;
      } else {
        // Active session ID exists but session is corrupted or belongs to different user
        console.log('Active session corrupted, creating new one');
        localStorage.removeItem(activeSessionKey);
      }
    }
    
    // Check if user has any existing sessions to use as active
    const allUserSessions = getAllSessions(userId);
    console.log('Found existing sessions:', allUserSessions.length);
    if (allUserSessions.length > 0) {
      // Use the most recent session as active
      const mostRecentSession = allUserSessions[0];
      console.log('Setting most recent session as active:', mostRecentSession.sessionId);
      localStorage.setItem(activeSessionKey, mostRecentSession.sessionId);
      return mostRecentSession;
    }
    
    // Create new active session
    const newSessionId = generateSessionId();
    const newSession: UserSession = {
      sessionId: newSessionId,
      userId,
      messages: [
        {
          id: '1',
          text: 'Hello! I\'m Nu SkyNet, an advanced AI assistant. How can I help you today?',
          sender: 'bot',
          timestamp: new Date()
        }
      ],
      wordCount: 0,
      lastUpdated: new Date(),
      sessionName: `Session ${new Date().toLocaleDateString()}`
    };
    
    console.log('Creating new active session:', newSessionId);
    
    // Save the new session and set it as active
    saveSession(newSession);
    localStorage.setItem(activeSessionKey, newSessionId);
    
    return newSession;
  };

  // Initialize user and session on component mount
  useEffect(() => {
    const initializeUserAndSession = () => {
      console.log('Initializing user and session...');
      
      // Initialize user
      const currentUserId = getOrCreateUserId();
      console.log('User ID:', currentUserId);
      
      setUserId(currentUserId);
      
      // Check if there's a specific session in URL params
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');
      console.log('URL session param:', sessionParam);
      
      if (sessionParam) {
        // Load specific session from URL
        console.log('Attempting to load session from URL:', sessionParam);
        const existingSession = loadSession(sessionParam, currentUserId);
        console.log('Loaded session from URL:', existingSession);
        if (existingSession && existingSession.userId === currentUserId) {
          console.log('Setting session from URL - messages count:', existingSession.messages.length);
          setSessionId(existingSession.sessionId);
          setSessionName(existingSession.sessionName ?? '');
          setMessages(existingSession.messages);
          setWordCount(existingSession.wordCount);
          // Set this as the active session
          localStorage.setItem(`active_session_${currentUserId}`, existingSession.sessionId);
          return;
        } else {
          console.log('Session not found or user mismatch, creating new session');
        }
      }
      
      // Use or create the active session for this user
      console.log('Getting or creating active session...');
      const activeSession = getOrCreateActiveSession(currentUserId);
      console.log('Active session:', activeSession);
      
      setSessionId(activeSession.sessionId);
      setSessionName(activeSession.sessionName ?? '');
      setMessages(activeSession.messages);
      setWordCount(activeSession.wordCount);
      
      // Update URL with active session ID
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('session', activeSession.sessionId);
      window.history.replaceState({}, '', newUrl.toString());
    };

    initializeUserAndSession();
  }, []);

  // Auto-save session when messages or word count changes
  useEffect(() => {
    if (sessionId && userId && messages.length > 1) { // Don't save empty sessions
      const session: UserSession = {
        sessionId,
        userId,
        messages,
        wordCount,
        lastUpdated: new Date(),
        sessionName
      };
      saveSession(session);
      
      // Update active session for this user
      localStorage.setItem(`active_session_${userId}`, sessionId);
    }
  }, [messages, wordCount, sessionId, sessionName, userId]);

  const estimateWords = (text: string): number => {
    // Count words by splitting on whitespace and filtering out empty strings
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const stopStreaming = () => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
    }
    setIsStreaming(false);
    setIsLoading(false);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    const newWordCount = estimateWords(messageText);
    
    // Check if current message exceeds input limit
    if (newWordCount > MAX_INPUT_WORDS) {
      alert(`Message too long! Maximum ${MAX_INPUT_WORDS} words per message allowed.`);
      return;
    }
    
    // Only check per-message word limit, not conversation total

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);
    setCurrentMessageWords(0);

    // Create abort controller for stopping the stream
    const controller = new AbortController();
    setStreamController(controller);

    // Create a placeholder message that we'll update as we stream
    const botMessageId = (Date.now() + 1).toString();
    const botResponse: Message = {
      id: botMessageId,
      text: '',
      sender: 'bot',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, botResponse]);

    try {
      // Use streaming endpoint for better handling of long responses
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          max_tokens: 4000,
          sessionId: sessionId
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.delta) {
                  fullText += data.delta;
                  
                  // Update the message in real-time
                  setMessages(prev => prev.map(msg => 
                    msg.id === botMessageId 
                      ? { ...msg, text: fullText }
                      : msg
                  ));
                  
                  // Scroll to bottom after each update during streaming
                  setTimeout(() => {
                    scrollToBottom();
                  }, 10);
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            } else if (line.includes('[DONE]')) {
              console.log('Stream completed, full response length:', fullText.length);
              
              // Now update with the complete JSON response
              setMessages(prev => prev.map(msg => 
                msg.id === botMessageId 
                  ? { ...msg, text: fullText }
                  : msg
              ));
              
              // Force scroll to bottom when streaming is complete
              setTimeout(() => {
                scrollToBottom();
              }, 100);
              
              break;
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream was aborted by user');
        // Remove the empty bot message if it was created
        setMessages(prev => prev.filter(msg => msg.id !== botMessageId));
      } else {
        console.error('Error sending message:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Sorry, I encountered an error. Please try again.',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamController(null);
      
      // Refocus the textbox after sending message
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    // Only clear the text input field (like pressing Backspace to delete all typed text)
    setInputMessage('');
    setCurrentMessageWords(0);
  };

  const clearHistory = () => {
    // Confirm before clearing all history
    if (window.confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
      // Clear all sessions for this user
      const allSessions = getAllSessions();
      allSessions.forEach(session => {
        localStorage.removeItem(`chat_session_${userId}_${session.sessionId}`);
      });
      
      // Clear session list
      localStorage.removeItem(`chat_sessions_list_${userId}`);
      
      // Clear active session reference
      localStorage.removeItem(`active_session_${userId}`);
      
      // Reset current state
      setMessages([
        {
          id: '1',
          text: "Hello! I'm Nu SkyNet, an advanced AI assistant. How can I help you today?",
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
      setInputMessage('');
      setCurrentMessageWords(0);
      setWordCount(0);
      
      // Create new session
      const newSessionId = generateSessionId();
      const newSession: UserSession = {
        sessionId: newSessionId,
        userId,
        messages: [
          {
            id: '1',
            text: 'Hello! I\'m Nu SkyNet, an advanced AI assistant. How can I help you today?',
            sender: 'bot',
            timestamp: new Date()
          }
        ],
        wordCount: 0,
        lastUpdated: new Date(),
        sessionName: `Session ${new Date().toLocaleDateString()}`
      };
      
      setSessionId(newSessionId);
      setSessionName(newSession.sessionName ?? '');
      
      // Save new session and set as active
      saveSession(newSession);
      localStorage.setItem(`active_session_${userId}`, newSessionId);
      
      // Update URL with new session ID
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('session', newSessionId);
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  // No conversation-wide word limit, only per-message limit

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
      <div className="flex flex-col h-full w-full bg-slate-900/50 backdrop-blur-sm">
        
        {/* Header */}
        <div className="glass-effect border-b border-slate-700/50 p-4 lg:p-6">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="flex items-center space-x-4">
              <div className="glass-dark p-3 rounded-2xl border border-blue-500/30">
                <Bot className="w-8 h-8 text-blue-400" />
              </div>
      <div>
                <h1 className="text-2xl lg:text-3xl font-bold gradient-text">
                  Nu SkyNet
                </h1>
                <p className="text-slate-400 text-sm lg:text-base">
                  Advanced AI Assistant | Nuskynet.com
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Header space - can be used for future features */}
            </div>
          </div>
        </div>


        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gradient-to-b from-slate-900/50 to-slate-800/50 scrollbar-thin scrollbar-track-slate-800/50 scrollbar-thumb-slate-600/70 hover:scrollbar-thumb-slate-500/80 scrollbar-thumb-rounded-full">
          <div className="max-w-5xl mx-auto space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-4 animate-slide-in ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                {message.sender === 'bot' && (
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                
                <div className={`max-w-2xl px-4 py-3 rounded-2xl message-shadow ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white ml-12'
                    : 'glass-dark text-slate-100 mr-12'
                }`}>
                  <div className="text-base leading-relaxed break-words prose prose-invert max-w-none">
                    {message.sender === 'bot' ? (
                      <ReactMarkdown
                        components={{
                          // Custom styling for markdown elements
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                          p: ({ children }) => <p className="mb-2">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="ml-2">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          code: ({ children }) => <code className="bg-slate-800 px-1 py-0.5 rounded text-sm">{children}</code>,
                          blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic">{children}</blockquote>
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    )}
                  </div>
                  <div className={`text-xs mt-3 opacity-70 ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    <Timestamp 
                      timestamp={message.timestamp} 
                      className=""
                    />
                  </div>
                </div>
                
                {message.sender === 'user' && (
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 justify-start animate-fade-in">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="glass-dark px-4 py-3 rounded-2xl message-shadow mr-12">
                  <div className="flex items-center space-x-3 text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Nu SkyNet is responding...</span>
                    <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
      </div>

        {/* Input Container */}
        <div className="glass-effect border-t border-slate-700/50 p-4 lg:p-6">
          <div className="max-w-5xl mx-auto">
            <div className="glass-dark rounded-3xl p-4 border border-slate-600/50">
              <div className="flex items-end space-x-4">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type here... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 resize-none outline-none text-base leading-relaxed min-h-[50px] sm:min-h-[60px] max-h-32 sm:max-h-40 p-3 sm:p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-600/50 hover:scrollbar-thumb-slate-500/70 scrollbar-thumb-rounded-full"
                  rows={1}
                  disabled={isLoading || currentMessageWords > MAX_INPUT_WORDS}
                />
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white p-3 sm:p-4 rounded-2xl transition-all duration-300 button-hover shadow-lg flex-shrink-0"
                  >
                    <Square className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isLoading || currentMessageWords > MAX_INPUT_WORDS}
                    className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 text-white p-3 sm:p-4 rounded-2xl transition-all duration-300 button-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex-shrink-0"
                  >
                    <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
              </div>
              
              {/* Controls below input */}
              <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-600/30">
                <div className="flex items-center space-x-3">
                  {inputMessage.trim() && (
                    <div className={`text-xs font-medium transition-colors duration-300 ${
                      currentMessageWords > MAX_INPUT_WORDS 
                        ? 'text-red-400' 
                        : currentMessageWords > MAX_INPUT_WORDS * 0.8 
                        ? 'text-yellow-400' 
                        : 'text-slate-500'
                    }`}>
                      {currentMessageWords}/{MAX_INPUT_WORDS} words
                    </div>
                  )}
                  
                  <button 
                    onClick={clearChat}
                    className="glass-dark px-3 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-200 transition-all duration-300 hover:bg-white/10 border border-slate-600/50 hover:border-slate-500/70"
                  >
                    Clear Chat
                  </button>
                  
                  <button 
                    onClick={clearHistory}
                    className="glass-dark px-3 py-1 rounded-full text-xs font-medium text-red-400 hover:text-red-300 transition-all duration-300 hover:bg-red-500/10 border border-red-500/50 hover:border-red-400/70"
                  >
                    Clear History
                  </button>
                </div>
              </div>
            </div>
            
            
            {currentMessageWords > MAX_INPUT_WORDS && (
              <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl text-orange-400 text-center">
                <Zap className="w-5 h-5 inline mr-2" />
                Message too long! Maximum {MAX_INPUT_WORDS} words per message allowed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
