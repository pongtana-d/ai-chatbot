# Gemini Chat

A modern, clean AI chat interface powered by Google Gemini API, built with Next.js 16.

![Gemini Chat](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)

## Features

- **Multiple Gemini Models** - Support for Gemini 2.5 Pro, Gemini 3 Flash/Pro, and Gemini Flash Latest
- **Thinking Mode** - Configurable thinking levels (Off, Low, Medium, High, Max) for enhanced reasoning
- **Image Understanding** - Upload and analyze images with multimodal AI capabilities
- **Text-to-Speech** - Read AI responses aloud with 5 different voice options
- **Real-time Streaming** - Smooth streaming responses for better user experience
- **Markdown Support** - Rich text formatting for AI responses
- **Conversation History** - Persistent chat history stored in localStorage
- **Modern UI** - Clean, intuitive interface with dark mode support
- **Responsive Design** - Optimized for desktop, tablet, and mobile devices
- **Toast Notifications** - Contextual error and status messages

## Supported Models

| Model | Thinking Support | Description |
|-------|-----------------|-------------|
| Gemini 2.5 Pro | Yes | Most capable model with advanced reasoning |
| Gemini Flash Latest | No | Fast responses for general use |
| Gemini 3 Flash Preview | Yes | Latest flash model with thinking capabilities |
| Gemini 3 Pro Preview | Yes | Next-generation pro model |

## Text-to-Speech Voices

| Voice | Type | Description |
|-------|------|-------------|
| Kore | Female | Warm, friendly tone |
| Puck | Male | Friendly, conversational |
| Charon | Male | Deep, authoritative |
| Fenrir | Male | Strong, confident |
| Aoede | Female | Clear, professional |

## Image Support

- **Supported Formats**: PNG, JPEG, WEBP, HEIC, HEIF
- **Maximum Size**: 20MB per image
- **Multiple Images**: Upload multiple images in a single message
- **Processing**: Images are sent as base64 inline data (not stored permanently)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended), npm, or yarn
- Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey)

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
│   │   ├── chat/
│   │   │   ├── route.ts          # Non-streaming API endpoint
│   │   │   └── stream/
│   │   │       └── route.ts      # Streaming API endpoint
│   │   └── tts/
│   │       └── route.ts          # Text-to-Speech API endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ChatPage.tsx              # Main chat interface
│   ├── MessageBubble.tsx         # Message display with TTS
│   ├── Sidebar.tsx               # Conversation sidebar
│   └── Toast.tsx                 # Toast notifications
├── lib/
│   ├── constants.ts              # Shared constants
│   └── storage.ts                # localStorage utilities
└── types/
    └── chat.ts                   # TypeScript type definitions
```

## Technologies

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS 4.0
- **AI SDK**: Google Gen AI (@google/genai)
- **Markdown**: react-markdown
- **Storage**: Browser localStorage API

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key from AI Studio |

## Usage Guide

### Basic Chat
1. Type your message in the input field
2. Press Enter or click the Send button
3. View the AI response in real-time

### Model Selection
1. Click on the model name in the header
2. Select your preferred model from the dropdown
3. Configure thinking level (for supported models)

### Image Analysis
1. Click the image icon in the input area
2. Select one or more images (max 20MB each)
3. Add a question or prompt about the images
4. Send the message

### Text-to-Speech
1. Wait for the AI response to complete
2. Click the speaker icon below the message
3. Click again to stop playback

### Voice Configuration
1. Open the model selector dropdown
2. Scroll to the "TTS Voice" section
3. Select your preferred voice

## Development

### Build for Production

```bash
pnpm build
```

### Run Production Build

```bash
pnpm start
```

### Type Checking

```bash
pnpm type-check
```

## License

MIT
