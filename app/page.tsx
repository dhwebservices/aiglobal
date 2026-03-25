"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: "local-model" | "tool" | "error";
  createdAt?: number;
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

const STORAGE_CHATS = "dh-global-ai-chats-v5";
const STORAGE_ACTIVE = "dh-global-ai-active-v5";

const STARTER_MESSAGE: Message = {
  role: "assistant",
  source: "local-model",
  createdAt: Date.now(),
  content:
    "Welcome to DH Global AI.\n\nAsk me about anything, but if you want a website.. visit DHWebsiteservices.co.uk.",
};

const STARTER_PROMPTS = [
  "Build me a better homepage hero section in React",
  "How should I structure a client portal dashboard?",
  "Fix spacing and mobile layout issues in my Next.js app",
  "Create a modern pricing section with Tailwind",
];

function makeId() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createNewChat(): ChatSession {
  const now = Date.now();

  return {
    id: makeId(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [{ ...STARTER_MESSAGE, createdAt: now }],
  };
}

function sourceLabel(source?: Message["source"]) {
  if (source === "tool") return "Tool";
  if (source === "error") return "Error";
  return "David";
}

function formatChatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageTime(timestamp?: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
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
      id: makeId(),
      name: file.name,
      type: file.type || "text/plain",
      content: text,
      size: file.size,
    });
  }

  return uploaded;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

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
      } catch {
        // ignore bad local state
      }
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

  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingChatId]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [chats, activeChatId]
  );

  const sortedChats = useMemo(
    () => chats.slice().sort((a, b) => b.updatedAt - a.updatedAt),
    [chats]
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
    setRenamingChatId(null);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (chatId: string) => {
    const confirmed = window.confirm("Delete this chat?");
    if (!confirmed) return;

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

  const startRenameChat = (chat: ChatSession) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.title);
  };

  const saveRenameChat = () => {
    if (!renamingChatId) return;

    const nextTitle = renameValue.trim() || "New chat";

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === renamingChatId ? { ...chat, title: nextTitle } : chat
      )
    );

    setRenamingChatId(null);
    setRenameValue("");
  };

  const exportChat = (chat: ChatSession) => {
    const lines: string[] = [];
    lines.push(`DH Global AI chat export`);
    lines.push(`Title: ${chat.title}`);
    lines.push(`Created: ${formatChatTime(chat.createdAt)}`);
    lines.push(`Updated: ${formatChatTime(chat.updatedAt)}`);
    lines.push("");

    chat.messages.forEach((msg) => {
      const author = msg.role === "user" ? "You" : "David";
      lines.push(`[${author}] ${msg.createdAt ? formatChatTime(msg.createdAt) : ""}`);
      lines.push(msg.content);
      lines.push("");
    });

    const safeName = chat.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "chat";
    downloadTextFile(`${safeName}.txt`, lines.join("\n"));
  };

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // ignore clipboard failures
    }
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

    const now = Date.now();

    const userEntry: Message = {
      role: "user",
      content: userMessage,
      source: "local-model",
      createdAt: now,
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
        createdAt: Date.now(),
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
        content: "Server error: unable to reach David right now.",
        source: "error",
        createdAt: Date.now(),
      };

      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, assistantEntry],
      }));
    }

    setLoading(false);
  };

  const clearAllChats = () => {
    const confirmed = window.confirm("Clear all chats?");
    if (!confirmed) return;

    const fresh = createNewChat();
    setChats([fresh]);
    setActiveChatId(fresh.id);
    setUploadedFiles([]);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!activeChat) return null;

  return (
  <>
    {/* Top Header */}
    <div style={{
      width: "100%",
      padding: "12px 20px",
      borderBottom: "1px solid #e5e5e5",
      background: "#ffffff",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 50
    }}>
      <div style={{ fontWeight: 600, fontSize: "16px" }}>
        DH Global AI
      </div>

      <a 
        href="https://dhwebsiteservices.co.uk"
        target="_blank"
        style={{
          fontSize: "14px",
          color: "#0071e3",
          textDecoration: "none",
          fontWeight: 500
        }}
      >
        Get a website →
      </a>
    </div>

    <main className="dh-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="dh-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside className={`dh-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dh-sidebar-top">
          <button onClick={handleNewChat} className="dh-new-chat-btn">
            + New chat
          </button>

          <div className="dh-model-card">
            <span className="dh-model-label">Model</span>
            <div className="dh-model-value">DH GLOBAL AI</div>
          </div>
        </div>

        <div className="dh-chat-list">
          {sortedChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isRenaming = renamingChatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`dh-chat-list-item ${isActive ? "active" : ""}`}
              >
                <div className="dh-chat-list-main">
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={saveRenameChat}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRenameChat();
                        if (e.key === "Escape") {
                          setRenamingChatId(null);
                          setRenameValue("");
                        }
                      }}
                      className="dh-rename-input"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setSidebarOpen(false);
                      }}
                      className="dh-chat-open-btn"
                    >
                      <span className="dh-chat-title">{chat.title}</span>
                      <span className="dh-chat-date">
                        {formatChatTime(chat.updatedAt)}
                      </span>
                    </button>
                  )}
                </div>

                <div className="dh-chat-actions">
                  <button
                    onClick={() => startRenameChat(chat)}
                    className="dh-small-action"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => exportChat(chat)}
                    className="dh-small-action"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => handleDeleteChat(chat.id)}
                    className="dh-small-action danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="dh-sidebar-bottom">
          <button onClick={clearAllChats} className="dh-clear-btn">
            Clear all chats
          </button>
          <div className="dh-sidebar-footnote">
            DH Global AI
            <br />
            Websites, code, business systems, file analysis
          </div>
        </div>
      </aside>

      <section className="dh-main">
        <header className="dh-topbar">
          <div className="dh-topbar-left">
            <button
              onClick={() => setSidebarOpen(true)}
              className="dh-menu-btn"
            >
              Menu
            </button>

            <div>
              <div className="dh-brand-title">DH Global AI</div>
              <div className="dh-brand-subtitle">David · AI assistant</div>
            </div>
          </div>

          <div className="dh-status-pill">
            <span className="dh-status-dot" />
            Online
          </div>
        </header>

        <div className="dh-content">
          <div className="dh-content-inner">
            {activeChat.messages.length <= 1 && (
              <section className="dh-hero">
                <h1>DH Global AI</h1>
                <p>
                  Your assistant for websites, code, layouts, business systems,
                  content, file analysis, and technical problem solving.
                </p>

                <div className="dh-prompt-grid">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="dh-prompt-card"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="dh-messages">
              {activeChat.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`dh-message-row ${
                    msg.role === "user" ? "user" : "assistant"
                  }`}
                >
                  <article
                    className={`dh-message-card ${
                      msg.role === "user" ? "user" : "assistant"
                    }`}
                  >
                    <div className="dh-message-meta">
                      <div className="dh-message-author">
                        {msg.role === "user" ? "You" : "David"}
                      </div>

                      <div className="dh-message-meta-right">
                        {msg.role === "assistant" && (
                          <span className="dh-message-badge">
                            {sourceLabel(msg.source)}
                          </span>
                        )}
                        <span className="dh-message-time">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="dh-message-content">
                      {renderMessageContent(msg.content)}
                    </div>

                    {msg.role === "assistant" && (
                      <div className="dh-message-footer">
                        <button
                          onClick={() => copyMessage(msg.content, i)}
                          className="dh-copy-btn"
                        >
                          {copiedIndex === i ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </article>
                </div>
              ))}

              {loading && (
                <div className="dh-message-row assistant">
                  <article className="dh-message-card assistant">
                    <div className="dh-message-meta">
                      <div className="dh-message-author">David</div>
                      <div className="dh-message-meta-right">
                        <span className="dh-message-badge">Thinking</span>
                      </div>
                    </div>

                    <div className="dh-thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  </article>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        <footer className="dh-composer-wrap">
          <div className="dh-composer-inner">
            {(uploadedFiles.length > 0 || uploading) && (
              <div className="dh-upload-list">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="dh-upload-chip">
                    <span className="dh-upload-name">{file.name}</span>
                    <button
                      onClick={() => removeUploadedFile(file.id)}
                      className="dh-upload-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {uploading && (
                  <div className="dh-upload-chip muted">Uploading...</div>
                )}
              </div>
            )}

            <div className="dh-composer">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="dh-upload-btn"
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
                className="dh-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message DH Global AI..."
                rows={1}
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading || !message.trim()}
                className="dh-send-btn"
              >
                Send
              </button>
            </div>

            <div className="dh-composer-help">
              <span>Enter to send • Shift + Enter for new line</span>
              <span>
                Upload supports text/code files like .txt, .md, .js, .ts, .tsx,
                .json, .html, .css
              </span>
            </div>
          </div>
        </footer>
      </section>
    </main>
    </>
  );
}