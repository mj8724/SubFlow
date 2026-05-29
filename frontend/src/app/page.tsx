"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import FileBrowser from '@/components/FileBrowser';
import JobList from '@/components/JobList';
import SettingsModal from '@/components/SettingsModal';
import { Subtitles, CheckCircle2, Settings } from 'lucide-react';

export default function Home() {
  const [toast, setToast] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    stt_mode: 'local',
    stt_model: 'tiny',
    stt_api_key: '',
    trans_mode: 'local',
    trans_api_key: ''
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('autosub_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Wrap setSettings to also save to localStorage
  const updateSettings = (newSettings: any) => {
    setSettings(newSettings);
    localStorage.setItem('autosub_settings', JSON.stringify(newSettings));
  };

  const handleFileSelect = async (path: string) => {
    try {
      await axios.post('http://localhost:8888/api/jobs', { 
        file_path: path,
        config: settings
      });
      setToast(`Started job for ${path.split('/').pop()}`);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert("Failed to start job");
    }
  };

  return (
    <main className="min-h-screen bg-black text-neutral-50 selection:bg-purple-500/30">
      {/* Navbar */}
      <nav className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Subtitles size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
              AutoSub NAS
            </h1>
          </div>
          <div className="flex items-center space-x-4">
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-purple-600 rounded-full transition border border-neutral-800 hover:border-purple-500">
               <Settings size={18} />
             </button>
             <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-mono text-neutral-400">API Online</span>
             </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-10rem)]">
          <div className="lg:col-span-7 h-full">
            <FileBrowser onFileSelect={handleFileSelect} />
          </div>
          <div className="lg:col-span-5 h-full">
            <JobList />
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={updateSettings} 
        currentSettings={settings} 
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-purple-600 text-white px-4 py-3 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.3)] flex items-center space-x-3">
          <CheckCircle2 size={18} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </main>
  );
}
