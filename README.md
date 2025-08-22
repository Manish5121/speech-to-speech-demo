# 🎙️ Veena Agent - Voice-to-Voice AI Assistant

A real-time voice conversation application built with Next.js that enables seamless voice interactions with AI. The app features speech-to-text transcription, AI-powered responses, and natural text-to-speech synthesis for a complete hands-free conversation experience.

## ✨ Features

- 🎤 **Voice Recording**: High-quality audio capture with real-time transcription
- 🤖 **AI Conversations**: Powered by OpenAI's GPT models for intelligent responses
- 🔊 **Text-to-Speech**: Natural voice synthesis with multiple speaker options
- ⚡ **Real-time Streaming**: Sentence-by-sentence TTS processing for responsive audio
- 🎯 **Modular Architecture**: Clean, testable hooks for audio processing and TTS generation
- 📱 **Responsive Design**: Works seamlessly across desktop and mobile devices

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT API
- **Speech-to-Text**: Wispr Flow API
- **Text-to-Speech**: Veena API (Maya Research)
- **Audio Processing**: Web Audio API with custom hooks

## 📋 Prerequisites

Before running this project, you'll need API keys from:

1. **OpenAI** - For AI chat functionality ([Get API Key](https://platform.openai.com/api-keys))
2. **Wispr Flow** - For speech-to-text transcription ([Get API Key](https://wisprflow.ai))
3. **Veena/Maya Research** - For text-to-speech synthesis ([Get API Key](https://mayaresearch.ai))

## ⚙️ Environment Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd veena-agent
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables**

   Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your actual API keys:

   ```bash
   # OpenAI API Key - Required for AI chat functionality
   OPENAI_API_KEY=your_openai_api_key_here

   # Wispr API Configuration - Required for speech-to-text transcription
   WISPR_API_KEY=your_wispr_api_key_here
   WISPR_API_URL=https://api.wisprflow.ai
   NEXT_PUBLIC_WISPR_API_KEY=your_wispr_api_key_here

   # Veena API Configuration - Required for text-to-speech synthesis
   VEENA_API_KEY=your_veena_api_key_here
   VEENA_API_URL=https://api.mayaresearch.ai
   ```

## 🚀 Getting Started

Run the development server:

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start having voice conversations with AI.

## 🔧 Development

### Build for Production

```bash
pnpm build
# or
npm run build
```

### Run Tests

```bash
pnpm test
# or
npm test
```

### Linting

```bash
pnpm lint
# or
npm run lint
```

## 🎨 Customization

### Adding New Voices

Modify the speaker options in `app/components/SpeakerSelector.tsx` to add new voice options supported by the Veena API.

### Adjusting Text Chunking

Update `app/hooks/useTextChunking.ts` to modify how text is broken into chunks for TTS processing.

## 🚀 Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Make sure to add all environment variables to your deployment platform:

- `OPENAI_API_KEY`
- `WISPR_API_KEY`
- `WISPR_API_URL`
- `VEENA_API_KEY`
- `VEENA_API_URL`

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 📚 Learn More

To learn more about Next.js and the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference) - OpenAI API reference
- [Wispr Flow Documentation](https://wisprflow.ai/docs) - Speech-to-text API
- [Veena API Documentation](https://mayaresearch.ai/docs) - Text-to-speech API
