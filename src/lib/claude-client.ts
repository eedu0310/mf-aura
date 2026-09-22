import Anthropic from "@anthropic-ai/sdk";

let claudeClient: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!claudeClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    }

    claudeClient = new Anthropic({
      apiKey,
    });
  }

  return claudeClient;
}

export function resetClaudeClient() {
  claudeClient = null;
}
