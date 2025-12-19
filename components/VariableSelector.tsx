import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { VariableConfig, DataRow, ModelHistoryEntry } from '../types';
import { Settings2, ArrowRight, Trash2, Wand2, Calculator, AlertCircle, CheckSquare, Square, X, ChevronLeft, ChevronRight, Plus, FlaskConical, Copy, FilterX, History, Clock, ArrowUpRight, Download, Upload, FileDown } from 'lucide-react';

interface Props {
  data: DataRow[];
  headers: string[];
  history: ModelHistoryEntry[];
  onConfigComplete: (target: string, features: VariableConfig[], selectedData: DataRow[], targetLogTransform: boolean, targetLogPlusOne: boolean) => void;
  onBack: () => void;
  onImportHistory: (history: ModelHistoryEntry[]) => void;
  suggestedConfig?: ModelHistoryEntry | null; // New prop
  onSuggestionLoaded?: () => void; // Callback to clear the suggestion
}

const ROWS_PER_PAGE = 20;

const VariableSelector: React.FC<Props> = ({ 
    data, headers, history, onConfigComplete, onBack, onImportHistory,
    suggestedConfig, onSuggestionLoaded 
}) => {
  // Data State (Augmented allows adding new columns)
  const [localData, setLocalData] = useState<DataRow[]>([]);
  const [localHeaders, setLocalHeaders] = useState<string[]>([]);

  const [target, setTarget] = useState<string>('');
  const [targetLog, setTargetLog] = useState<boolean>(false);
  const [targetLogPlusOne, setTargetLogPlusOne] = useState<boolean>(false);
  
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [catVars, setCatVars] = useState<Set<string>>(new Set());
  const [logVars, setLogVars] = useState<Set<string>>(new Set());
  const [logPlusOneVars, setLogPlusOneVars] = useState<Set<string>>(new Set());

  // Feature Engineering State
  const [feVar1, setFeVar1] = useState<string>('');
  const [feVar2, setFeVar2] = useState<string>('');
  const [feType, setFeType] = useState<'interaction' | 'squared'>('interaction');
  
  // Feature Engineering Transformation Options
  const [feVar1Log, setFeVar1Log] = useState(false);
  const [feVar1PlusOne, setFeVar1PlusOne] = useState(false);
  const [feVar2Log, setFeVar2Log] = useState(false);
  const [feVar2PlusOne, setFeVar2PlusOne] = useState(false);

  // Row selection state (indices)
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [outlierMessage, setOutlierMessage] = useState<string | null>(null);

  // Outlier Modal State
  const [showOutlierModal, setShowOutlierModal] = useState(false);
  const [outlierCols, setOutlierCols] = useState<Set<string>>(new Set());
  const [zScoreThreshold, setZScoreThreshold] = useState<number>(3);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Validation Error
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize Data
  useEffect(() => {
    if (data.length > 0 && localData.length === 0) {
        setLocalData(data);
        setLocalHeaders(headers);
        setSelectedRowIndices(new Set(data.map((_, i) => i)));
    }
  }, [data, headers]);

  // Handle Suggested Configuration Auto-Load
  useEffect(() => {
      if (suggestedConfig && localData.length > 0) {
          // Use a small timeout to ensure data is ready
          const timer = setTimeout(() => {
              handleRestoreHistory(suggestedConfig);
              if (onSuggestionLoaded) onSuggestionLoaded();
          }, 100);
          return () => clearTimeout(timer);
      }
  }, [suggestedConfig, localData]);

  // Auto-select logic
  useEffect(() => {
    if (localHeaders.length > 0 && !target) {
      // Priority: "投资回报率" > "投资收益率" > Last Column
      const preferredTarget = localHeaders.find(h => h === "投资回报率") || 
                              localHeaders.find(h => h.includes("投资回报率")) || 
                              localHeaders.find(h => h.includes("投资收益率")) || 
                              localHeaders[localHeaders.length - 1];
      setTarget(preferredTarget);
      
      const newFeatures = new Set(localHeaders.filter(h => h !== preferredTarget));
      setFeatures(newFeatures);
    }
  }, [localHeaders]);

  const toggleFeature = (header: string) => {
    const newFeatures = new Set(features);
    if (newFeatures.has(header)) {
      newFeatures.delete(header);
      // Clean up other sets
      const newCat = new Set(catVars); newCat.delete(header); setCatVars(newCat);
      const newLog = new Set(logVars); newLog.delete(header); setLogVars(newLog);
      const newLogPlusOne = new Set(logPlusOneVars); newLogPlusOne.delete(header); setLogPlusOneVars(newLogPlusOne);
    } else {
      newFeatures.add(header);
    }
    setFeatures(newFeatures);
  };

  const toggleCategory = (header: string) => {
    const newCat = new Set(catVars);
    const newLog = new Set(logVars);
    const newLogPlusOne = new Set(logPlusOneVars);
    
    if (newCat.has(header)) {
      newCat.delete(header);
    } else {
      newCat.add(header);
      // Logic: Categorical cannot be Log transformed usually
      if (newLog.has(header)) {
        newLog.delete(header);
        setLogVars(newLog);
      }
      if (newLogPlusOne.has(header)) {
        newLogPlusOne.delete(header);
        setLogPlusOneVars(newLogPlusOne);
      }
    }
    setCatVars(newCat);
  };

  const toggleLog = (header: string) => {
    const newLog = new Set(logVars);
    const newLogPlusOne = new Set(logPlusOneVars);
    
    if (newLog.has(header)) {
      newLog.delete(header);
      // If turning off log, also turn off +1
      if (newLogPlusOne.has(header)) {
        newLogPlusOne.delete(header);
        setLogPlusOneVars(newLogPlusOne);
      }
    } else {
      newLog.add(header);
    }
    setLogVars(newLog);
  };

  const toggleLogPlusOne = (header: string) => {
      const newLogPlusOne = new Set(logPlusOneVars);
      if (newLogPlusOne.has(header)) {
          newLogPlusOne.delete(header);
      } else {
          newLogPlusOne.add(header);
      }
      setLogPlusOneVars(newLogPlusOne);
  };

  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRowIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRowIndices(newSelected);
  };

  const toggleAllRows = () => {
    if (selectedRowIndices.size === localData.length) {
      setSelectedRowIndices(new Set()); // Deselect all
    } else {
      setSelectedRowIndices(new Set(localData.map((_, i) => i))); // Select all
    }
  };

  // --- Feature Engineering Logic ---
  const handleAddFeature = () => {
      if (!feVar1) return;
      
      // Helper to calculate transformed value
      const getTransformedVal = (val: any, isLog: boolean, isPlusOne: boolean) => {
          let num = Number(val);
          if (isNaN(num)) return NaN;
          
          if (isPlusOne) num += 1;
          if (isLog) {
              if (num <= 0) return NaN; // Log invalid
              num = Math.log(num);
          }
          return num;
      };

      // Helper to generate name part
      const getNamePart = (name: string, isLog: boolean, isPlusOne: boolean) => {
          let prefix = "";
          if (isLog) prefix = isPlusOne ? "ln1p" : "ln";
          else if (isPlusOne) prefix = "plus1";
          
          return prefix ? `${prefix}(${name})` : name;
      };

      const name1 = getNamePart(feVar1, feVar1Log, feVar1PlusOne);
      let newColName = '';
      let newData: DataRow[] = [];

      if (feType === 'squared') {
          newColName = `${name1}^2`;
          newData = localData.map(row => {
              const val1 = getTransformedVal(row[feVar1], feVar1Log, feVar1PlusOne);
              return {
                ...row,
                [newColName]: isNaN(val1) ? null : val1 * val1
              };
          });
      } else {
          if (!feVar2) return;
          const name2 = getNamePart(feVar2, feVar2Log, feVar2PlusOne);
          newColName = `${name1}_x_${name2}`;
          
          newData = localData.map(row => {
              const val1 = getTransformedVal(row[feVar1], feVar1Log, feVar1PlusOne);
              const val2 = getTransformedVal(row[feVar2], feVar2Log, feVar2PlusOne);
              return {
                  ...row,
                  [newColName]: (isNaN(val1) || isNaN(val2)) ? null : val1 * val2
              };
          });
      }

      if (localHeaders.includes(newColName)) {
          alert("该变量已存在！");
          return;
      }

      setLocalData(newData);
      setLocalHeaders([...localHeaders, newColName]);
      
      // Auto select as feature
      const newFeatures = new Set(features);
      newFeatures.add(newColName);
      setFeatures(newFeatures);

      // Reset selection but keep type for convenience
      setFeVar1('');
      setFeVar2('');
      setFeVar1Log(false);
      setFeVar1PlusOne(false);
      setFeVar2Log(false);
      setFeVar2PlusOne(false);
  };

  // --- Outlier Logic ---
  const openOutlierModal = () => {
      // By default, select all numeric features + target
      const candidates = new Set<string>();
      if (target && !catVars.has(target)) candidates.add(target);
      features.forEach(f => {
          if (!catVars.has(f)) candidates.add(f);
      });
      setOutlierCols(candidates);
      setZScoreThreshold(3); // Default to 3
      setShowOutlierModal(true);
  };

  const toggleOutlierCol = (header: string) => {
      const newCols = new Set(outlierCols);
      if (newCols.has(header)) newCols.delete(header);
      else newCols.add(header);
      setOutlierCols(newCols);
  };

  // Smart Outlier Detection (Z-Score > Threshold)
  const handleSmartDetect = () => {
    const newSelected = new Set(selectedRowIndices);
    let outlierCount = 0;

    outlierCols.forEach(col => {
        // Calculate Mean and StdDev for this column based on ALL data
        const values = localData
            .map(r => Number(r[col]))
            .filter(v => !isNaN(v));
        
        if (values.length === 0) return;

        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return;

        // Check each row
        localData.forEach((row, idx) => {
            const val = Number(row[col]);
            if (!isNaN(val)) {
                const zScore = Math.abs((val - mean) / stdDev);
                if (zScore > zScoreThreshold) {
                    if (newSelected.has(idx)) {
                        newSelected.delete(idx);
                        outlierCount++;
                    }
                }
            }
        });
    });

    setSelectedRowIndices(newSelected);
    setShowOutlierModal(false);
    setOutlierMessage(outlierCount > 0 
        ? `基于选中列，已自动取消勾选 ${outlierCount} 个异常值 (Z-Score > ${zScoreThreshold})。` 
        : `在选中列中未检测到明显的极端异常值 (Z-Score > ${zScoreThreshold})。`);
    
    setTimeout(() => setOutlierMessage(null), 5000);
  };

  // Remove Duplicates Logic
  const handleRemoveDuplicates = () => {
      const seenSignatures = new Set<string>();
      const newSelected = new Set(selectedRowIndices);
      let duplicateCount = 0;

      localData.forEach((row, idx) => {
          if (newSelected.has(idx)) {
              // Create a signature based on all column values
              const signature = JSON.stringify(localHeaders.map(h => row[h]));
              
              if (seenSignatures.has(signature)) {
                  // Duplicate found, deselect it
                  newSelected.delete(idx);
                  duplicateCount++;
              } else {
                  seenSignatures.add(signature);
              }
          }
      });

      setSelectedRowIndices(newSelected);
      setOutlierMessage(duplicateCount > 0
          ? `成功去重：已自动取消勾选 ${duplicateCount} 条重复数据（保留首条）。`
          : "当前选中数据中未发现完全重复的行。");
      
      setTimeout(() => setOutlierMessage(null), 5000);
  };

  // Clean Dirty Data Logic (Remove rows with non-numeric values in numeric columns)
  const handleCleanDirtyData = () => {
    const newSelected = new Set(selectedRowIndices);
    let dirtyCount = 0;

    // Identify numeric columns: Target (if not cat) and Features (if not cat)
    const numericCols = new Set<string>();
    if (target && !catVars.has(target)) numericCols.add(target);
    features.forEach(f => {
      if (!catVars.has(f)) numericCols.add(f);
    });

    if (numericCols.size === 0) {
      setOutlierMessage("当前未选择任何数值型变量，无需清洗（分类变量已跳过检查）。");
      setTimeout(() => setOutlierMessage(null), 3000);
      return;
    }

    localData.forEach((row, idx) => {
      if (newSelected.has(idx)) {
        let isDirty = false;
        for (const col of numericCols) {
          const val = row[col];
          // Check for empty strings, null, undefined, or NaN after conversion
          if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
            isDirty = true;
            break;
          }
        }
        if (isDirty) {
          newSelected.delete(idx);
          dirtyCount++;
        }
      }
    });

    setSelectedRowIndices(newSelected);
    setOutlierMessage(dirtyCount > 0 
      ? `清理完成：已自动取消勾选 ${dirtyCount} 条包含非数字内容或空值的记录（仅针对数值变量）。` 
      : "在选定的数值变量中未发现脏数据（分类变量已跳过检查）。");
    
    setTimeout(() => setOutlierMessage(null), 5000);
  };

  // Download Data Logic
  const handleDownloadData = () => {
    if (selectedRowIndices.size === 0) {
        alert("没有选中的数据可供下载。");
        return;
    }

    const exportData = localData
        .filter((_, idx) => selectedRowIndices.has(idx))
        .map(row => {
            const newRow: any = {};
            localHeaders.forEach(h => {
                newRow[h] = row[h];
            });
            return newRow;
        });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CleanedData");
    XLSX.writeFile(wb, `linear_insight_data_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleClearAll = () => {
    setTarget('');
    setFeatures(new Set());
    setCatVars(new Set());
    setLogVars(new Set());
    setLogPlusOneVars(new Set());
    setTargetLog(false);
    setTargetLogPlusOne(false);
    setValidationError(null);
    // Reset Data to original
    setLocalData(data);
    setLocalHeaders(headers);
  };

  // History Restoration
  const handleRestoreHistory = (entry: ModelHistoryEntry) => {
      let restoredData = [...localData];
      let restoredHeaders = [...localHeaders];
      
      // Helper to parse term
      const parseTerm = (term: string) => {
          if (term.startsWith('ln1p(') && term.endsWith(')')) return { name: term.slice(5, -1), log: true, plus1: true };
          if (term.startsWith('ln(') && term.endsWith(')')) return { name: term.slice(3, -1), log: true, plus1: false };
          if (term.startsWith('plus1(') && term.endsWith(')')) return { name: term.slice(6, -1), log: false, plus1: true };
          return { name: term, log: false, plus1: false };
      };

      // Helper to compute value
      const computeVal = (row: DataRow, def: {name: string, log: boolean, plus1: boolean}) => {
           let val = Number(row[def.name]);
           if (isNaN(val)) return NaN;
           if (def.plus1) val += 1;
           if (def.log) {
               if (val <= 0) return NaN;
               val = Math.log(val);
           }
           return val;
      };

      // Identify required columns from history (features + target)
      const requiredCols = new Set<string>();
      entry.features.forEach(f => requiredCols.add(f.name));
      if (entry.target) requiredCols.add(entry.target);

      // Iterative reconstruction
      let missingCols = Array.from(requiredCols).filter(c => !restoredHeaders.includes(c));
      let changed = true;
      let iterations = 0;

      while (changed && missingCols.length > 0 && iterations < 5) {
          changed = false;
          const stillMissing: string[] = [];

          for (const col of missingCols) {
              let reconstructed = false;

              // 1. Try Squared: "term^2"
              if (col.endsWith('^2')) {
                  const base = col.slice(0, -2);
                  const def = parseTerm(base);
                  if (restoredHeaders.includes(def.name)) {
                      restoredData = restoredData.map(row => {
                          const v = computeVal(row, def);
                          return { ...row, [col]: isNaN(v) ? null : v * v };
                      });
                      restoredHeaders.push(col);
                      reconstructed = true;
                  }
              }
              
              // 2. Try Interaction: "term1_x_term2"
              if (!reconstructed && col.includes('_x_')) {
                   // Heuristic: iterate possible split points of `_x_` to find parents
                   const splitIndices: number[] = [];
                   let idx = col.indexOf('_x_');
                   while (idx !== -1) {
                       splitIndices.push(idx);
                       idx = col.indexOf('_x_', idx + 1);
                   }
                   
                   for (const splitIdx of splitIndices) {
                       const leftRaw = col.substring(0, splitIdx);
                       const rightRaw = col.substring(splitIdx + 3);
                       
                       const def1 = parseTerm(leftRaw);
                       const def2 = parseTerm(rightRaw);
                       
                       if (restoredHeaders.includes(def1.name) && restoredHeaders.includes(def2.name)) {
                           restoredData = restoredData.map(row => {
                              const v1 = computeVal(row, def1);
                              const v2 = computeVal(row, def2);
                              return { ...row, [col]: (isNaN(v1) || isNaN(v2)) ? null : v1 * v2 };
                           });
                           restoredHeaders.push(col);
                           reconstructed = true;
                           break; // Found the parents
                       }
                   }
              }

              if (reconstructed) {
                  changed = true;
              } else {
                  stillMissing.push(col);
              }
          }
          missingCols = stillMissing;
          iterations++;
      }
      
      // Update data state
      setLocalData(restoredData);
      setLocalHeaders(restoredHeaders);

      // Now proceed with variable selection logic
      // 1. Restore Target
      setTarget(entry.target);
      setTargetLog(entry.targetLogTransform);
      setTargetLogPlusOne(entry.targetLogPlusOne);

      // 2. Restore Features
      const newFeatures = new Set<string>();
      const newCatVars = new Set<string>();
      const newLogVars = new Set<string>();
      const newLogPlusOneVars = new Set<string>();
      const missingVars: string[] = [];

      entry.features.forEach(f => {
          if (restoredHeaders.includes(f.name)) { // Check against updated headers
              newFeatures.add(f.name);
              if (f.type === 'categorical') newCatVars.add(f.name);
              if (f.logTransform) newLogVars.add(f.name);
              if (f.logPlusOne) newLogPlusOneVars.add(f.name);
          } else {
              missingVars.push(f.name);
          }
      });

      setFeatures(newFeatures);
      setCatVars(newCatVars);
      setLogVars(newLogVars);
      setLogPlusOneVars(newLogPlusOneVars);
      
      setShowHistoryModal(false);
      setValidationError(null);

      // Only show message if it's not a programmatic auto-load (optional refinement, but keep simple for now)
      if (missingVars.length > 0) {
          setOutlierMessage(`恢复部分完成。以下变量无法重建（可能缺少基础数据）：${missingVars.join(', ')}`);
          setTimeout(() => setOutlierMessage(null), 6000);
      } else {
          setOutlierMessage("已成功加载模型配置。");
          setTimeout(() => setOutlierMessage(null), 3000);
      }
  };

  // Export History Logic
  const handleExportHistory = () => {
      if (history.length === 0) {
          alert("暂无历史记录可导出。");
          return;
      }
      const dataStr = JSON.stringify(history, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `linear_insight_history_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // Import History Logic
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              const json = JSON.parse(content);
              
              // Basic validation: must be an array
              if (Array.isArray(json)) {
                  // Pass to App to overwrite history
                  onImportHistory(json);
                  alert(`成功导入 ${json.length} 条历史配置记录。`);
                  // Keep modal open to show new data
              } else {
                  alert("导入失败：文件格式错误，内容必须是历史记录列表。");
              }
          } catch (err) {
              console.error(err);
              alert("导入失败：无法解析 JSON 文件。");
          }
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again
      e.target.value = '';
  };

  const handleRun = () => {
    setValidationError(null);

    // 1. Pre-validation: Check for non-numeric data in numeric fields
    const numericFields: string[] = Array.from<string>(features).filter(f => !catVars.has(f));
    if (!catVars.has(target)) numericFields.push(target);

    // Check first 20 selected rows for obvious type mismatch
    const rowsToCheck = localData.filter((_, i) => selectedRowIndices.has(i)).slice(0, 20);
    
    for (const field of numericFields) {
        const hasBadData = rowsToCheck.some(row => {
            const val = row[field as string];
            return val !== null && val !== '' && isNaN(Number(val));
        });
        
        if (hasBadData) {
            setValidationError(`错误：列 "${field}" 被配置为数值变量，但包含文本数据。请将其设为“分类变量”或使用“去除脏数据”功能。`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }

    // Filter data based on selection
    const filteredData = localData.filter((_, idx) => selectedRowIndices.has(idx));

    if (filteredData.length < 2) {
        setValidationError("选中的数据行太少，无法运行回归分析。");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const featureConfigs: VariableConfig[] = Array.from(features).map((name: string) => ({
      name,
      type: catVars.has(name) ? 'categorical' : 'numeric',
      role: 'feature',
      logTransform: logVars.has(name),
      logPlusOne: logPlusOneVars.has(name)
    }));
    
    onConfigComplete(target, featureConfigs, filteredData, targetLog, targetLogPlusOne);
  };

  // Pagination Logic
  const totalPages = Math.ceil(localData.length / ROWS_PER_PAGE);
  const currentDataSlice = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return localData.slice(start, start + ROWS_PER_PAGE).map((row, idx) => ({ ...row, originalIndex: start + idx }));
  }, [localData, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
        setCurrentPage(newPage);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 relative">
      
      {/* Validation Error Banner inside component */}
      {validationError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 animate-fadeIn">
              <AlertCircle size={20} className="shrink-0"/>
              <span className="font-medium">{validationError}</span>
          </div>
      )}

      {/* Configuration Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <Settings2 className="text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800">模型变量配置</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors font-medium border border-slate-200"
            >
                <History size={16} />
                历史模型
                {history.length > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full">{history.length}</span>}
            </button>
            <button 
                onClick={handleClearAll}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
                <Trash2 size={16} />
                重置配置
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Target Selection */}
          <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              目标变量 (Y)
              <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">仅限数值</span>
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {localHeaders.map(h => {
                  const isSelected = target === h;
                  return (
                  <div key={`target-${h}`} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                    <label className="flex items-center gap-3 cursor-pointer flex-grow">
                        <input 
                        type="radio" 
                        name="target" 
                        checked={isSelected}
                        onChange={() => {
                            setTarget(h);
                            if (features.has(h)) toggleFeature(h);
                        }}
                        className="w-4 h-4 text-blue-600 accent-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-700">{h}</span>
                    </label>
                    {isSelected && (
                         <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1" title="应用自然对数 (Ln)">
                                <span className="text-xs text-slate-500">Ln?</span>
                                <input 
                                    type="checkbox" 
                                    checked={targetLog}
                                    onChange={() => {
                                        setTargetLog(!targetLog);
                                        if (targetLog) setTargetLogPlusOne(false); // Reset +1 if turning off log
                                    }}
                                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                             </div>
                             {targetLog && (
                                 <div className="flex items-center gap-1 animate-fadeIn" title="使用 Ln(y+1) 以处理零值">
                                    <span className="text-xs text-slate-500">+1?</span>
                                    <input 
                                        type="checkbox" 
                                        checked={targetLogPlusOne}
                                        onChange={() => setTargetLogPlusOne(!targetLogPlusOne)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </div>
                             )}
                         </div>
                    )}
                  </div>
                )})}
            </div>
          </div>

          {/* Feature Selection */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center justify-between">
              <span>特征变量 (X)</span>
              <span className="text-xs text-slate-500">已选 {features.size} 个</span>
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 text-xs font-semibold text-slate-500 uppercase tracking-wider gap-2">
                <div className="col-span-6">变量名称</div>
                <div className="col-span-3 text-center">分类变量?</div>
                <div className="col-span-3 text-center">对数处理?</div>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100 bg-white">
                {localHeaders.filter(h => h !== target).map(h => {
                  const isSelected = features.has(h);
                  const isCat = catVars.has(h);
                  const isLog = logVars.has(h);
                  const isLogPlusOne = logPlusOneVars.has(h);
                  const isCreated = !headers.includes(h);
                  
                  return (
                    <div key={`feat-${h}`} className={`grid grid-cols-12 px-4 py-3 items-center hover:bg-slate-50 transition-colors gap-2 ${isSelected ? 'bg-blue-50/30' : ''}`}>
                      <div className="col-span-6 flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFeature(h)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                          />
                          <span className={`text-sm truncate ${isSelected ? 'text-slate-800 font-medium' : 'text-slate-400'}`} title={h}>
                              {h}
                              {isCreated && <span className="ml-2 text-[10px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded">New</span>}
                          </span>
                      </div>
                      <div className="col-span-3 flex justify-center">
                          <button 
                            onClick={() => isSelected && toggleCategory(h)}
                            disabled={!isSelected}
                            className={`text-xs px-2 py-1 rounded transition-colors border
                              ${!isSelected ? 'opacity-30 cursor-not-allowed border-transparent text-slate-300' : 
                                isCat ? 'bg-purple-100 text-purple-700 border-purple-200 font-medium' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}
                            `}
                          >
                            {isCat ? '是' : '否'}
                          </button>
                      </div>
                      <div className="col-span-3 flex justify-center items-center gap-1">
                          <button 
                            onClick={() => isSelected && toggleLog(h)}
                            disabled={!isSelected || isCat}
                            className={`text-xs px-2 py-1 rounded transition-colors border
                              ${!isSelected || isCat ? 'opacity-30 cursor-not-allowed border-transparent text-slate-300' : 
                                isLog ? 'bg-indigo-100 text-indigo-700 border-indigo-200 font-medium' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}
                            `}
                            title={isCat ? "分类变量无法进行对数处理" : "应用自然对数 (Ln)"}
                          >
                            Ln
                          </button>
                          
                          {isLog && (
                              <button 
                                onClick={() => toggleLogPlusOne(h)}
                                className={`text-[10px] px-1.5 py-1 rounded transition-colors border font-bold
                                  ${isLogPlusOne ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-200'}
                                `}
                                title="应用 Ln(x+1) 以处理零值"
                              >
                                +1
                              </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Engineering Section */}
        <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FlaskConical className="text-purple-600" size={20} />
                特征工程 (Feature Engineering)
                <span className="text-xs font-normal text-slate-400">通过创建组合变量来提高模型拟合度 (R²) - 变换基于原始数据独立计算</span>
            </h3>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 flex flex-wrap items-end gap-3">
                 <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-purple-800 mb-1">操作类型</label>
                    <select 
                        value={feType}
                        onChange={(e) => setFeType(e.target.value as any)}
                        className="w-full text-sm border-purple-200 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white"
                    >
                        <option value="interaction">交互项 (Interaction: A × B)</option>
                        <option value="squared">平方项 (Squared: A²)</option>
                    </select>
                 </div>
                 
                 <div className="flex-[1.5] min-w-[220px]">
                    <label className="block text-xs font-medium text-purple-800 mb-1">变量 A</label>
                    <div className="flex items-center gap-2">
                      <select 
                          value={feVar1}
                          onChange={(e) => setFeVar1(e.target.value)}
                          className="flex-grow text-sm border-purple-200 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white"
                      >
                          <option value="">选择变量...</option>
                          {localHeaders.filter(h => h !== target && !catVars.has(h)).map(h => (
                              <option key={h} value={h}>{h}</option>
                          ))}
                      </select>
                      <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded border border-purple-100">
                         <label className="flex items-center gap-1 cursor-pointer" title="应用对数">
                            <input type="checkbox" checked={feVar1Log} onChange={e => setFeVar1Log(e.target.checked)} className="rounded text-purple-600 w-3.5 h-3.5" />
                            <span className="text-[10px] text-purple-700 font-bold">Ln</span>
                         </label>
                         <label className="flex items-center gap-1 cursor-pointer" title="加 1 (常用于处理0值)">
                            <input type="checkbox" checked={feVar1PlusOne} onChange={e => setFeVar1PlusOne(e.target.checked)} className="rounded text-purple-600 w-3.5 h-3.5" />
                            <span className="text-[10px] text-purple-700 font-bold">+1</span>
                         </label>
                      </div>
                    </div>
                 </div>

                 {feType === 'interaction' && (
                     <>
                        <div className="flex items-center pb-2 text-purple-400">
                            <X size={16} />
                        </div>
                        <div className="flex-[1.5] min-w-[220px]">
                            <label className="block text-xs font-medium text-purple-800 mb-1">变量 B</label>
                            <div className="flex items-center gap-2">
                                <select 
                                    value={feVar2}
                                    onChange={(e) => setFeVar2(e.target.value)}
                                    className="flex-grow text-sm border-purple-200 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white"
                                >
                                    <option value="">选择变量...</option>
                                    {localHeaders.filter(h => h !== target && !catVars.has(h)).map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded border border-purple-100">
                                  <label className="flex items-center gap-1 cursor-pointer" title="应用对数">
                                      <input type="checkbox" checked={feVar2Log} onChange={e => setFeVar2Log(e.target.checked)} className="rounded text-purple-600 w-3.5 h-3.5" />
                                      <span className="text-[10px] text-purple-700 font-bold">Ln</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer" title="加 1 (常用于处理0值)">
                                      <input type="checkbox" checked={feVar2PlusOne} onChange={e => setFeVar2PlusOne(e.target.checked)} className="rounded text-purple-600 w-3.5 h-3.5" />
                                      <span className="text-[10px] text-purple-700 font-bold">+1</span>
                                  </label>
                                </div>
                            </div>
                        </div>
                     </>
                 )}

                 <button 
                    onClick={handleAddFeature}
                    disabled={!feVar1 || (feType === 'interaction' && !feVar2)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    生成新特征
                 </button>
            </div>
            <p className="text-xs text-purple-500 mt-2">
                提示: 交互项有助于捕捉两个变量共同作用的效果，平方项有助于捕捉非线性关系。
            </p>
        </div>
      </div>

      {/* Data Table & Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="flex items-center gap-2">
            <CheckSquare size={20} className="text-blue-600" />
            <span className="font-medium text-slate-700">数据选择与清洗</span>
            <span className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                已选 {selectedRowIndices.size} / {localData.length}
            </span>
           </div>
           
           <div className="flex items-center gap-2">
               {outlierMessage && (
                   <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded animate-pulse">
                       {outlierMessage}
                   </span>
               )}
               <button 
                onClick={handleDownloadData}
                className="flex items-center gap-1 text-xs bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-200 hover:border-emerald-300 px-3 py-1.5 rounded transition-colors shadow-sm"
                title="导出当前选中的数据（包含生成的特征）为 Excel"
               >
                   <FileDown size={16} />
                   导出表格
               </button>
               <button 
                onClick={handleRemoveDuplicates}
                className="flex items-center gap-1 text-xs bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded transition-colors shadow-sm"
                title="保留唯一数据行，去除重复项"
               >
                   <Copy size={16} />
                   去除重复项
               </button>
               <button 
                onClick={handleCleanDirtyData}
                className="flex items-center gap-1 text-xs bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded transition-colors shadow-sm"
                title="去除选定数值列中包含非数字、空值的行"
               >
                   <FilterX size={16} />
                   去除脏数据
               </button>
               <button 
                onClick={openOutlierModal}
                className="flex items-center gap-1 text-xs bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded transition-colors shadow-sm"
                title="选择列进行异常值检测"
               >
                   <Wand2 size={16} />
                   智能异常值检测
               </button>
           </div>
        </div>

        <div className="overflow-x-auto border-t border-slate-200 relative min-h-[300px]">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 w-10 text-center bg-slate-50">
                    <button onClick={toggleAllRows} title="全选/取消全选">
                        {selectedRowIndices.size === localData.length ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 w-12 text-center bg-slate-50">#</th>
                  {localHeaders.map(h => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap bg-slate-50">
                        {h}
                        {!headers.includes(h) && <span className="text-purple-500 ml-1 text-[9px]">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentDataSlice.map((row) => {
                  const idx = row.originalIndex;
                  const isSelected = selectedRowIndices.has(idx);
                  return (
                    <tr key={idx} className={`${isSelected ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 opacity-60'}`}>
                        <td className="px-4 py-2 text-center">
                            <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => toggleRow(idx)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                            />
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400 font-mono text-center">{idx + 1}</td>
                        {localHeaders.map(h => (
                        <td key={`${idx}-${h}`} className="px-4 py-2 whitespace-nowrap">
                            {row[h] !== null && row[h] !== undefined ? (
                                typeof row[h] === 'number' && String(row[h]).includes('.') ? Number(row[h]).toFixed(4) : String(row[h])
                            ) : '-'}
                        </td>
                        ))}
                    </tr>
                )})}
              </tbody>
            </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500">
                显示第 {((currentPage - 1) * ROWS_PER_PAGE) + 1} 到 {Math.min(currentPage * ROWS_PER_PAGE, localData.length)} 行，共 {localData.length} 行
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-xs font-medium text-slate-700">Page {currentPage} of {totalPages}</span>
                <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button 
          onClick={onBack}
          className="px-6 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          返回
        </button>
        <button 
          onClick={handleRun}
          disabled={!target || features.size === 0 || selectedRowIndices.size < 2}
          className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-sm transition-all transform active:scale-95"
        >
          运行模型 ({selectedRowIndices.size} 行数据)
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Outlier Selection Modal */}
      {showOutlierModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Wand2 size={18} className="text-amber-500" />
                        选择检测列
                    </h3>
                    <button onClick={() => setShowOutlierModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4">
                    <p className="text-sm text-slate-500 mb-4">
                        请选择要应用 Z-Score 异常值检测的数值列。系统将取消勾选偏离超过指定阈值的行。
                    </p>

                    {/* Z-Score Threshold Input */}
                    <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-100">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Z-Score 阈值 (标准差倍数)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.1"
                          value={zScoreThreshold}
                          onChange={(e) => setZScoreThreshold(Math.max(1, Number(e.target.value)))}
                          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">默认: 3</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        值越小，剔除的数据越多（更严格）；值越大，保留的数据越多。
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {localHeaders.map(h => {
                            // Only show likely numeric columns (not categorical)
                            // We allow selecting any column, but visually distinguish
                            const isSelected = outlierCols.has(h);
                            return (
                                <div key={`outlier-col-${h}`} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer" onClick={() => toggleOutlierCol(h)}>
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={() => {}} // Handled by div click
                                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500 pointer-events-none"
                                    />
                                    <span className="text-sm text-slate-700">{h}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button 
                        onClick={() => setShowOutlierModal(false)}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSmartDetect}
                        disabled={outlierCols.size === 0}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm shadow-sm disabled:opacity-50"
                    >
                        执行检测
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <History size={18} className="text-blue-600" />
                            历史模型配置记录
                        </h3>
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={handleExportHistory}
                                className="flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                title="将所有历史记录导出为 JSON 文件"
                             >
                                 <Download size={12} />
                                 导出记录
                             </button>
                             <label 
                                className="flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                                title="导入 JSON 文件并覆盖当前历史记录"
                             >
                                 <Upload size={12} />
                                 导入记录
                                 <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
                             </label>
                        </div>
                    </div>
                    <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar flex-grow bg-slate-50/30">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                            <Clock size={40} className="mb-3 opacity-30" />
                            <p>暂无历史运行记录</p>
                            <p className="text-xs mt-1">成功运行模型后，记录将自动保存在此处。</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((entry) => (
                                <div key={entry.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded">
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </span>
                                            <span className="font-bold text-slate-700">{entry.target}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleRestoreHistory(entry)}
                                            className="text-xs flex items-center gap-1 text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
                                        >
                                            <ArrowUpRight size={14} />
                                            加载配置
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                                        <div>
                                            <p className="text-xs text-slate-400">R² (拟合度)</p>
                                            <p className={`font-mono font-bold ${entry.metrics.r2 > 0.7 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                {entry.metrics.r2.toFixed(4)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">RMSE</p>
                                            <p className="font-mono text-slate-700">{entry.metrics.rmse.toFixed(4)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">样本量</p>
                                            <p className="font-mono text-slate-700">{entry.metrics.observations}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">特征数量</p>
                                            <p className="font-mono text-slate-700">{entry.features.length}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="text-xs text-slate-500 border-t border-slate-50 pt-2 flex flex-wrap gap-1">
                                        <span className="text-slate-400 mr-1">特征:</span>
                                        {entry.features.map(f => (
                                            <span key={f.name} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600" title={f.name}>
                                                {f.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default VariableSelector;