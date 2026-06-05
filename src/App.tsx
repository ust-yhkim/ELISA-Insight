import React, { useState, useMemo } from 'react';
import { Activity, Table2, BarChart3, Beaker, Settings as SettingsIcon } from 'lucide-react';
import { StandardCurveTab } from './components/StandardCurveTab';
import { SpreadsheetTab } from './components/SpreadsheetTab';
import { AnalysisReportTab } from './components/AnalysisReportTab';
import { StandardData, SampleColumn, SampleRow } from './types';
import { calculateCurveFit } from './lib/math';
import { cn } from './lib/utils';
import { AppSettings, translations } from './settings';
import { SettingsModal } from './components/SettingsModal';
import { PrintableReport } from './components/PrintableReport';

export default function App() {
  const [activeTab, setActiveTab] = useState<'standard' | 'samples' | 'results'>('standard');
  const [useBlankSubtraction, setUseBlankSubtraction] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    language: 'ko',
    numberFormat: 'decimal',
    decimals: 3,
    errorBarType: 'sd',
    curveFit: 'linear',
  });

  const t = translations[settings.language];
  const isDark = settings.theme === 'dark';

  const [standards, setStandards] = useState<StandardData[]>([
    { id: '1', concentration: '1000', od: '2.45' },
    { id: '2', concentration: '500', od: '1.25' },
    { id: '3', concentration: '250', od: '0.65' },
    { id: '4', concentration: '125', od: '0.35' },
    { id: '5', concentration: '62.5', od: '0.18' },
    { id: '6', concentration: '31.25', od: '0.10' },
    { id: '7', concentration: '0', od: '0.05' },
  ]);

  const [columns, setColumns] = useState<SampleColumn[]>([
    { id: 'col1', name: 'Rep 1' },
    { id: 'col2', name: 'Rep 2' },
    { id: 'col3', name: 'Rep 3' },
  ]);

  const [rows, setRows] = useState<SampleRow[]>([
    { id: 'row1', name: 'Group 1', values: { col1: '1.2', col2: '1.25', col3: '1.18' } },
    { id: 'row2', name: 'Group 2', values: { col1: '0.8', col2: '0.85', col3: '0.79' } },
    { id: 'row3', name: 'Group 3', values: { col1: '0.45', col2: '0.48', col3: '0.44' } }
  ]);

  const regressionParams = useMemo(() => {
    let blankOD = 0;
    if (useBlankSubtraction) {
      const blankStd = standards.find(s => parseFloat(s.concentration) === 0);
      if (blankStd && !isNaN(parseFloat(blankStd.od))) {
        blankOD = parseFloat(blankStd.od);
      }
    }

    const dataPoints = standards
      .map(std => ({
        x: parseFloat(std.concentration),
        y: parseFloat(std.od) - blankOD
      }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y));

    return { ...calculateCurveFit(dataPoints, settings.curveFit, settings), blankOD, useBlankOffset: useBlankSubtraction };
  }, [standards, useBlankSubtraction, settings.curveFit, settings]);

  return (
    <>
      <div className={cn("print:hidden h-screen w-full flex flex-col font-sans transition-colors", isDark ? "bg-[#0A0A0B] text-slate-300" : "bg-slate-100 text-slate-800")}>
        <header className={cn("border-b px-6 py-4 flex items-center justify-between shrink-0", isDark ? "bg-[#111114] border-white/10" : "bg-white border-slate-200")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded shrink-0 bg-emerald-500/20 flex items-center justify-center shadow-sm">
            <Beaker className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div>
            <h1 className={cn("text-lg font-semibold tracking-tight leading-tight", isDark ? "text-white" : "text-slate-900")}>{t.title}</h1>
            <p className={cn("text-xs mt-0.5", isDark ? "text-slate-500" : "text-slate-500")}>{t.subtitle}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)} 
          className={cn("p-2 rounded-md transition-colors", isDark ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100")}
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </header>

      <div className={cn("border-b px-6 py-2 flex gap-1 shrink-0", isDark ? "bg-[#111114] border-white/10" : "bg-white border-slate-200")}>
        <button
          onClick={() => setActiveTab('standard')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === 'standard' 
              ? (isDark ? "bg-black/40 text-emerald-400" : "bg-emerald-50 text-emerald-700") 
              : (isDark ? "text-slate-400 hover:bg-white/5 hover:text-slate-300" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
          )}
        >
          <Activity className="w-4 h-4" />
          <span>{t.tab1}</span>
        </button>
        <button
          onClick={() => setActiveTab('samples')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === 'samples' 
              ? (isDark ? "bg-black/40 text-emerald-400" : "bg-emerald-50 text-emerald-700") 
              : (isDark ? "text-slate-400 hover:bg-white/5 hover:text-slate-300" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
          )}
        >
          <Table2 className="w-4 h-4" />
          <span>{t.tab2}</span>
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === 'results' 
              ? (isDark ? "bg-black/40 text-emerald-400" : "bg-emerald-50 text-emerald-700") 
              : (isDark ? "text-slate-400 hover:bg-white/5 hover:text-slate-300" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{t.tab3}</span>
        </button>
      </div>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'standard' && (
          <StandardCurveTab 
            standards={standards} 
            setStandards={setStandards} 
            regression={regressionParams} 
            useBlankSubtraction={useBlankSubtraction}
            setUseBlankSubtraction={setUseBlankSubtraction}
            settings={settings}
          />
        )}
        {activeTab === 'samples' && (
          <SpreadsheetTab 
            columns={columns} 
            setColumns={setColumns} 
            rows={rows} 
            setRows={setRows} 
            settings={settings}
          />
        )}
        {activeTab === 'results' && (
          <AnalysisReportTab 
            standards={standards}
            columns={columns} 
            rows={rows} 
            regression={regressionParams} 
            settings={settings}
          />
        )}
      </main>

      {showSettings && (
        <SettingsModal 
          settings={settings} 
          setSettings={setSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
      </div>

      <PrintableReport 
        standards={standards} 
        columns={columns} 
        rows={rows} 
        regression={regressionParams} 
        settings={settings} 
      />
    </>
  );
}
