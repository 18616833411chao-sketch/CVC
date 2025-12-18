import React, { useState } from 'react';
import { RegressionResult } from '../types';
import RegressionCharts from './RegressionCharts';
import { analyzeRegression } from '../services/geminiService';
import { Bot, RefreshCw, Calculator, ArrowLeft, Info, HelpCircle, Star, CheckCircle2, Settings2, FileUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; 

interface Props {
  result: RegressionResult;
  targetName: string;
  onBackToConfig: () => void; // New prop: Back to configuration/cleaning
  onUploadNew: () => void;    // New prop: Full reset/Upload new file
}

const ResultsView: React.FC<Props> = ({ result, targetName, onBackToConfig, onUploadNew }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const handleAIAnalysis = async () => {
    setLoadingAI(true);
    const text = await analyzeRegression(result, targetName);
    setAnalysis(text);
    setLoadingAI(false);
  };

  const metrics = [
    {
      label: "R方 (R-Squared)",
      value: result.r2.toFixed(4),
      subtext: `调整后 R²: ${result.adjustedR2.toFixed(4)}`,
      tooltip: "决定系数 (0-1)。反映模型对数据的拟合程度。值越接近 1，说明模型能解释的变异越多，拟合效果越好。",
      iconColor: "text-blue-400",
      valueColor: "text-blue-700"
    },
    {
      label: "均方根误差 (RMSE)",
      value: result.rmse.toFixed(4),
      subtext: "平均预测误差",
      tooltip: "预测值与真实值之间偏差的标准差。数值越小，说明模型的预测精度越高。单位与目标变量相同。",
      iconColor: "text-emerald-400",
      valueColor: "text-emerald-700"
    },
    {
      label: "样本量 (Observations)",
      value: result.observations,
      subtext: "有效数据行数",
      tooltip: "实际投入模型计算的数据行数。已自动剔除了包含空值、无效值或被判定为异常值的数据行。",
      iconColor: "text-purple-400",
      valueColor: "text-purple-700"
    },
    {
      label: "预测变量数",
      value: result.coefficients.length - 1,
      subtext: "特征数量",
      tooltip: "模型中使用的自变量（特征）数量。不包含截距项。",
      iconColor: "text-amber-400",
      valueColor: "text-amber-700"
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">模型分析结果</h2>
          <p className="text-slate-500">目标变量: <span className="font-semibold text-blue-600">{targetName}</span></p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={onUploadNew} 
                className="flex items-center gap-2 px-4 py-2 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors text-sm font-medium shadow-sm"
            >
                <FileUp size={16} />
                上传新文件
            </button>
            <button 
                onClick={onBackToConfig} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md active:scale-95"
            >
                <Settings2 size={16} />
                调整变量配置
            </button>
        </div>
      </div>

      {/* KPI Cards with Tooltips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow">
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20 pointer-events-none text-center leading-relaxed">
              {m.tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
            
            <div className="flex items-center gap-1.5 mb-2">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{m.label}</p>
               <HelpCircle size={14} className={`${m.iconColor} cursor-help opacity-70 hover:opacity-100`} />
            </div>
            <p className={`text-3xl font-bold ${m.valueColor}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{m.subtext}</p>
          </div>
        ))}
      </div>

      {/* Equation Panel */}
      <div className="bg-slate-900 text-slate-200 p-6 rounded-xl shadow-lg mb-8 font-mono text-sm overflow-x-auto">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Calculator size={16} />
            <span className="uppercase text-xs font-bold tracking-wider">回归方程</span>
        </div>
        <p className="whitespace-nowrap text-lg leading-relaxed text-emerald-400">
            {result.equation}
        </p>
      </div>

      {/* Main Content Area: Charts & Table (Full Width now) */}
      <div className="space-y-8 mb-12">
           <RegressionCharts result={result} targetName={targetName} />
           
           {/* Detailed Coefficients Table */}
           <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700">系数明细表 (Coefficients)</h3>
                <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                    置信区间: 95%
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 whitespace-nowrap">
                        <tr>
                            <th className="px-6 py-3">变量名称</th>
                            <th className="px-6 py-3 text-right">系数 (Coef)</th>
                            <th className="px-6 py-3 text-right">标准误差 (SE)</th>
                            <th className="px-6 py-3 text-right">t统计量</th>
                            <th className="px-6 py-3 text-right">VIF</th>
                            <th className="px-6 py-3 text-center">95% 置信区间</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {result.coefficients.map((c, i) => {
                            const isSignificant = Math.abs(c.tStat || 0) > 2;
                            const vifHigh = (c.vif || 0) > 5;
                            return (
                            <tr key={i} className={`hover:bg-slate-50 ${isSignificant ? 'bg-emerald-50/30' : ''}`}>
                                <td className="px-6 py-3 font-medium text-slate-700">
                                    <div className="flex items-center gap-2">
                                        {c.name}
                                        {isSignificant && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                <Star size={10} fill="currentColor"/> 显著
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-right font-mono text-slate-600">{c.value.toFixed(4)}</td>
                                <td className="px-6 py-3 text-right text-slate-500">{c.stdError?.toFixed(4)}</td>
                                <td className={`px-6 py-3 text-right font-medium ${isSignificant ? 'text-emerald-700' : 'text-slate-400'}`}>
                                    {c.tStat?.toFixed(2)}
                                </td>
                                <td className={`px-6 py-3 text-right font-medium ${vifHigh ? 'text-red-500' : 'text-slate-500'}`}>
                                    {c.vif ? c.vif.toFixed(2) : '-'}
                                </td>
                                <td className="px-6 py-3 text-center font-mono text-xs text-slate-500">
                                    [{c.confidenceInterval?.[0].toFixed(3)}, {c.confidenceInterval?.[1].toFixed(3)}]
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center flex justify-center gap-4">
                  <span>注：t统计量绝对值 &gt; 2 视为显著。</span>
                  <span>VIF &gt; 5 可能存在多重共线性问题。</span>
              </div>
           </div>
      </div>

      {/* AI Analysis Section (Moved to Bottom) */}
      <div className="border-t-2 border-slate-100 pt-10">
            <div className="bg-white rounded-xl border border-indigo-100 shadow-md overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="p-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">
                                <Bot size={28} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-xl">AI 智能解读报告</h3>
                                <p className="text-sm text-slate-500">由 Google Gemini 2.5 Flash 模型驱动</p>
                            </div>
                        </div>
                        
                        {!analysis && !loadingAI && (
                            <button 
                                onClick={handleAIAnalysis}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 transform active:scale-95"
                            >
                                <Bot size={20} />
                                生成详细分析报告
                            </button>
                        )}
                    </div>
                    
                    {!analysis && !loadingAI && (
                        <div className="bg-slate-50 rounded-lg border border-slate-100 p-8 text-center">
                            <Bot size={48} className="mx-auto text-slate-300 mb-4" />
                            <h4 className="text-slate-600 font-medium mb-2">准备就绪</h4>
                            <p className="text-slate-500 text-sm max-w-lg mx-auto">
                                点击上方按钮，让 AI 为您解读模型的统计学意义，包括拟合度评价、关键驱动因素分析及业务建议。
                            </p>
                        </div>
                    )}

                    {loadingAI && (
                         <div className="text-center py-16 flex flex-col items-center bg-slate-50 rounded-lg border border-slate-100">
                            <RefreshCw className="animate-spin text-indigo-500 mb-4" size={40} />
                            <p className="text-slate-700 font-medium text-lg">正在生成分析报告...</p>
                            <p className="text-slate-400 text-sm mt-2">正在咨询 Gemini AI 专家</p>
                         </div>
                    )}

                    {analysis && (
                        <div className="prose prose-slate max-w-none text-slate-700 bg-slate-50/50 p-8 rounded-xl border border-slate-200/60 shadow-inner">
                           {/* Render markdown content */}
                           {analysis.split('\n').map((line, i) => {
                               // Simple custom rendering for better styling
                               if (line.trim().startsWith('###') || line.trim().startsWith('**') && !line.includes(':')) {
                                    return <h4 key={i} className="text-lg font-bold text-slate-800 mt-6 mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                        {line.replace(/[#*]/g, '').trim()}
                                    </h4>;
                               }
                               if (line.trim().startsWith('-') || line.trim().startsWith('* ')) {
                                    return <li key={i} className="ml-5 mb-1 list-disc text-slate-700 leading-relaxed">{line.substring(1).trim()}</li>;
                               }
                               if (line.trim().match(/^\d+\./)) {
                                    return <div key={i} className="font-semibold text-slate-800 mt-4 mb-2">{line}</div>;
                               }
                               if (line.trim() === "") return <br key={i}/>;
                               
                               return <p key={i} className="mb-2 leading-relaxed text-slate-700">{line}</p>;
                           })}
                           
                           <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-end gap-1">
                               <CheckCircle2 size={12} />
                               分析生成完毕
                           </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800 flex gap-3 items-start">
                <Info className="shrink-0 mt-0.5 text-blue-600" size={20} />
                <div>
                    <p className="font-semibold mb-1">统计指标说明:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700/80">
                        <li><strong>显著性:</strong> 标记为“显著”的变量（t-Stat 绝对值 &gt; 2）表示其对结果的影响在统计学上是可靠的，不太可能由随机因素引起。</li>
                        <li><strong>R方 (R²):</strong> 越接近 1.0 表示模型越能解释数据的变化。低 R² 可能意味着还有其他未考虑的重要因素。</li>
                        <li><strong>RMSE:</strong> 预测误差的标准差，数值越小越好。</li>
                    </ul>
                </div>
            </div>
      </div>
    </div>
  );
};

export default ResultsView;