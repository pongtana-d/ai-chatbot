"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import { Message, Conversation, ImageAttachment } from "@/types/chat";
import { chatStorage } from "@/lib/storage";
import {
  MODELS,
  THINKING_LEVELS,
  TTS_VOICES,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  DEFAULT_THINKING_LEVEL,
  TRANSLATION_MODES,
  DEFAULT_TRANSLATION_MODE,
} from "@/lib/constants";
import Sidebar from "@/components/Sidebar";
import MessageBubble from "@/components/MessageBubble";
import { ToastContainer, useToast } from "@/components/Toast";

// Supported image types
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [thinkingLevel, setThinkingLevel] = useState(DEFAULT_THINKING_LEVEL);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [translationMode, setTranslationMode] = useState(DEFAULT_TRANSLATION_MODE);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, dismissToast, showError } = useToast();

  const currentModelConfig = MODELS.find((m) => m.id === selectedModel);
  const supportsThinking = currentModelConfig?.supportsThinking ?? false;

  // Load conversations from storage
  useEffect(() => {
    const saved = chatStorage.getConversations();
    setConversations(saved);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, streamingContent]);

  // Auto-resize textarea
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-model-selector]")) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const createNewConversation = useCallback(() => {
    setCurrentConversation(null);
    setInput("");
  }, []);

  const selectConversation = useCallback((conv: Conversation) => {
    setCurrentConversation(conv);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    chatStorage.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
    }
  }, [currentConversation?.id]);

  // Handle image upload
  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newImages: ImageAttachment[] = [];
    
    for (const file of Array.from(files)) {
      // Validate file type
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        showError(`Unsupported image type: ${file.type}. Use PNG, JPEG, WEBP, HEIC, or HEIF.`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_IMAGE_SIZE) {
        showError(`Image too large: ${file.name}. Max size is 20MB.`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        newImages.push({
          data: base64,
          mimeType: file.type,
          name: file.name,
        });
      } catch {
        showError(`Failed to read image: ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      setPendingImages((prev) => [...prev, ...newImages]);
    }
  }, [showError]);

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: input.trim() || (pendingImages.length > 0 ? "What's in this image?" : ""),
      timestamp: Date.now(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
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
    setPendingImages([]); // Clear pending images after sending
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
            images: m.images?.map((img) => ({
              data: img.data,
              mimeType: img.mimeType,
            })),
          })),
          model: selectedModel,
          thinkingLevel: supportsThinking && thinkingLevel !== "off" ? thinkingLevel : undefined,
          translationMode: translationMode !== "none" ? translationMode : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
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
              // Ignore parse errors for incomplete chunks
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
      showError(error instanceof Error ? error.message : "Something went wrong");
      
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
  }, [input, isLoading, currentConversation, selectedModel, supportsThinking, thinkingLevel, translationMode, showError, pendingImages]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleTTSError = useCallback((error: string) => {
    showError(`TTS Error: ${error}`);
  }, [showError]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>

          {/* Model Selector */}
          {/* Translation Mode Selector */}
          <div className="relative" data-translation-selector>
            <select
              value={translationMode}
              onChange={(e) => setTranslationMode(e.target.value)}
              className="appearance-none bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-3 py-1.5 pr-8 rounded-lg font-medium text-sm border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none transition-all cursor-pointer"
            >
              {TRANSLATION_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <ChevronIcon isOpen={false} />
            </div>
          </div>

          {/* Model Selector */}
          <div className="relative" data-model-selector>
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-lg font-semibold text-gray-800 dark:text-white">
                {currentModelConfig?.name || "Gemini"}
              </span>
              <ChevronIcon isOpen={showModelSelector} />
            </button>

            {/* Model Dropdown */}
            {showModelSelector && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
                    Models
                  </p>
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
                      {selectedModel === model.id && <CheckIcon />}
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
                          title={
                            level.budget === -1
                              ? "Dynamic (auto)"
                              : level.budget === 0
                              ? "Disabled"
                              : `${level.budget} tokens`
                          }
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

                {/* Voice Selection Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
                    🔊 TTS Voice
                  </p>
                  <div className="flex flex-wrap gap-1 px-2">
                    {TTS_VOICES.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => setSelectedVoice(voice.id)}
                        title={voice.description}
                        className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                          selectedVoice === voice.id
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        {voice.name}
                      </button>
                    ))}
                  </div>
                </div>
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
            <EmptyState />
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-4">
              {currentConversation?.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  voice={selectedVoice}
                  onError={handleTTSError}
                />
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
                  voice={selectedVoice}
                />
              )}
              {isLoading && !streamingContent && <LoadingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="max-w-3xl mx-auto">
            {/* Image Preview */}
            {pendingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                {pendingImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <Image
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={img.name}
                      width={80}
                      height={80}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 text-xs text-white bg-black/50 px-1 truncate rounded-b-lg">
                      {img.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-2xl p-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                className="hidden"
              />
              
              {/* Image upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Upload image"
                title="Upload image"
              >
                <ImageUploadIcon />
              </button>
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingImages.length > 0 ? "Add a message about this image..." : "Message Gemini..."}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 max-h-48"
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && pendingImages.length === 0) || isLoading}
                className="p-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <SendIcon />
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

// Icon Components
function MenuIcon() {
  return (
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
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function ImageUploadIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function EmptyState() {
  return (
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
        Start a conversation with Gemini AI. Ask questions, get creative ideas, or just chat!
      </p>
    </div>
  );
}

function LoadingIndicator() {
  return (
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
  );
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
