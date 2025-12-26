import { Conversation } from "@/types/chat";

const STORAGE_KEY = "gemini_chat_conversations";

export const chatStorage = {
  getConversations(): Conversation[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveConversation(conversation: Conversation): void {
    if (typeof window === "undefined") return;
    const conversations = this.getConversations();
    const existingIndex = conversations.findIndex(
      (c) => c.id === conversation.id
    );

    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  },

  deleteConversation(id: string): void {
    if (typeof window === "undefined") return;
    const conversations = this.getConversations();
    const filtered = conversations.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  clearAll(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },
};
