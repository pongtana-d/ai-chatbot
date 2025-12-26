"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import { Message, Conversation } from "@/types/chat";
import { chatStorage } from "@/lib/storage";
import Sidebar from "@/components/Sidebar";

const MODELS = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", supportsThinking: true },
  { id: "gemini-flash-latest", name: "Gemini Flash Latest", supportsThinking: false },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", supportsThinking: true },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", supportsThinking: true },
];

const THINKING_LEVELS = [
  { id: "off", name: "Off", budget: 0 },
  { id: "low", name: "Low", budget: 1024 },
  { id: "medium", name: "Medium", budget: 8192 },
  { id: "high", name: "High", budget: 24576 },
  { id: "max", name: "Max", budget: -1 },
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro");
  const [thinkingLevel, setThinkingLevel] = useState("off");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModelConfig = MODELS.find((m) => m.id === selectedModel);
  const supportsThinking = currentModelConfig?.supportsThinking ?? false;

  useEffect(() => {
    const saved = chatStorage.getConversations();
    setConversations(saved);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, streamingContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  // Reset thinking level when model changes
  useEffect(() => {
    if (!supportsThinking) {
      setThinkingLevel("off");
    }
  }, [selectedModel, supportsThinking]);

  const createNewConversation = () => {
    setCurrentConversation(null);
    setInput("");
  };

  const selectConversation = (conv: Conversation) => {
    setCurrentConversation(conv);
  };

  const deleteConversation = (id: string) => {
    chatStorage.deleteConversation(id);
    setConversations(conversations.filter((c) => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    let conversation: Conversation;
    if (currentConversation) {
      conversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage],
        updatedAt: Date.now(),
      };
    } else {
      conversation = {
        id: uuidv4(),
        title: input.trim().slice(0, 50) + (input.length > 50 ? "..." : ""),
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    setCurrentConversation(conversation);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          thinkingLevel: supportsThinking && thinkingLevel !== "off" ? thinkingLevel : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: fullContent,
        timestamp: Date.now(),
      };

      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: Date.now(),
      };

      setCurrentConversation(updatedConversation);
      chatStorage.saveConversation(updatedConversation);
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === updatedConversation.id);
        if (existing) {
          return prev.map((c) =>
            c.id === updatedConversation.id ? updatedConversation : c
          );
        }
        return [updatedConversation, ...prev];
      });
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, errorMessage],
        updatedAt: Date.now(),
      };
      setCurrentConversation(updatedConversation);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        conversations={conversations}
        currentId={currentConversation?.id}
        onNewChat={createNewConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          
          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-lg font-semibold text-gray-800 dark:text-white">
                {currentModelConfig?.name || "Gemini"}
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showModelSelector ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Dropdown */}
            {showModelSelector && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">Models</p>
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedModel === model.id
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {model.supportsThinking ? "Supports thinking" : "Standard"}
                        </div>
                      </div>
                      {selectedModel === model.id && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Thinking Level Section */}
                {supportsThinking && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
                      Thinking Level
                    </p>
                    <div className="flex flex-wrap gap-1 px-2">
                      {THINKING_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => setThinkingLevel(level.id)}
                          title={level.budget === -1 ? "Dynamic (auto)" : level.budget === 0 ? "Disabled" : `${level.budget} tokens`}
                          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                            thinkingLevel === level.id
                              ? "bg-purple-500 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {level.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Thinking Level Badge */}
          {supportsThinking && thinkingLevel !== "off" && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              🧠 {thinkingLevel}
            </span>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!currentConversation?.messages.length && !streamingContent ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
                How can I help you today?
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                Start a conversation with Gemini AI. Ask questions, get creative
                ideas, or just chat!
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-4">
              {currentConversation?.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {streamingContent && (
                <MessageBubble
                  message={{
                    id: "streaming",
                    role: "assistant",
                    content: streamingContent,
                    timestamp: Date.now(),
                  }}
                  isStreaming
                />
              )}
              {isLoading && !streamingContent && (
                <div className="flex gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1 py-3">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-2xl p-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Gemini..."
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 max-h-48"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Gemini can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 mb-6 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-gray-600"
            : "bg-gradient-to-br from-blue-500 to-purple-600"
        }`}
      >
        {isUser ? (
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        )}
      </div>
      <div
        className={`max-w-[80%] ${
          isUser
            ? "bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2"
            : "text-gray-800 dark:text-gray-100"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className={`markdown-content ${isStreaming ? "typing-cursor" : ""}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
