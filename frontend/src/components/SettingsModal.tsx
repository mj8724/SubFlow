import { useState, useEffect } from 'react';
import { X, Save, Settings2, Download, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';

const MODELS = [
  { id: 'tiny', params: '39M', size: '~40MB', desc: 'Fastest' },
  { id: 'base', params: '74M', size: '~75MB', desc: 'Very Fast' },
  { id: 'small', params: '244M', size: '~250MB', desc: 'Fast' },
  { id: 'medium', params: '769M', size: '~770MB', desc: 'Accurate' },
  { id: 'large-v2', params: '1.55B', size: '~1.5GB', desc: 'Very Accurate' },
  { id: 'large-v3', params: '1.55B', size: '~1.5GB', desc: 'Most Accurate' },
];

export default function SettingsModal({ isOpen, onClose, onSave, currentSettings }: any) {
  const [settings, setSettings] = useState(currentSettings);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<string>("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      fetchModels();
    }
  }, [isOpen, currentSettings]);

  const fetchModels = async () => {
    try {
      const res = await axios.get('http://localhost:8888/api/models');
      setDownloadedModels(res.data);
    } catch (e) {
      console.error("Failed to fetch models", e);
    }
  };

  const handleDownload = async (modelId: string) => {
    setDownloading(modelId);
    setDownloadSpeed("0%");
    setDownloadError(null);
    try {
      await axios.post('http://localhost:8888/api/models/download', { model_name: modelId });
      // Poll to check if downloaded
      const interval = setInterval(async () => {
        try {
          // Check for download errors first
          const statusRes = await axios.get('http://localhost:8888/api/models/download_status');
          if (statusRes.data[modelId]?.error) {
            setDownloading(null);
            setDownloadSpeed("");
            setDownloadError(`Model "${modelId}" download failed: ${statusRes.data[modelId].error}`);
            clearInterval(interval);
            return;
          }
          
          const res = await axios.get('http://localhost:8888/api/models');
          if (res.data.includes(modelId)) {
            setDownloadedModels(res.data);
            setDownloading(null);
            setDownloadSpeed("");
            clearInterval(interval);
          } else if (statusRes.data[modelId]) {
            setDownloadSpeed(`${statusRes.data[modelId].pct.toFixed(1)}% (${statusRes.data[modelId].speed})`);
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 1000);
    } catch (e) {
      console.error("Failed to start download", e);
      setDownloading(null);
      setDownloadSpeed("");
      setDownloadError("Failed to start download. Please check if the backend is running.");
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      await axios.delete(`http://localhost:8888/api/models/${modelId}`);
      setDownloadedModels(downloadedModels.filter(m => m !== modelId));
    } catch (e) {
      console.error("Failed to delete model", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center text-white">
            <Settings2 className="mr-2 text-purple-400" /> System Settings
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition"><X size={20}/></button>
        </div>

        <div className="space-y-6">
          {/* STT Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Speech-to-Text (STT)</h3>
            <select 
              value={settings.stt_mode} 
              onChange={e => setSettings({...settings, stt_mode: e.target.value})}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
            >
              <option value="local">Local (Faster-Whisper CPU)</option>
              <option value="api">API (Groq Whisper)</option>
            </select>
            
            {settings.stt_mode === 'local' && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                {MODELS.map(model => {
                  const isDownloaded = downloadedModels.includes(model.id);
                  const isDownloading = downloading === model.id;
                  const isSelected = settings.stt_model === model.id;

                  return (
                    <div key={model.id} className={`flex items-center justify-between p-2 rounded-lg border ${isSelected ? 'border-purple-500 bg-purple-500/10' : 'border-neutral-800 bg-neutral-950/50'} transition`}>
                      <div className="flex items-center space-x-3">
                        <input 
                          type="radio" 
                          name="model" 
                          checked={isSelected}
                          onChange={() => setSettings({...settings, stt_model: model.id})}
                          className="w-4 h-4 text-purple-600 bg-neutral-900 border-neutral-700 focus:ring-purple-600 focus:ring-2 accent-purple-500 cursor-pointer"
                        />
                        <div>
                          <div className="text-sm font-medium text-white flex items-center">
                            {model.id}
                            {isDownloaded && <CheckCircle2 size={14} className="text-green-500 ml-2" title="Downloaded" />}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {model.desc} • {model.params} • {model.size}
                          </div>
                        </div>
                      </div>
                      <div>
                        {isDownloading ? (
                          <div className="flex items-center text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded whitespace-nowrap">
                            <Loader2 size={14} className="animate-spin mr-1" /> Downloading... {downloadSpeed}
                          </div>
                        ) : isDownloaded ? (
                          <button 
                            onClick={() => handleDelete(model.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                            title="Delete Model"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setDownloadError(null); handleDownload(model.id); }}
                            className="flex items-center space-x-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded transition"
                          >
                            <Download size={14} /> <span>Download</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {downloadError && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                {downloadError}
              </div>
            )}

            {settings.stt_mode === 'api' && (
              <input 
                type="password" 
                placeholder="Groq API Key"
                value={settings.stt_api_key}
                onChange={e => setSettings({...settings, stt_api_key: e.target.value})}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
              />
            )}
          </div>

          {/* Translation Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Translation</h3>
            <select 
              value={settings.trans_mode} 
              onChange={e => setSettings({...settings, trans_mode: e.target.value})}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
            >
              <option value="local">Local (Opus-MT CPU)</option>
              <option value="api">API (Cloud LLM/DeepL)</option>
            </select>
            {settings.trans_mode === 'api' && (
              <input 
                type="password" 
                placeholder="Translation API Key"
                value={settings.trans_api_key}
                onChange={e => setSettings({...settings, trans_api_key: e.target.value})}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
              />
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onSave(settings); onClose(); }}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          >
            <Save size={16} className="mr-2" /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
