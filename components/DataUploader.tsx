import React, { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { DataRow } from '../types';

interface Props {
  onDataLoaded: (data: DataRow[], headers: string[]) => void;
}

const DataUploader: React.FC<Props> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<DataRow>(sheet);
        
        if (jsonData.length === 0) {
            setError("上传的文件似乎是空的。");
            return;
        }

        const headers = Object.keys(jsonData[0]);
        onDataLoaded(jsonData, headers);
      } catch (err) {
        setError("无法解析文件。请确保它是有效的 Excel 或 CSV 文件。");
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <div 
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-slate-100 rounded-full text-slate-600">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">上传数据集</h3>
          <p className="text-slate-500">将 Excel (.xlsx) 或 CSV 文件拖放到此处</p>
          
          <label className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer transition-colors">
            浏览文件
            <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileSelect} />
          </label>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 text-center text-slate-400 text-sm">
        <p className="flex items-center justify-center gap-2">
          <FileSpreadsheet size={16} /> 支持的格式: .xlsx, .xls, .csv
        </p>
      </div>
    </div>
  );
};

export default DataUploader;