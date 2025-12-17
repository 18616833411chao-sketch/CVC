import { GoogleGenAI } from "@google/genai";
import { RegressionResult } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found in environment");
    return new GoogleGenAI({ apiKey });
};

export const analyzeRegression = async (result: RegressionResult, targetName: string): Promise<string> => {
    const client = getClient();
    
    // Prepare a summarized prompt to avoid token limits with raw data
    const summary = {
        targetVariable: targetName,
        rSquared: result.r2.toFixed(4),
        adjustedR2: result.adjustedR2.toFixed(4),
        rmse: result.rmse.toFixed(4),
        observations: result.observations,
        coefficients: result.coefficients.map(c => ({
            name: c.name,
            value: c.value.toFixed(4),
            tStat: c.tStat?.toFixed(2),
            significance: Math.abs(c.tStat || 0) > 2 ? "High (Significant)" : "Low (Insignificant)"
        }))
    };

    const prompt = `
        请扮演一位专业的统计学家。分析针对目标变量 "${targetName}" 的多元线性回归结果。
        
        数据摘要:
        ${JSON.stringify(summary, null, 2)}

        请提供一份**中文**的简洁 Markdown 格式报告，涵盖以下内容：
        1. **模型拟合度 (Model Fit)**: 解读 R方 (R-squared) 和 均方根误差 (RMSE)。
           *   如果 R² 低于 0.3，请直接指出模型拟合较差。
           *   如果 R² 高于 0.7，请指出模型拟合较好。
        2. **关键驱动因素 (Key Drivers)**: 哪些变量具有最大的正向或负向影响？（讨论回归系数）。
        3. **显著性 (Significance)**: 基于提供的 t-stat 估算值，指出哪些变量在统计上是显著的（|t| > 2）。
        4. **改进建议 (How to Improve R²)**:
           *   请专门分析当前 R² (${result.r2.toFixed(4)}) 的水平。
           *   针对此结果，提供 3 条具体的改进建议。
           *   提示用户是否需要考虑：非线性关系（如平方项）、交互效应（变量组合）、或寻找未被包含的外部变量（遗漏变量偏误）。
        
        请保持语气专业且通俗易懂，重点在于帮助用户优化模型。
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        return response.text || "无法生成分析结果。";
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "生成 AI 分析时发生错误。请检查您的 API 密钥并重试。";
    }
};