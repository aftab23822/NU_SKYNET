# Nu SkyNet - Next.js Application

A modern AI chat interface built with Next.js, featuring the Nu SkyNet AI assistant. This application provides a seamless chat experience with real-time streaming responses and conversation management.

## Features

- 🤖 **AI Chat Interface**: Chat with Nu SkyNet, an advanced AI assistant
- ⚡ **Real-time Streaming**: Get responses as they're generated
- 💾 **Session Management**: Persistent conversation history with localStorage
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- 🔒 **Secure**: Environment-based API key management
- 📱 **Mobile Responsive**: Works perfectly on all devices

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Claude API (Anthropic)
- **Deployment**: Vercel
- **Icons**: Lucide React
- **Markdown**: React Markdown

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Claude API key from Anthropic

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd chrisspenser
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

4. Edit `.env.local` and add your Claude API key:
```env
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_API_URL=https://api.anthropic.com/v1/messages
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Deployment on Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard or via CLI:
```bash
vercel env add CLAUDE_API_KEY
vercel env add CLAUDE_API_URL
```

### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Environment Variables for Vercel

Set these in your Vercel project settings:

- `CLAUDE_API_KEY`: Your Claude API key from Anthropic
- `CLAUDE_API_URL`: https://api.anthropic.com/v1/messages
- `NU_SKYNET_ENABLE_AUDIT`: false (optional)

## API Routes

The application includes the following API routes:

- `GET /api/health` - Health check endpoint
- `POST /api/chat` - Standard chat endpoint
- `POST /api/chat/stream` - Streaming chat endpoint
- `POST /api/clear-history` - Clear conversation history

## Project Structure

```
├── app/
│   ├── api/           # API routes
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home page
├── components/
│   └── ChatInterface.tsx  # Main chat component
├── lib/
│   └── nuSkynetFilter.ts  # AI response filtering
├── public/            # Static assets
└── ...config files
```

## Features in Detail

### Chat Interface
- Real-time message streaming
- Markdown support for rich responses
- Message history with timestamps
- Word count tracking
- Session management

### AI Integration
- Claude API integration with streaming
- Response filtering and branding
- Conversation context management
- Error handling and timeouts

### User Experience
- Responsive design
- Dark theme with glass morphism
- Smooth animations
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Auto-scroll to latest messages

## Customization

### Styling
The application uses Tailwind CSS with custom classes defined in `app/globals.css`. You can customize:
- Color schemes
- Animations
- Glass effects
- Typography

### AI Behavior
Modify the system prompt in the API routes to change how Nu SkyNet behaves:
- Personality traits
- Response formatting
- Context handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API routes for debugging

## Migration from Express.js

This Next.js application was converted from a React + Express.js setup. Key changes:

- Express routes → Next.js API routes
- Server-side rendering support
- Vercel-optimized deployment
- Improved TypeScript support
- Better performance and caching
