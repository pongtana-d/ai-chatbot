import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { THINKING_BUDGET_MAP, DEFAULT_MODEL, MAX_OUTPUT_TOKENS } from "@/lib/constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(request: NextRequest) {
  try {
    const { messages, model = DEFAULT_MODEL, thinkingLevel } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    // Build config with optional thinking
    const config: {
      maxOutputTokens: number;
      thinkingConfig?: { thinkingBudget: number; includeThoughts: boolean };
    } = {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    };

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

    const chat = ai.chats.create({
      model,
      history,
      config,
    });

    const response = await chat.sendMessageStream({ message: lastMessage.content });

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
