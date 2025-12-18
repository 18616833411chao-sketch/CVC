import React, { useState } from 'react';
import DataUploader from './components/DataUploader';
import VariableSelector from './components/VariableSelector';
import ResultsView from './components/ResultsView';
import { AppState, DataRow, VariableConfig, RegressionResult, ModelHistoryEntry } from './types';
import { performRegression } from './utils/math';
import { Activity, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<AppState>(AppState.UPLOAD);
  const [data, setData] = useState<DataRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [targetVar, setTargetVar] = useState<string>('');
  const [regressionResult, setRegressionResult] = useState<RegressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<ModelHistoryEntry[]>([]);

  const handleDataLoaded = (loadedData: DataRow[], loadedHeaders: string[]) => {
    setData(loadedData);
    setHeaders(loadedHeaders);
    setCurrentState(AppState.CONFIG);
    setError(null);
  };

  const handleConfigComplete = (
    target: string, 
    features: VariableConfig[], 
    filteredData: DataRow[], 
    targetLogTransform: boolean,
    targetLogPlusOne: boolean
  ) => {
    try {
      setError(null);
      setTargetVar(target);
      // Use the filtered data passed from VariableSelector
      const result = performRegression(filteredData, target, features, targetLogTransform, targetLogPlusOne);
      setRegressionResult(result);
      
      // Save to History
      const newHistoryItem: ModelHistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        target,
        features,
        targetLogTransform,
        targetLogPlusOne,
        metrics: {
          r2: result.r2,
          adjustedR2: result.adjustedR2,
          rmse: result.rmse,
          observations: result.observations
        }
      };
      setHistory(prev => [newHistoryItem, ...prev]);

      setCurrentState(AppState.RESULTS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || "计算过程中发生了意外错误。");
      // Scroll to top to ensure user sees the error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    setData([]);
    setHeaders([]);
    setTargetVar('');
    setRegressionResult(null);
    setError(null);
    // history is kept unless explicitly cleared by user or new import
    setCurrentState(AppState.UPLOAD);
  };

  const handleBackToConfig = () => {
    setError(null);
    setRegressionResult(null); // Clear previous result to ensure clean state
    setCurrentState(AppState.CONFIG);
  };

  const handleImportHistory = (importedHistory: ModelHistoryEntry[]) => {
      setHistory(importedHistory);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Activity size={24} />
              </div>
              <span className="font-bold text-xl text-slate-800 tracking-tight">LinearInsight AI</span>
            </div>
            <div className="flex items-center">
              <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-500">
                v1.2.2
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow bg-slate-50 p-4 md:p-8">
        {error && (
            <div className="max-w-4xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 animate-fadeIn shadow-sm">
                <AlertTriangle size={24} className="shrink-0" />
                <span className="font-medium">{error}</span>
            </div>
        )}

        {currentState === AppState.UPLOAD && (
          <div className="animate-fadeIn">
            <div className="text-center mb-10 mt-10">
              <h1 className="text-4xl font-bold text-slate-900 mb-4">轻松进行多元线性回归分析</h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                上传您的数据集，选择变量，即可获得即时统计模型和 AI 智能分析。无需编程。
              </p>
            </div>
            <DataUploader onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {currentState === AppState.CONFIG && (
          <div className="animate-fadeIn mt-6">
             <VariableSelector 
               data={data}
               headers={headers} 
               history={history}
               onConfigComplete={handleConfigComplete} 
               onBack={handleReset}
               onImportHistory={handleImportHistory}
             />
          </div>
        )}

        {currentState === AppState.RESULTS && regressionResult && (
          <div className="animate-fadeIn mt-2">
            <ResultsView 
              result={regressionResult} 
              targetName={targetVar} 
              onBackToConfig={handleBackToConfig}
              onUploadNew={handleReset}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} LinearInsight AI. 由 React, Tailwind & Gemini 提供支持。</p>
        </div>
      </footer>
    </div>
  );
};

export default App;