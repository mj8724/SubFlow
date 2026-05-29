"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FileVideo, ChevronRight, UploadCloud, ArrowLeft, FolderOpen } from 'lucide-react';

export default function FileBrowser({ onFileSelect }: { onFileSelect: (path: string) => void }) {
  const [currentPath, setCurrentPath] = useState('C:/');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDir = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`http://localhost:8888/api/browse?path=${encodeURIComponent(path)}`);
      setItems(res.data.items);
      setCurrentPath(res.data.path);
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
                  item.is_dir ? 'hover:bg-blue-900/20' : 'hover:bg-neutral-800'
                }`}
                onClick={() => item.is_dir ? fetchDir(item.path) : onFileSelect(item.path)}
              >
                <div className="flex items-center space-x-3 truncate">
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
    </div>
  );
}
