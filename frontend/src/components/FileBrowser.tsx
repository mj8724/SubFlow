"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FileVideo, ChevronRight, UploadCloud, ArrowLeft, FolderOpen, Music, X } from 'lucide-react';

interface FileBrowserProps {
  onFileSelect: (path: string) => void;
  onBatchExtractAudio?: (paths: string[], format: string) => void;
}

export default function FileBrowser({ onFileSelect, onBatchExtractAudio }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('C:/');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [batchFormat, setBatchFormat] = useState<string>('mp3');

  const fetchDir = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`http://localhost:8888/api/browse?path=${encodeURIComponent(path)}`);
      setItems(res.data.items);
      setCurrentPath(res.data.path);
      // Clear selection when navigating
      setSelectedFiles(new Set());
    } catch (err) {
      setError('Failed to load directory. Check backend connection.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDir(currentPath);
  }, []);

  const navigateUp = () => {
    if (currentPath === '/' || /^[a-zA-Z]:\/?$/.test(currentPath)) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();

    let newPath = parts.join('/');
    if (parts.length > 0 && parts[0].includes(':')) {
      newPath = newPath + (parts.length === 1 ? '/' : '');
    } else {
      newPath = '/' + newPath;
    }
    fetchDir(newPath);
  };

  const openFolderPicker = async () => {
    try {
      const res = await axios.get('http://localhost:8888/api/select_folder');
      if (res.data.path) {
        // Replace backslashes with forward slashes for consistency
        fetchDir(res.data.path.replace(/\\/g, '/'));
      }
    } catch (err: any) {
      console.error("Failed to open folder picker", err);
      alert(err.response?.data?.detail || "Failed to open native folder picker. Please enter the path manually.");
    }
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  const handleBatchExtract = () => {
    if (onBatchExtractAudio && selectedFiles.size > 0) {
      onBatchExtractAudio(Array.from(selectedFiles), batchFormat);
      clearSelection();
    }
  };

  const selectAllFiles = () => {
    const fileItems = items.filter(item => !item.is_dir);
    setSelectedFiles(new Set(fileItems.map((item: any) => item.path)));
  };

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 shadow-lg h-full flex flex-col overflow-hidden">
      <div className="flex items-center space-x-4 mb-4 pb-4 border-b border-neutral-800">
        <button
          onClick={navigateUp}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          disabled={currentPath === '/'}
        >
          <ArrowLeft size={20} className="text-neutral-400" />
        </button>
        <button
          onClick={openFolderPicker}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors ml-2"
          title="Select Folder"
        >
          <FolderOpen size={20} className="text-purple-400" />
        </button>
        <input
          type="text"
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              fetchDir(currentPath);
            }
          }}
          className="flex-1 font-mono text-sm bg-neutral-950 p-2 rounded-lg text-neutral-300 border border-neutral-800 ml-2 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-[300px] pr-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-neutral-500">Loading directory...</div>
        ) : error ? (
          <div className="text-red-400 text-sm p-4 text-center bg-red-900/20 rounded-lg border border-red-900/50">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-neutral-500 text-center p-8 flex flex-col items-center">
             <Folder size={32} className="mb-3 opacity-20" />
             Folder is empty
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg group transition-colors cursor-pointer ${
                  item.is_dir ? 'hover:bg-blue-900/20' :
                  selectedFiles.has(item.path) ? 'bg-purple-500/10 border-l-2 border-l-purple-500' :
                  'hover:bg-neutral-800'
                }`}
                onClick={() => item.is_dir ? fetchDir(item.path) : onFileSelect(item.path)}
              >
                <div className="flex items-center space-x-3 truncate">
                  {!item.is_dir && (
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(item.path)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleFileSelection(item.path);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-purple-500 cursor-pointer rounded"
                    />
                  )}
                  {item.is_dir ? (
                    <Folder className="text-blue-400 flex-shrink-0" size={20} />
                  ) : (
                    <FileVideo className="text-purple-400 flex-shrink-0" size={20} />
                  )}
                  <span className="text-sm truncate text-neutral-200 group-hover:text-white transition-colors">
                    {item.name}
                  </span>
                </div>
                {item.is_dir ? (
                  <ChevronRight size={16} className="text-neutral-600 group-hover:text-blue-400 transition-colors" />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onFileSelect(item.path); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white transition-all transform hover:scale-105 flex items-center space-x-1"
                  >
                    <UploadCloud size={14} />
                    <span className="text-xs font-medium">Generate</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batch Audio Extraction Action Bar */}
      {selectedFiles.size > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-800 bg-neutral-950 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-neutral-300">
                {selectedFiles.size} 个文件已选中
              </span>
              <button
                onClick={selectAllFiles}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                全选
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-neutral-400 hover:text-neutral-300 transition-colors flex items-center space-x-1"
              >
                <X size={12} />
                <span>清除</span>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={batchFormat}
                onChange={(e) => setBatchFormat(e.target.value)}
                className="bg-neutral-900 text-neutral-200 text-sm rounded-lg border border-neutral-700 px-2 py-1.5 focus:outline-none focus:border-purple-500"
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="flac">FLAC</option>
                <option value="aac">AAC</option>
              </select>
              <button
                onClick={handleBatchExtract}
                className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white transition-all transform hover:scale-105 flex items-center space-x-1.5 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              >
                <Music size={14} />
                <span className="text-xs font-medium">提取音频</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
