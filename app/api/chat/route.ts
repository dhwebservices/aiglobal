import { NextResponse } from "next/server";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

type UploadedFile = {
  name: string;
  type: string;
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

function getSystemPrompt(hasFiles: boolean) {
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

${
  hasFiles
    ? `
The user has uploaded files in this request.
- Use the uploaded file contents as a primary source of truth when relevant
- If the user asks about the files, answer from those files
- If the file content is incomplete or unclear, say so
`
    : ""
}
`;
}

function getModel() {
  return "qwen2.5-coder:7b";
}

function getOllamaUrl() {
  return process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
}

function trimFileContent(content: string, maxLength = 12000) {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength)}\n\n[File content truncated due to length]`;
}

function buildFileContext(files: UploadedFile[]) {
  if (!files.length) return "";

  const formatted = files
    .map((file, index) => {
      const safeContent = trimFileContent(file.content || "");
      return `File ${index + 1}: ${file.name}
Type: ${file.type || "unknown"}

Content:
${safeContent}`;
    })
    .join("\n\n--------------------\n\n");

  return `The user uploaded these files:\n\n${formatted}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body.message || "");
    const history = Array.isArray(body.history) ? body.history : [];
    const uploadedFiles = Array.isArray(body.uploadedFiles)
      ? (body.uploadedFiles as UploadedFile[])
          .filter(
            (file) =>
              file &&
              typeof file.name === "string" &&
              typeof file.content === "string"
          )
          .map((file) => ({
            name: file.name,
            type: typeof file.type === "string" ? file.type : "",
            content: file.content,
          }))
      : [];

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
    (msg: unknown): msg is IncomingMessage =>
      typeof msg === "object" &&
      msg !== null &&
      "role" in msg &&
      "content" in msg &&
      (((msg as IncomingMessage).role === "user") ||
        ((msg as IncomingMessage).role === "assistant")) &&
      typeof (msg as IncomingMessage).content === "string"
  )
  .map((msg: IncomingMessage) => ({
    role: msg.role,
    content: msg.content,
  }));

    const fileContext = buildFileContext(uploadedFiles);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: getSystemPrompt(uploadedFiles.length > 0),
      },
      ...(fileContext
        ? [
            {
              role: "system" as const,
              content: fileContext,
            },
          ]
        : []),
      ...cleanedHistory,
      {
        role: "user",
        content: message,
      },
    ];

    const response = await fetch(getOllamaUrl(), {
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