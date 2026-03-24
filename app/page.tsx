"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: "local-model" | "tool" | "error";
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
};

const STORAGE_CHATS = "dh-global-ai-chats-v4";
const STORAGE_ACTIVE = "dh-global-ai-active-v4";

const STARTER_MESSAGE: Message = {
  role: "assistant",
  source: "local-model",
  content:
    "Welcome to DH Global AI.\n\nAsk me about websites, React, Next.js, styling, debugging, APIs, layout improvements, code structure, or uploaded files.",
};

const STARTER_PROMPTS = [
  "Build me a better homepage hero section in React",
  "How should I structure a client portal dashboard?",
  "Fix spacing and mobile layout issues in my Next.js app",
  "Create a modern pricing section with Tailwind",
];

function createNewChat(): ChatSession {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [STARTER_MESSAGE],
  };
}

function sourceLabel(source?: Message["source"]) {
  if (source === "tool") return "Tool";
  if (source === "error") return "Error";
  return "DH Global AI";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChatTitle(messages: Message[]) {
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  if (!firstUserMessage) return "New chat";

  const clean = firstUserMessage.content.replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 34)}...` : clean;
}

function renderMessageContent(content: string) {
  const parts = content.split(/```/g);

  return parts.map((part, index) => {
    const isCode = index % 2 === 1;

    if (isCode) {
      return (
        <pre key={index}>
          <code>{part.trim()}</code>
        </pre>
      );
    }

    return (
      <div
        key={index}
        className="whitespace-pre-wrap break-words leading-7 text-[15px]"
      >
        {part}
      </div>
    );
  });
}

function canReadFile(file: File) {
  const allowedExtensions = [
    ".txt",
    ".md",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".html",
    ".css",
    ".scss",
    ".yml",
    ".yaml",
    ".xml",
    ".csv",
    ".env",
    ".sql",
    ".py",
    ".php",
    ".java",
    ".c",
    ".cpp",
    ".cs",
    ".go",
    ".rb",
    ".swift",
  ];

  const lowerName = file.name.toLowerCase();
  return allowedExtensions.some((ext) => lowerName.endsWith(ext));
}

async function readSupportedFiles(
  fileList: FileList | null
): Promise<UploadedFile[]> {
  if (!fileList) return [];

  const files = Array.from(fileList);
  const uploaded: UploadedFile[] = [];

  for (const file of files) {
    if (!canReadFile(file)) continue;

    const text = await file.text();

    uploaded.push({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "text/plain",
      content: text,
      size: file.size,
    });
  }

  return uploaded;
}

