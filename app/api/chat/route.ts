import { NextResponse } from "next/server";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

function isMathExpression(input: string) {
  return /^[0-9\s+\-*/().%]+$/.test(input);
}

function safeCalculate(expression: string) {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (!sanitized.trim()) return null;

    const result = Function(`"use strict"; return (${sanitized})`)();

    if (typeof result !== "number" || !Number.isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

function getSystemPrompt() {
  return `
You are DH GLOBAL AI, a powerful local AI assistant and senior web developer.

Your purpose:
- Help build websites, systems, dashboards, portals, and apps
- Specialise in React, Next.js, Tailwind, APIs, UI/UX, debugging, and performance
- Give practical, production-ready answers

Rules:
- Be direct and useful
- Do NOT over-explain unless asked
- When giving code, make it clean and usable
- When fixing bugs, explain cause briefly, then fix
- Think like a senior developer
- If unsure, say you are unsure
- Always prioritise real-world usability
- Use markdown formatting when helpful
- Put code in fenced code blocks with the correct language
`;
}

function getModel() {
  return "qwen2.5-coder:7b";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body.message || "");
    const history = Array.isArray(body.history) ? body.history : [];

    const lowerMessage = message.toLowerCase().trim();

    if (
      lowerMessage.includes("what time is it") ||
      lowerMessage === "time" ||
      lowerMessage === "what's the time" ||
      lowerMessage === "what is the time"
    ) {
      const now = new Date();

      return NextResponse.json({
        reply: `The current time is ${now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}.`,
        source: "tool",
      });
    }

    if (
      lowerMessage.includes("what day is it") ||
      lowerMessage === "date" ||
      lowerMessage === "day" ||
      lowerMessage === "what's the date" ||
      lowerMessage === "what is the date"
    ) {
      const now = new Date();

      return NextResponse.json({
        reply: `Today's date is ${now.toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}.`,
        source: "tool",
      });
    }

    const mathMatch =
      lowerMessage.match(/what is (.+)/) ||
      lowerMessage.match(/calculate (.+)/) ||
      lowerMessage.match(/work out (.+)/);

    const expression = mathMatch ? mathMatch[1] : lowerMessage;

    if (isMathExpression(expression)) {
      const result = safeCalculate(expression);
      if (result !== null) {
        return NextResponse.json({
          reply: `The answer is ${result}.`,
          source: "tool",
        });
      }
    }

    const cleanedHistory: IncomingMessage[] = history
      .filter(
        (msg: unknown) =>
          typeof msg === "object" &&
          msg !== null &&
          "role" in msg &&
          "content" in msg &&
          ((msg as IncomingMessage).role === "user" ||
            (msg as IncomingMessage).role === "assistant") &&
          typeof (msg as IncomingMessage).content === "string"
      )
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: getSystemPrompt(),
      },
      ...cleanedHistory,
      {
        role: "user",
        content: message,
      },
    ];

    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        stream: false,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json({
        reply: `Model error: ${response.status} ${text}`,
        source: "error",
      });
    }

    const data = JSON.parse(text);

    return NextResponse.json({
      reply: data?.message?.content ?? "No response returned.",
      source: "local-model",
    });
  } catch (error) {
    return NextResponse.json({
      reply: `Server error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      source: "error",
    });
  }
}