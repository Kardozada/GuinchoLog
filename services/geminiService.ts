import { GoogleGenAI } from "@google/genai";
import { DailyLog } from "../types";

// NOTE: In a production app, never expose API keys on the client side.
// This is for demonstration purposes as per instructions.
const API_KEY = process.env.API_KEY || ''; 

export const analyzeDailyLogs = async (logs: DailyLog[]): Promise<string> => {
  if (!API_KEY) return "Erro: Chave de API não configurada.";

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Prepare a summary of the data to reduce token usage
  const dataSummary = logs.map(log => ({
    driver: log.driverName,
    date: log.date,
    vehicle: log.vehicleId,
    totalRevenue: log.totalInvoiced,
    kmDriven: log.kmEnd - log.kmStart,
    observations: log.observations,
    serviceCount: log.services?.length || 0
  }));

  const prompt = `
    Você é um gerente de frota de caminhões de guincho experiente.
    Analise os seguintes dados operacionais do dia (formato JSON simplificado).
    
    Dados: ${JSON.stringify(dataSummary)}

    Por favor, forneça um relatório curto e direto (em Markdown) cobrindo:
    1. Resumo financeiro total.
    2. Identificação de motoristas com maior e menor rendimento.
    3. Alertas de segurança ou manutenção baseados nas observações ou KM rodados excessivos.
    4. Uma dica breve de eficiência operacional.

    Use formatação profissional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Using the fast model for analysis
      contents: prompt,
    });
    
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a IA. Verifique a chave de API.";
  }
};