export default function Home() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const savedChats = localStorage.getItem(STORAGE_CHATS);
    const savedActiveChatId = localStorage.getItem(STORAGE_ACTIVE);

    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);

          const exists = parsed.some((chat) => chat.id === savedActiveChatId);
          setActiveChatId(
            exists && savedActiveChatId ? savedActiveChatId : parsed[0].id
          );
          return;
        }
      } catch {}
    }

    const fresh = createNewChat();
    setChats([fresh]);
    setActiveChatId(fresh.id);
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(STORAGE_CHATS, JSON.stringify(chats));
    }
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem(STORAGE_ACTIVE, activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, loading, activeChatId]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [message]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [chats, activeChatId]
  );

  const updateActiveChat = (updater: (chat: ChatSession) => ChatSession) => {
    setChats((prev) =>
      prev.map((chat) => (chat.id === activeChatId ? updater(chat) : chat))
    );
  };

  const handleNewChat = () => {
    const fresh = createNewChat();
    setChats((prev) => [fresh, ...prev]);
    setActiveChatId(fresh.id);
    setMessage("");
    setUploadedFiles([]);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (chatId: string) => {
    const nextChats = chats.filter((chat) => chat.id !== chatId);

    if (nextChats.length === 0) {
      const fresh = createNewChat();
      setChats([fresh]);
      setActiveChatId(fresh.id);
      setUploadedFiles([]);
      return;
    }

    setChats(nextChats);

    if (activeChatId === chatId) {
      setActiveChatId(nextChats[0].id);
      setUploadedFiles([]);
    }
  };

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {}
  };

  const handleFilePick = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUploading(true);

    try {
      const files = await readSupportedFiles(event.target.files);
      if (files.length) {
        setUploadedFiles((prev) => [...prev, ...files]);
      }
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const removeUploadedFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const sendMessage = async (prefilled?: string) => {
    if (loading || !activeChat) return;

    const userMessage = (prefilled ?? message).trim();
    if (!userMessage) return;

    const history = activeChat.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const userEntry: Message = {
      role: "user",
      content: userMessage,
      source: "local-model",
    };

    updateActiveChat((chat) => {
      const nextMessages = [...chat.messages, userEntry];
      return {
        ...chat,
        title: getChatTitle(nextMessages),
        updatedAt: Date.now(),
        messages: nextMessages,
      };
    });

    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history,
          uploadedFiles: uploadedFiles.map((file) => ({
            name: file.name,
            type: file.type,
            content: file.content,
          })),
        }),
      });

      const data = await res.json();

      const assistantEntry: Message = {
        role: "assistant",
        content: data.reply || "No reply returned.",
        source: data.source || "local-model",
      };

      updateActiveChat((chat) => ({
        ...chat,
        title: getChatTitle(chat.messages),
        updatedAt: Date.now(),
        messages: [...chat.messages, assistantEntry],
      }));
    } catch {
      const assistantEntry: Message = {
        role: "assistant",
        content: "Error talking to DH Global AI.",
        source: "error",
      };

      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, assistantEntry],
      }));
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!activeChat) return null;

  return (
    <main className="h-screen bg-[#212121] text-white flex overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static top-0 left-0 z-40 h-full w-[300px] bg-[#171717] border-r border-white/10 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-white/10 space-y-4">
          <button
            onClick={handleNewChat}
            className="w-full rounded-xl bg-white/10 hover:bg-white/15 transition px-4 py-3 text-left font-medium"
          >
            + New chat
          </button>

          <div>
            <label className="block text-xs text-white/50 mb-1">Model</label>
            <div className="w-full rounded-xl bg-[#2b2b2b] border border-white/10 px-3 py-2 text-sm">
              DH GLOBAL AI
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chats
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((chat) => {
              const isActive = chat.id === activeChatId;

              return (
                <div
                  key={chat.id}
                  className={`rounded-xl border transition ${
                    isActive
                      ? "bg-white/10 border-white/15"
                      : "bg-transparent border-transparent hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setSidebarOpen(false);
                    }}
                    className="w-full text-left px-3 py-3"
                  >
                    <div className="text-sm font-medium truncate">
                      {chat.title}
                    </div>
                    <div className="text-[11px] text-white/40 mt-1">
                      {formatTime(chat.updatedAt)}
                    </div>
                  </button>

                  <div className="px-3 pb-3">
                    <button
                      onClick={() => handleDeleteChat(chat.id)}
                      className="text-xs text-white/45 hover:text-white transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="p-4 border-t border-white/10 text-sm text-white/60 space-y-1">
          <div>DH Global AI</div>
          <div className="text-xs text-white/35">
            Websites, code, debugging, file analysis
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden rounded-lg border border-white/10 px-3 py-2 text-sm"
            >
              Menu
            </button>

            <div>
              <div className="text-lg font-semibold">DH Global AI</div>
              <div className="text-xs text-white/40">
                Local development assistant
              </div>
            </div>
          </div>

          <div className="text-xs rounded-full border border-white/10 px-3 py-1 text-white/45">
            DH GLOBAL AI
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            {activeChat.messages.length <= 1 && (
              <div className="mb-2">
                <h1 className="text-4xl font-bold mb-3">DH Global AI</h1>
                <p className="text-white/55 mb-6 max-w-3xl">
                  Your local assistant for coding, websites, UI improvements,
                  debugging, app structure, and uploaded file analysis.
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="rounded-2xl border border-white/10 bg-[#171717] hover:bg-white/5 text-left p-4 transition"
                    >
                      <div className="text-sm text-white/85">{prompt}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[92%] md:max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                    msg.role === "user"
                      ? "bg-[#2f2f2f] text-white"
                      : "bg-[#171717] border border-white/10 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="text-xs uppercase tracking-wide text-white/50">
                      {msg.role === "user" ? "You" : "DH Global AI"}
                    </div>

                    {msg.role === "assistant" && (
                      <div className="text-[11px] rounded-full border border-white/10 px-2 py-0.5 text-white/45">
                        {sourceLabel(msg.source)}
                      </div>
                    )}
                  </div>

                  <div>{renderMessageContent(msg.content)}</div>

                  {msg.role === "assistant" && (
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        className="text-xs text-white/50 hover:text-white transition"
                      >
                        {copiedIndex === i ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[92%] md:max-w-[85%] rounded-2xl px-5 py-4 bg-[#171717] border border-white/10 text-white">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="text-xs uppercase tracking-wide text-white/50">
                      DH Global AI
                    </div>
                    <div className="text-[11px] rounded-full border border-white/10 px-2 py-0.5 text-white/45">
                      DH GLOBAL AI
                    </div>
                  </div>
                  <div className="animate-pulse text-white/70">Thinking...</div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#212121]">
          <div className="max-w-5xl mx-auto p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-[#171717] px-3 py-2 text-xs"
                >
                  <span className="max-w-[180px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeUploadedFile(file.id)}
                    className="text-white/50 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              ))}

              {uploading && (
                <div className="rounded-full border border-white/10 bg-[#171717] px-3 py-2 text-xs text-white/60">
                  Uploading...
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#2b2b2b] p-3">
              <div className="flex items-end gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/85 hover:bg-white/5"
                >
                  Upload
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFilePick}
                  className="hidden"
                />

                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-[15px] resize-none max-h-48 overflow-y-auto"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message DH Global AI..."
                  rows={1}
                />

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !message.trim()}
                  className="rounded-xl bg-white text-black px-5 py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-white/40">
              <div>Enter to send • Shift + Enter for new line</div>
              <div>
                Upload supports text/code files like .txt, .md, .js, .ts, .tsx,
                .json, .html, .css
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}