export interface ImageAttachment {
  data: string; // base64 encoded
  mimeType: string;
  name: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  images?: ImageAttachment[]; // Optional image attachments
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
