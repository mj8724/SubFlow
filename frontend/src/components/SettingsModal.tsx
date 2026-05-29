import { useState, useEffect } from 'react';
import { X, Save, Settings2 } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSave, currentSettings }: any) {
  const [settings, setSettings] = useState(currentSettings);

  // Sync state if modal is reopened
  useEffect(() => {
    if (isOpen) setSettings(currentSettings);
  }, [isOpen, currentSettings]);

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
              <option value="local">Local (faster-whisper CPU)</option>
              <option value="api">API (Groq Whisper)</option>
            </select>
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
