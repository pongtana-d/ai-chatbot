# Gemini Chat

A modern, clean AI chat interface powered by Google Gemini API, built with Next.js 15.

![Gemini Chat](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)

## Features

- 🤖 Chat with Google Gemini AI (gemini-2.0-flash)
- 💬 Real-time streaming responses
- 📝 Markdown support for AI responses
- 💾 Conversation history saved to localStorage
- 🎨 Clean, modern UI similar to ChatGPT/Gemini
- 🌙 Dark mode support
- 📱 Responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Gemini API Key (get it from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation

1. Clone the repository and navigate to the project:

```bash
cd gemini
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

4. Add your Gemini API key to `.env.local`:

```env
GEMINI_API_KEY=your_api_key_here
```

5. Run the development server:

```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       ├── route.ts        # Non-streaming API
│   │       └── stream/
│   │           └── route.ts    # Streaming API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ChatPage.tsx            # Main chat interface
│   └── Sidebar.tsx             # Conversation sidebar
├── lib/
│   └── storage.ts              # localStorage utilities
└── types/
    └── chat.ts                 # TypeScript types
```

## Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS 3.4
- **AI**: Google Gen AI SDK (@google/genai)
- **Markdown**: react-markdown
- **Storage**: localStorage

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Google Gemini API key |

## License

MIT
