import React from 'react';
import { X } from 'lucide-react';
import { AppSettings, translations } from '../settings';

interface SettingsModalProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onClose: () => void;
}

export function SettingsModal({ settings, setSettings, onClose }: SettingsModalProps) {
  const t = translations[settings.language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#16161A] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-300">
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t.settings}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Theme */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">{t.theme}</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSettings({ ...settings, theme: 'light' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.theme === 'light' ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                {t.light}
              </button>
              <button 
                onClick={() => setSettings({ ...settings, theme: 'dark' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.theme === 'dark' ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                {t.dark}
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">{t.language}</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSettings({ ...settings, language: 'ko' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.language === 'ko' ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                {t.korean}
              </button>
              <button 
                onClick={() => setSettings({ ...settings, language: 'en' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.language === 'en' ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                {t.english}
              </button>
            </div>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">{t.numberFormat}</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSettings({ ...settings, numberFormat: 'decimal' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.numberFormat === 'decimal' ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                {t.decimal}
              </button>
              <button 
                onClick={() => setSettings({ ...settings, numberFormat: 'scientific' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.numberFormat === 'scientific' ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                {t.scientific}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">{t.decimalPlaces}</label>
            <input 
              type="number" 
              min={0} 
              max={10} 
              value={settings.decimals}
              onChange={(e) => setSettings({ ...settings, decimals: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {/* Error Bar Type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">{t.errorBarType}</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSettings({ ...settings, errorBarType: 'sd' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.errorBarType === 'sd' ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                Mean ± SD
              </button>
              <button 
                onClick={() => setSettings({ ...settings, errorBarType: 'sem' })}
                className={`flex-1 py-1.5 px-3 rounded text-sm border transition-colors ${settings.errorBarType === 'sem' ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                Mean ± SEM
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">{t.curveFit}</label>
            <select
              value={settings.curveFit}
              onChange={(e) => setSettings({ ...settings, curveFit: e.target.value as any })}
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded focus:outline-none focus:border-emerald-500 text-sm [&>option]:bg-[#16161A]"
            >
              <option value="linear">{t.curveLinear}</option>
              <option value="logarithmic">{t.curveLogarithmic}</option>
              <option value="exponential">{t.curveExponential}</option>
              <option value="power">{t.curvePower}</option>
              <option value="quadratic">{t.curveQuadratic}</option>
              <option value="4pl">{t.curve4pl}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
