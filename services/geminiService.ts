
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

// Helper to get client safely only when needed
const getClient = (): GoogleGenAI | null => {
    if (!apiKey || apiKey.length < 10 || apiKey.includes("YOUR_API_KEY")) {
        return null; 
    }
    try {
        return new GoogleGenAI({ apiKey });
    } catch (e) {
        return null;
    }
}

export const enhanceIncidentDescription = async (rawText: string, group: string): Promise<string> => {
  // 1. Fail fast if text is empty
  if (!rawText) return "";

  // 2. Get Client (Lazy)
  const ai = getClient();
  if (!ai) {
      // Silently return raw text if no valid key
      return rawText;
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      Atue como um despachante do CIOSP.
      Recebi o seguinte relato breve para o grupamento ${group}: "${rawText}".
      Reescreva este relato em formato técnico padrão de polícia/segurança.
      Mantenha a resposta concisa (máximo 3 parágrafos).
      Responda apenas com o texto reescrito.
    `;

    // 3. Attempt Generation
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || rawText;
  } catch (error: any) {
    // 4. ABSOLUTE CATCH-ALL
    // If permission denied (403), quota exceeded (429), or network error:
    // Just return the original text. Do not throw.
    return rawText; 
  }
};

export const analyzeStatistics = async (statsData: string): Promise<string> => {
    const ai = getClient();
    if (!ai) return "Análise IA indisponível (Chave API não configurada).";
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analise brevemente os seguintes dados estatísticos de ocorrências de segurança pública e forneça um insight tático de 2 frases: ${statsData}`
        });
        return response.text || "Sem análise.";
    } catch (error: any) {
        return "Análise tática indisponível no momento.";
    }
}
