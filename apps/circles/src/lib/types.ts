export type Answer = {
  id: string; question: string; answer: string; provider: string; model: string;
  facts: string[]; createdAt: string; authorId: string; authorName: string; mine: boolean;
};
export type Topic = {
  key: string; question: string; updatedAt: string;
  disagreement: { variants: string[]; note: string } | null;
  pinned: Answer | null;
  answers: Answer[];
};
export type CircleDetail = {
  id: string; name: string; inviteCode: string; owner: boolean;
  members: { id: string; name: string; blocked: boolean; me: boolean }[];
  topics: Topic[];
};

export const providerLabel = (p: string) =>
  p === "anthropic" ? "Claude" : p === "openai" ? "ChatGPT" : p === "google" ? "Gemini" : p === "demo" ? "Demo" : "Other";
