import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { THINKING_BUDGET_MAP, DEFAULT_MODEL, MAX_OUTPUT_TOKENS } from "@/lib/constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface ImageData {
  data: string;
  mimeType: string;
}

interface MessageInput {
  role: string;
  content: string;
  images?: ImageData[];
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model = DEFAULT_MODEL, thinkingLevel, translationMode } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert messages to Gemini format (without images in history for simplicity)
    const history = messages.slice(0, -1).map((msg: MessageInput) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage: MessageInput = messages[messages.length - 1];

    // Build parts for the last message (text + images)
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    
    // Add images first (recommended by Gemini docs)
    if (lastMessage.images && lastMessage.images.length > 0) {
      for (const image of lastMessage.images) {
        parts.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType,
          },
        });
      }
    }
    
    // Add text after images
    parts.push({ text: lastMessage.content });

    // Build config with optional thinking
    const config: {
      maxOutputTokens: number;
      thinkingConfig?: { thinkingBudget: number; includeThoughts: boolean };
      systemInstruction?: string;
    } = {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    };

    if (translationMode === "th-zh") {
      config.systemInstruction = "You are a professional translator. Translate the following Thai text to Simplified Chinese. Only output the translated text without any explanations, conversational filler, or extra words. If the user input is an image, describe the image in Simplified Chinese.";
    } else if (translationMode === "zh-th") {
      config.systemInstruction = "You are a professional translator. Translate the following Chinese text to Thai. Only output the translated text without any explanations, conversational filler, or extra words. If the user input is an image, describe the image in Thai.";
    }

    // Add thinking config using thinkingBudget
    if (thinkingLevel && thinkingLevel !== "off") {
      const budget = THINKING_BUDGET_MAP[thinkingLevel];
      if (budget !== undefined) {
        config.thinkingConfig = {
          thinkingBudget: budget,
          includeThoughts: true,
        };
      }
    }

    // Use generateContentStream for messages with images (no chat history)
    // Use chat for text-only messages
    let response;
    if (lastMessage.images && lastMessage.images.length > 0) {
      // For image messages, use direct generateContentStream
      response = await ai.models.generateContentStream({
        model,
        contents: [
          ...history.map((h: { role: string; parts: Array<{ text: string }> }) => ({
            role: h.role,
            parts: h.parts,
          })),
          { role: "user", parts },
        ],
        config,
      });
    } else {
      // For text-only, use chat
      const chat = ai.chats.create({
        model,
        history,
        config,
      });
      response = await chat.sendMessageStream({ message: lastMessage.content });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get response from Gemini" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
