import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { TTS_VOICES, DEFAULT_VOICE, TTS_SAMPLE_RATE } from "@/lib/constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const VOICE_IDS = TTS_VOICES.map((v) => v.id);

export async function POST(request: NextRequest) {
  try {
    const { text, voice = DEFAULT_VOICE } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate voice
    const selectedVoice = VOICE_IDS.includes(voice) ? voice : DEFAULT_VOICE;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioData = (response as any).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      return new Response(
        JSON.stringify({ error: "No audio data received" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return base64 audio data
    return new Response(
      JSON.stringify({ 
        audio: audioData,
        format: "pcm",
        sampleRate: TTS_SAMPLE_RATE,
        channels: 1,
        sampleWidth: 2
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("TTS API Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate speech" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
