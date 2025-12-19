import { GoogleGenAI } from "@google/genai";
import { RegressionResult } from "../types";

export const analyzeRegression = async (result: RegressionResult, targetName: string): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found in environment");
    
    // Always initialize with named parameter right before making the call
    const ai = new GoogleGenAI({ apiKey });
    
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

        请完成以下两个任务：

        **任务一：分析报告**
        请提供一份**中文**的简洁 Markdown 格式报告，涵盖以下内容：
        1. **模型拟合度 (Model Fit)**: 解读 R方 (R-squared) 和 均方根误差 (RMSE)。
        2. **关键驱动因素 (Key Drivers)**: 哪些变量具有最大的正向或负向影响？
        3. **显著性 (Significance)**: 指出哪些变量在统计上是显著的（|t| > 2），哪些是不显著的（建议移除）。
        4. **改进建议**: 针对当前 R² (${result.r2.toFixed(4)})，提供具体的改进思路（如移除不显著变量、添加平方项以捕捉非线性关系、或生成交互项）。

        **任务二：推荐配置 (JSON)**
        基于你的分析，请在报告的**最后**，提供一个**优化后的模型配置 JSON 代码块**。
        这个配置应该包含你认为应该保留或新增的特征。
        
        JSON 格式必须严格遵守以下结构 (不要包含注释):
        \`\`\`json
        {
          "target": "${targetName}",
          "targetLogTransform": false, 
          "targetLogPlusOne": false,
          "features": [
             { "name": "变量名1", "type": "numeric", "role": "feature", "logTransform": false, "logPlusOne": false },
             { "name": "变量名2", "type": "categorical", "role": "feature", "logTransform": false, "logPlusOne": false },
             { "name": "变量名3^2", "type": "numeric", "role": "feature", "logTransform": false, "logPlusOne": false } 
          ]
        }
        \`\`\`
        注意：
        1. 如果建议添加平方项，请在变量名后加 "^2" (例如 "Age^2")。
        2. 如果建议添加交互项，请用 "_x_" 连接 (例如 "Age_x_Income")。
        3. 仅包含你认为有价值的特征。
        4. 确保 "target" 字段与输入保持一致。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        
        return response.text || "无法生成分析结果。";
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "生成 AI 分析时发生错误。请检查您的 API 密钥并重试。";
    }
};