import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface GeminiAnalysis {
  summary: string;
  suggested_label: string;
  priority: "low" | "medium" | "high" | "critical";
  reasoning: string;
}

const ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.STRING,
      description: "One sentence summary of the issue or PR",
    },
    suggested_label: {
      type: SchemaType.STRING,
      description:
        "One of: bug, enhancement, documentation, question, help-wanted, security",
    },
    priority: {
      type: SchemaType.STRING,
      description: "One of: low, medium, high, critical",
      enum: ["low", "medium", "high", "critical"],
    },
    reasoning: {
      type: SchemaType.STRING,
      description: "1-2 sentence explanation of the priority and label choice",
    },
  },
  required: ["summary", "suggested_label", "priority", "reasoning"],
};

/**
 * Analyzes a GitHub issue or PR using Gemini 2.0 Flash.
 * Returns structured triage data: summary, suggested label, priority, reasoning.
 *
 * Uses structured output (JSON schema) to ensure reliable parsing.
 * Rate limit: 15 RPM / 1,500 RPD on free tier.
 */
export async function analyzeGitHubEvent(params: {
  eventType: string;
  action: string | null;
  title: string;
  body: string | null;
  repoFullName: string;
  senderLogin: string | null;
}): Promise<GeminiAnalysis | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not configured — skipping AI analysis");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        // Cast needed because SDK types don't perfectly align with SchemaType enum usage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: ANALYSIS_SCHEMA as unknown as any,
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    });

    // Truncate body to avoid token waste
    const truncatedBody = params.body
      ? params.body.substring(0, 2000)
      : "(no description provided)";

    const prompt = `You are a GitHub repository triage assistant. Analyze this ${params.eventType} event and provide triage information.

Repository: ${params.repoFullName}
Event: ${params.eventType}${params.action ? ` - ${params.action}` : ""}
Author: ${params.senderLogin ?? "unknown"}
Title: ${params.title}
Description:
${truncatedBody}

Analyze and respond with the priority, a one-sentence summary, a suggested label, and brief reasoning.
Priority guidelines:
- critical: security vulnerabilities, data loss, production outages, system crashes
- high: major functionality broken, significant UX issues, blocking multiple users
- medium: non-critical bugs, moderate feature requests, documentation gaps
- low: minor polish, cosmetic issues, nice-to-have features`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const analysis = JSON.parse(text) as GeminiAnalysis;

    // Validate priority is one of the expected values
    if (!["low", "medium", "high", "critical"].includes(analysis.priority)) {
      analysis.priority = "medium";
    }

    return analysis;
  } catch (err) {
    console.error("Gemini analysis failed:", err);
    return null;
  }
}
