import React, { useState, useMemo } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, ReferenceLine, LabelList, Cell, ComposedChart, ErrorBar, Legend
} from 'recharts';
import { RegressionResult } from '../types';
import { HelpCircle, TrendingUp, TrendingDown, Info, Scale, ArrowRight, Minus, AlertTriangle, Lightbulb } from 'lucide-react';

interface Props {
  result: RegressionResult;
  targetName: string;
}

// Acklam's algorithm approximation for Inverse Normal CDF
function normInv(p: number): number {
    const a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969, a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
    const b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887, b4 = 66.8013118877197, b5 = -13.2806815528857;
    const c1 = -7.78489400243029E-03, c2 = -0.322396458041136, c3 = -2.40075827716184, c4 = -2.54973253934373, c5 = 4.37466414146497, c6 = 2.93816398269878;
    const d1 = 7.78469570904146E-03, d2 = 0.322467129070039, d3 = 2.44513413714299, d4 = 3.75440866190742;
    const p_low = 0.02425, p_high = 1 - p_low;

    if (p < p_low) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    if (p >= p_low && p <= p_high) {
        const q = p - 0.5;
        const r = q * q;
        return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }
    if (p > p_high) {
        const q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    return 0;
}

const RegressionCharts: React.FC<Props> = ({ result, targetName }) => {
  const [useStandardized, setUseStandardized] = useState(false);

  // Unified Tooltip Style
  const TOOLTIP_STYLE = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
    padding: '10px',
    fontSize: '12px',
    color: '#1e293b'
  };

  // 1. Predicted vs Actual Data
  const predVsActualData = result.predictions.map((p, i) => ({
    x: Number(p.actual.toFixed(2)),
    y: Number(p.predicted.toFixed(2)),
    id: i
  }));

  // 2. Residuals Data (Updated to include both raw and standardized)
  const residualsData = result.predictions.map((p, i) => ({
    x: Number(p.predicted.toFixed(2)),
    yRaw: Number(p.residual.toFixed(2)),
    yStd: Number((p.residual / result.rmse).toFixed(2)),
    id: i
  }));

  // 3. Coefficients Data (Sorted by magnitude)
  const coefData = result.coefficients
    .filter(c => c.name !== 'Intercept')
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  // 4. Q-Q Plot Data
  const sortedResiduals = [...result.predictions].map(p => p.residual).sort((a, b) => a - b);
  const stdDevResiduals = result.rmse; // Approximate using RMSE
  const qqData = sortedResiduals.map((res, i) => {
      const p = (i + 0.5) / sortedResiduals.length;
      const theoreticalQuantile = normInv(p);
      const standardizedResidual = res / stdDevResiduals;
      return {
          x: Number(theoreticalQuantile.toFixed(2)),
          y: Number(standardizedResidual.toFixed(2))
      };
  });

  // 5. Scale-Location Data
  const scaleLocationData = result.predictions.map((p, i) => {
      const standardizedResidual = p.residual / stdDevResiduals;
      return {
          x: Number(p.predicted.toFixed(2)),
          y: Number(Math.sqrt(Math.abs(standardizedResidual)).toFixed(2))
      }
  });

  // 6. VIF Data
  const vifData = result.coefficients
    .filter(c => c.name !== 'Intercept' && c.vif !== undefined && !isNaN(c.vif) && c.vif !== Infinity)
    .map(c => ({
        name: c.name,
        vif: c.vif
    }))
    .sort((a, b) => (b.vif || 0) - (a.vif || 0));

  // 7. Robustness Data
  const robustnessData = result.robustness ? result.robustness.map(r => ({
      name: r.name,
      original: r.original,
      error: [
          Math.abs(r.original - r.bootstrapLowCI), // Minus
          Math.abs(r.bootstrapHighCI - r.original) // Plus
      ],
      median: r.bootstrapMedian
  })).sort((a, b) => Math.abs(b.original) - Math.abs(a.original)) : [];

  // 8. Categorical Data Preparation (Box Plots)
  const categoricalCharts = useMemo(() => {
    if (!result.predictions[0]?.categories) return [];
    
    // Get all categorical variable names present in the result
    const catVarNames = Object.keys(result.predictions[0].categories);
    
    return catVarNames.map(catVar => {
        // Group actual target values by category
        const groups: Record<string, number[]> = {};
        result.predictions.forEach(p => {
            const val = p.categories?.[catVar];
            if (val) {
                if (!groups[val]) groups[val] = [];
                groups[val].push(p.actual);
            }
        });

        // Calculate Box Plot stats for each group
        const chartData = Object.entries(groups).map(([groupName, values]) => {
            values.sort((a, b) => a - b);
            const min = values[0];
            const max = values[values.length - 1];
            const q1 = values[Math.floor(values.length * 0.25)];
            const median = values[Math.floor(values.length * 0.5)];
            const q3 = values[Math.floor(values.length * 0.75)];
            
            return {
                name: groupName,
                min,
                max,
                median,
                rangeFull: [min, max], // For whisker (thin bar)
                rangeBox: [q1, q3],    // For box (thick bar)
                count: values.length
            };
        });

        // Sort chartData alphabetically by name for better consistency
        chartData.sort((a, b) => a.name.localeCompare(b.name));

        return {
            varName: catVar,
            data: chartData
        };
    });
  }, [result]);

  // --- Dynamic Analysis Helpers ---

  const renderChartInsight = (title: string, items: React.ReactNode[], type: 'info' | 'warning' | 'tip' | 'error' = 'info') => {
    const styles = {
      info: { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'text-indigo-600', text: 'text-indigo-900', iconType: Info },
      warning: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600', text: 'text-amber-900', iconType: AlertTriangle },
      tip: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', text: 'text-emerald-900', iconType: Lightbulb },
      error: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-600', text: 'text-red-900', iconType: AlertTriangle },
    };
    const s = styles[type];
    const Icon = s.iconType;
    
    return (
      <div className={`mt-4 p-4 rounded-lg border ${s.bg} ${s.border} ${s.text} text-sm`}>
        <h4 className="font-bold mb-2 flex items-center gap-2">
          <Icon size={16} className={s.icon} />
          {title}
        </h4>
        <ul className="space-y-1.5 ml-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-current opacity-60 shrink-0"></span>
              <span className="opacity-90 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Helper: Detailed Categorical Model Impact
  const renderCategoryImpact = (catName: string, data: any[]) => {
      // Find coefficients related to this category
      const relevantCoeffs = result.coefficients.filter(c => c.name.startsWith(`${catName}_`));
      
      const presentLevels = data.map(d => d.name);
      const coeffLevels = relevantCoeffs.map(c => c.name.replace(`${catName}_`, ''));
      const baselineLevel = presentLevels.find(l => !coeffLevels.includes(l)) || "未知基准";

      return (
          <div className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Scale size={18} className="text-blue-600" />
                  模型影响力深度分析 (Model Impact)
              </h4>
              
              <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-3 mb-4">
                  <p>
                      在回归模型中，分类变量 <strong>{catName}</strong> 被拆解为一组“虚拟变量”。
                      模型自动选择了 <strong><span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-800">{baselineLevel}</span></strong> 作为
                      <span className="font-bold text-blue-700"> 基准水平 (Baseline)</span>。
                  </p>
                  <p>
                      下表显示的系数代表：与其他分类相比，当分类为该特定值时，目标变量 <strong>{targetName}</strong> 的平均变化量（相对于基准水平）。
                  </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-2">分类水平</th>
                              <th className="px-4 py-2 text-right">系数 (影响值)</th>
                              <th className="px-4 py-2 text-center">显著性</th>
                              <th className="px-4 py-2 text-slate-500 font-normal">解读</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                          <tr className="bg-slate-50/50">
                              <td className="px-4 py-3 font-medium text-slate-800">
                                  {baselineLevel} <span className="text-xs text-slate-400 font-normal ml-1">(基准)</span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400">0.0000</td>
                              <td className="px-4 py-3 text-center text-slate-400">-</td>
                              <td className="px-4 py-3 text-xs text-slate-400">作为比较的参考标准</td>
                          </tr>
                          {relevantCoeffs.map(c => {
                              const levelName = c.name.replace(`${catName}_`, '');
                              const isSignificant = Math.abs(c.tStat || 0) > 2;
                              const isPositive = c.value > 0;
                              return (
                                  <tr key={c.name} className={isSignificant ? 'bg-blue-50/20' : ''}>
                                      <td className="px-4 py-3 font-medium text-slate-700">{levelName}</td>
                                      <td className={`px-4 py-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                          {c.value > 0 ? '+' : ''}{c.value.toFixed(4)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                          {isSignificant ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                                  显著
                                              </span>
                                          ) : (
                                              <span className="text-slate-400 text-xs">不显著</span>
                                          )}
                                      </td>
                                      <td className="px-4 py-3 text-xs text-slate-600">
                                          相对于 {baselineLevel}，{targetName} 预计 
                                          <span className={`font-bold mx-1 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                              {isPositive ? '增加' : '减少'} {Math.abs(c.value).toFixed(2)}
                                          </span>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  // Helper to generate text insight for categories
  const getCategoryInsight = (data: any[], catName: string) => {
      if (data.length < 2) return null;
      const sorted = [...data].sort((a, b) => b.median - a.median);
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];
      const diff = highest.median - lowest.median;
      
      return renderChartInsight('可视化数据解读 (Visual Insight)', [
         <span>从箱线图可以看出，<strong>{highest.name}</strong> 的中位数最高（{highest.median.toFixed(2)}），而 <strong>{lowest.name}</strong> 最低（{lowest.median.toFixed(2)}）。</span>,
         <span>两者中位数差距为 <strong>{diff.toFixed(2)}</strong>。这展示了原始数据层面的分布差异，请结合下方的回归系数表确认该差异是否具有统计学意义。</span>
      ], 'tip');
  };

  // Custom Tooltip for Residuals Chart
  const CustomResidualsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs z-50">
                <p className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">数据点 #{data.id + 1}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-slate-500 text-right">预测值:</span>
                    <span className="font-mono text-slate-800">{data.x}</span>
                    
                    <span className="text-slate-500 text-right">原始残差:</span>
                    <span className="font-mono text-slate-800">{data.yRaw}</span>
                    
                    <span className="text-slate-500 text-right">标准化残差:</span>
                    <span className={`font-mono font-medium ${Math.abs(data.yStd) > 2 ? 'text-red-600' : 'text-slate-800'}`}>
                        {data.yStd}
                    </span>
                </div>
                {Math.abs(data.yStd) > 2 && (
                    <div className="mt-2 text-red-500 font-medium flex items-center gap-1">
                        ⚠️ 可能的异常值
                    </div>
                )}
            </div>
        );
    }
    return null;
  };

  const getVifColor = (val: number) => {
      if (val > 10) return '#ef4444'; // Red
      if (val > 5) return '#f59e0b'; // Orange
      return '#22c55e'; // Green
  };

  const getCorrelationColor = (value: number) => {
      if (isNaN(value)) return 'bg-slate-100';
      const absVal = Math.abs(value);
      if (value > 0) {
          return `rgba(59, 130, 246, ${absVal})`; // Blue with opacity
      } else {
          return `rgba(239, 68, 68, ${absVal})`; // Red with opacity
      }
  };

  // --- Calculations for Dynamic Insights ---
  const outlierCount = result.predictions.filter(p => Math.abs(p.residual / result.rmse) > 2.5).length;
  const highVifVars = result.coefficients.filter(c => (c.vif || 0) > 5);
  const topCoeffs = [...coefData].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  
  const strongCorrelations: string[] = [];
  if (result.correlationMatrix) {
      const { names, matrix } = result.correlationMatrix;
      matrix.forEach((row, i) => {
          row.forEach((val, j) => {
              if (i < j && Math.abs(val) > 0.7) {
                  strongCorrelations.push(`${names[i]} 与 ${names[j]} (r=${val.toFixed(2)})`);
              }
          })
      })
  }

  return (
    <div className="space-y-8 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Actual vs Predicted */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">预测值 vs 实际值</h3>
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Actual" label={{ value: `实际值 (${targetName})`, position: 'bottom', offset: 0, fontSize: 12 }} tick={{fontSize: 10}} />
                <YAxis type="number" dataKey="y" name="Predicted" label={{ value: '预测值', angle: -90, position: 'left', fontSize: 12 }} tick={{fontSize: 10}} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={TOOLTIP_STYLE} />
                <Scatter name="Observations" data={predVsActualData} fill="#3b82f6" fillOpacity={0.6} />
                </ScatterChart>
            </ResponsiveContainer>
            </div>
            {renderChartInsight("如何解读？", [
                "此图直观展示了模型的预测能力。理想情况下，所有点应紧密地分布在一条 45 度的对角线上。",
                "点越聚拢，R² 越高，预测越准确；点越发散，说明模型未能解释的噪音越多。",
                outlierCount > 0 ? `检测到您的数据中有部分偏离较远的点（可能有 ${outlierCount} 个异常值），这些点可能会拉低模型的准确性。` : "数据点分布相对均匀，没有明显的极端偏离。"
            ], outlierCount > 0 ? 'warning' : 'info')}
        </div>

        {/* Chart 2: Residuals Plot */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    {useStandardized ? '标准化残差' : '残差'} vs 预测值
                </h3>
                <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={useStandardized} onChange={(e) => setUseStandardized(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                    <span className="text-xs text-slate-600 font-medium group-hover:text-blue-600 transition-colors">标准化</span>
                </label>
            </div>
            
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                {useStandardized && (
                    <>
                        <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" />
                        <ReferenceLine y={-2} stroke="#f59e0b" strokeDasharray="3 3" />
                    </>
                )}
                <XAxis type="number" dataKey="x" name="Predicted" label={{ value: '预测值', position: 'bottom', offset: 0, fontSize: 12 }} tick={{fontSize: 10}} />
                <YAxis type="number" dataKey={useStandardized ? "yStd" : "yRaw"} name="Residual" label={{ value: useStandardized ? '标准化残差' : '原始残差', angle: -90, position: 'left', fontSize: 12 }} tick={{fontSize: 10}} />
                <Tooltip content={<CustomResidualsTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Residuals" data={residualsData} fill="#8b5cf6" fillOpacity={0.6} />
                </ScatterChart>
            </ResponsiveContainer>
            </div>
            {renderChartInsight("残差模式诊断", [
                "这是诊断模型最重要的图表。理想的残差应在红线(0)上下随机分布，呈现无规律的“白噪声”状态。",
                "如果呈现 U形/倒U形：说明数据中存在非线性关系，模型未捕捉到（建议：尝试在特征工程中添加“平方项”）。",
                "如果呈现 漏斗形（扩散）：说明存在异方差性，即预测值越大误差越大（建议：对目标变量 Y 取对数）。"
            ], 'tip')}
        </div>

        {/* Chart 3: Normal Q-Q Plot */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Normal Q-Q Plot (正态性)</h3>
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Theoretical" label={{ value: '理论分位数', position: 'bottom', offset: 0, fontSize: 12 }} tick={{fontSize: 10}} />
                <YAxis type="number" dataKey="y" name="Standardized" label={{ value: '标准化残差', angle: -90, position: 'left', fontSize: 12 }} tick={{fontSize: 10}} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={TOOLTIP_STYLE} />
                <Scatter name="Q-Q" data={qqData} fill="#ec4899" fillOpacity={0.6} />
                </ScatterChart>
            </ResponsiveContainer>
            </div>
            {renderChartInsight("正态性检验", [
                "用于检验残差是否服从正态分布。如果所有点大致落在一条直线上，说明假设成立，P值和置信区间是可靠的。",
                "如果两端（尾部）的点明显偏离直线，呈 S 形，说明残差存在“厚尾”现象。这意味着模型在预测极端值时可能会犯比预期更大的错误。"
            ])}
        </div>

        {/* Chart 4: Scale-Location Plot */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Scale-Location (同方差性)</h3>
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Predicted" label={{ value: '预测值', position: 'bottom', offset: 0, fontSize: 12 }} tick={{fontSize: 10}} />
                <YAxis type="number" dataKey="y" name="SqrtResiduals" label={{ value: '√|标准化残差|', angle: -90, position: 'left', fontSize: 12 }} tick={{fontSize: 10}} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={TOOLTIP_STYLE} />
                <Scatter name="Scale-Location" data={scaleLocationData} fill="#f59e0b" fillOpacity={0.6} />
                </ScatterChart>
            </ResponsiveContainer>
            </div>
            {renderChartInsight("方差稳定性", [
                "这是残差图的另一种视角，专门检查误差的大小是否随预测值的变化而变化。",
                "理想情况下，点应在水平方向上均匀分布，没有明显的上升或下降趋势。",
                "如果出现明显的倾斜趋势，说明模型在不同预测范围内的稳定性不一致（异方差性）。"
            ])}
        </div>

        {/* Chart 5: Coefficients Magnitude */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">变量重要性 (系数大小)</h3>
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coefData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{fontSize: 10}} />
                <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 11, fill: '#475569'}} interval={0} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={TOOLTIP_STYLE} />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="value" position="right" formatter={(val: number) => val.toFixed(3)} fontSize={10} />
                </Bar>
                </BarChart>
            </ResponsiveContainer>
            </div>
            {renderChartInsight("关键驱动因素", [
                "此图展示了各变量对结果的平均影响程度（边际效应）。",
                <span>当前模型中，影响绝对值最大的前三个变量是：<strong>{topCoeffs.map(c => c.name).join(', ')}</strong>。</span>,
                "注意：系数大小受数据单位影响（例如“米”和“千米”的系数会差1000倍）。如果您的数据未标准化，请务必结合 t统计量的显著性来综合判断。"
            ], 'tip')}
        </div>

        {/* Chart 6: VIF Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">方差膨胀因子 (VIF - 共线性)</h3>
            <div className="h-80 w-full flex-grow">
                {vifData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vifData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#475569'}} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis type="number" domain={[0, (max: number) => Math.max(max, 12)]} tick={{fontSize: 10}} label={{ value: 'VIF', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={TOOLTIP_STYLE} />
                    <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="5 5" />
                    <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" />
                    <Bar dataKey="vif" radius={[4, 4, 0, 0]}>
                        {vifData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getVifColor(entry.vif || 0)} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">数据不足以计算 VIF</div>
                )}
            </div>
            {renderChartInsight("共线性警报", [
                "VIF 用于检测变量之间是否存在信息冗余。VIF > 5 表示存在中度共线性，VIF > 10 表示严重共线性。",
                highVifVars.length > 0 
                  ? <span><strong>警告：</strong> 变量 {highVifVars.map(v => v.name).join(', ')} 的 VIF 较高。这意味着它们携带的信息被其他变量重复包含了。建议移除其中解释力较弱的一个，以提高模型的稳定性。</span>
                  : "所有变量的 VIF 均处于健康范围，表明变量之间独立性良好，没有明显的共线性问题。",
            ], highVifVars.length > 0 ? 'warning' : 'info')}
        </div>
        
        </div>

        {/* Chart 7: Correlation Matrix - Full Width */}
        {result.correlationMatrix && result.correlationMatrix.names.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">解释变量相关性矩阵 (Correlation Matrix)</h3>
                <div className="w-full overflow-x-auto">
                    <div className="inline-grid gap-1 pb-2" style={{ gridTemplateColumns: `auto repeat(${result.correlationMatrix.names.length}, minmax(60px, 1fr))` }}>
                        <div className="h-32"></div>
                        {result.correlationMatrix.names.map((name, i) => (
                            <div key={`header-${i}`} className="h-32 flex items-end justify-center pb-2 relative">
                                <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap origin-bottom-left -rotate-45 translate-x-5 translate-y-1" title={name}>{name.length > 15 ? name.substring(0, 15) + '...' : name}</span>
                            </div>
                        ))}
                        {result.correlationMatrix.matrix.map((row, i) => (
                            <React.Fragment key={`row-${i}`}>
                                <div className="flex items-center justify-end pr-2 h-12">
                                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]" title={result.correlationMatrix!.names[i]}>{result.correlationMatrix!.names[i]}</span>
                                </div>
                                {row.map((val, j) => (
                                    <div key={`cell-${i}-${j}`} className="h-12 w-full flex items-center justify-center text-[10px] font-mono text-slate-700 rounded hover:ring-2 hover:ring-slate-400 relative group transition-colors" style={{ backgroundColor: getCorrelationColor(val) }}>
                                        <span className={`${Math.abs(val) > 0.5 ? 'text-white font-bold' : ''}`}>{isNaN(val) ? '-' : val.toFixed(2)}</span>
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                {renderChartInsight("相关性分析", [
                    "深色区域表示两个自变量之间存在强相关性。强相关的自变量会导致系数估计不稳定（标准误增大），即 VIF 升高的直接原因。",
                    strongCorrelations.length > 0 
                        ? <span><strong>注意：</strong> 检测到以下变量对存在强相关 (&gt;0.7)：{strongCorrelations.slice(0, 3).join('; ')}{strongCorrelations.length > 3 && ' 等'}。这可能会导致模型难以区分它们各自的独立影响。</span>
                        : "自变量之间相关性较低，这是一个好的信号，说明每个变量都提供了独特的信息。"
                ], strongCorrelations.length > 0 ? 'warning' : 'info')}
            </div>
        )}

        {/* Chart 8: Categorical Analysis */}
        {categoricalCharts.length > 0 && categoricalCharts.map((catChart) => (
            <div key={catChart.varName} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">分类透视: {catChart.varName} vs {targetName}</h3>
                </div>
                
                {/* Visual Insight Text */}
                {getCategoryInsight(catChart.data, catChart.varName)}

                <div className="h-80 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={catChart.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#475569'}} interval={0} tickLine={false} />
                            <YAxis type="number" tick={{fontSize: 10}} label={{ value: targetName, angle: -90, position: 'insideLeft', fontSize: 10 }} />
                            <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="rangeFull" barSize={2} fill="#94a3b8" radius={[2, 2, 2, 2]} />
                            <Bar dataKey="rangeBox" barSize={30} fill="#60a5fa" fillOpacity={0.7} radius={[2, 2, 2, 2]} />
                            <Scatter dataKey="median" fill="#1e3a8a" shape="circle" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Model Impact Analysis */}
                {renderCategoryImpact(catChart.varName, catChart.data)}
            </div>
        ))}

        {/* Chart 9: Robustness Check - Full Width Row */}
        {robustnessData.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">系数稳定性检验 (Bootstrap Robustness)</h3>
                <p className="text-xs text-slate-400 mb-4">误差条表示 95% 置信区间 (Bootstrap 重采样)</p>
                <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart layout="vertical" data={robustnessData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" tick={{fontSize: 10}} />
                        <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 11, fill: '#475569'}} interval={0} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={TOOLTIP_STYLE} />
                        <ReferenceLine x={0} stroke="#94a3b8" />
                        <Bar dataKey="original" barSize={20} fill="#8b5cf6" fillOpacity={0.6}>
                            <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke="#4c1d95" direction="x" />
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
                {renderChartInsight("模型稳健性", [
                    "此图通过 Bootstrap 技术（反复重采样）来模拟模型在不同数据子集下的表现。",
                    "稳定性：如果误差条（紫色横线）很短，说明该变量的影响非常稳定，不受特定样本点的干扰。",
                    "可靠性：如果误差条跨越了 0 轴（即同时包含正值和负值），说明在某些情况下该变量可能没有影响，其统计显著性存疑。"
                ], 'tip')}
            </div>
        )}
    </div>
  );
};

export default RegressionCharts;