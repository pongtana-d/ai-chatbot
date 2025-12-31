import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { THINKING_BUDGET_MAP, DEFAULT_MODEL, MAX_OUTPUT_TOKENS } from "@/lib/constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(request: NextRequest) {
  try {
    const { messages, model = DEFAULT_MODEL, thinkingLevel } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
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

    const response = await chat.sendMessage({ message: lastMessage.content });
    const text = response.text;

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: "Failed to get response from Gemini" },
      { status: 500 }
    );
  }
}
