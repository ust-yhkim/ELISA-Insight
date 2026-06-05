import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { StandardData, RegressionParams } from '../types';
import { AppSettings, translations, formatValue } from '../settings';

interface StandardCurveTabProps {
  standards: StandardData[];
  setStandards: React.Dispatch<React.SetStateAction<StandardData[]>>;
  regression: RegressionParams;
  useBlankSubtraction: boolean;
  setUseBlankSubtraction: React.Dispatch<React.SetStateAction<boolean>>;
  settings: AppSettings;
}

export function StandardCurveTab({ standards, setStandards, regression, useBlankSubtraction, setUseBlankSubtraction, settings }: StandardCurveTabProps) {
  const t = translations[settings.language];
  const isDark = settings.theme === 'dark';
  const addStandard = () => {
    setStandards([...standards, { id: crypto.randomUUID(), concentration: '', od: '' }]);
  };

  const updateStandard = (id: string, field: 'concentration' | 'od', value: string) => {
    setStandards(standards.map(std =>
      std.id === id ? { ...std, [field]: value } : std
    ));
  };

  const deleteStandard = (id: string) => {
    setStandards(standards.filter(std => std.id !== id));
  };

  const handlePaste = (e: React.ClipboardEvent, id: string, startField: 'concentration' | 'od') => {
    const pasteStr = e.clipboardData.getData('text');
    if (!pasteStr) return;

    const rows = pasteStr.split(/\r?\n/).filter(r => r.trim() !== '');
    
    if (rows.length === 1 && rows[0].split(/\t/).length === 1) {
       return; // Let default paste work for single cell
    }
    
    e.preventDefault();

    const newStandards = [...standards];
    const startIndex = newStandards.findIndex(s => s.id === id);
    if (startIndex === -1) return;

    let currIdx = startIndex;
    rows.forEach((rowStr) => {
        const cols = rowStr.split(/\t/);
        const concVal = cols[0]?.trim();
        const odVal = cols[1]?.trim();

        if (currIdx < newStandards.length) {
            if (startField === 'concentration') {
                if (concVal !== undefined) newStandards[currIdx].concentration = concVal;
                if (odVal !== undefined) newStandards[currIdx].od = odVal;
            } else {
                if (concVal !== undefined) newStandards[currIdx].od = concVal;
            }
        } else {
            // append new row
            if (startField === 'concentration') {
                newStandards.push({
                   id: crypto.randomUUID(),
                   concentration: concVal || '',
                   od: odVal || ''
                });
            } else {
                newStandards.push({
                   id: crypto.randomUUID(),
                   concentration: '',
                   od: concVal || ''
                });
            }
        }
        currIdx++;
    });
    setStandards(newStandards);
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number, field: 'concentration' | 'od') => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex + 1 < standards.length) {
        const nextId = standards[currentIndex + 1].id;
        document.getElementById(`standard-input-${nextId}-${field}`)?.focus();
      } else {
        addStandard();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex - 1 >= 0) {
        const prevId = standards[currentIndex - 1].id;
        document.getElementById(`standard-input-${prevId}-${field}`)?.focus();
      }
    }
  };

  const chartData = useMemo(() => {
    const validData = standards
      .map(std => ({
        x: parseFloat(std.concentration),
        rawY: parseFloat(std.od),
        y: parseFloat(std.od) - (regression.useBlankOffset ? regression.blankOD : 0)
      }))
      .filter(d => !isNaN(d.x) && !isNaN(d.rawY))
      .sort((a, b) => a.x - b.x);

    if (validData.length === 0) return [];

    const pointsData = validData.map(d => ({
      x: d.x,
      y: d.y,
      predictedY: regression.valid ? regression.predictY(d.x) : undefined,
    }));

    const smoothData: {x: number, predictedY: number}[] = [];
    if (regression.valid && validData.length > 0) {
      const minX = validData[0].x;
      const maxX = validData[validData.length - 1].x;
      const steps = 100;
      const stepSize = (maxX - minX) / steps;
      for (let i = 0; i <= steps; i++) {
        const cx = minX + i * stepSize;
        smoothData.push({ x: cx, predictedY: regression.predictY(cx) });
      }
    }

    return [...pointsData, ...smoothData].sort((a, b) => a.x - b.x);
  }, [standards, regression]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full p-6 overflow-y-auto">
      <div className={cn("w-full lg:w-1/3 border rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0", isDark ? "bg-[#16161A] border-white/5" : "bg-white border-slate-200")}>
        <div className={cn("p-4 border-b flex flex-col gap-3 shrink-0", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
          <div className="flex justify-between items-center">
            <h2 className={cn("text-[11px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-600")}>{t.standardCurveData}</h2>
            <button
              onClick={addStandard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> {t.addRow}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className={cn("flex items-center gap-2 text-xs cursor-pointer transition-colors", isDark ? "text-slate-300 hover:text-white" : "text-slate-700 hover:text-slate-900")}>
              <input 
                type="checkbox" 
                checked={useBlankSubtraction}
                onChange={(e) => setUseBlankSubtraction(e.target.checked)}
                className={cn("rounded focus:ring-emerald-500/50 text-emerald-500", isDark ? "border-white/20 bg-black/50" : "border-slate-300 bg-white")}
              />
              {t.subtractBackground}
            </label>
            {useBlankSubtraction && regression.blankOD > 0 && (
              <span className={cn("text-[10px] px-2 py-0.5 rounded", isDark ? "text-emerald-400 bg-emerald-400/10" : "text-emerald-700 bg-emerald-100")}>
                - {formatValue(regression.blankOD, settings)}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 shrink-0 min-h-[300px]">
          <table className="w-full text-sm text-left">
            <thead className={cn("text-[10px] uppercase font-bold border-b", isDark ? "text-slate-400 bg-black/20 border-white/10" : "text-slate-500 bg-slate-50 border-slate-200")}>
              <tr>
                <th className="py-3 px-2">{t.concentration}</th>
                <th className="py-3 px-2">{t.odValue}</th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {standards.map((std, idx) => (
                <tr key={std.id} className={cn("border-b last:border-0", isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50")}>
                  <td className="py-2 px-2">
                    <input
                      id={`standard-input-${std.id}-concentration`}
                      type="number"
                      step="any"
                      value={std.concentration}
                      onChange={(e) => updateStandard(std.id, 'concentration', e.target.value)}
                      onPaste={(e) => handlePaste(e, std.id, 'concentration')}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'concentration')}
                      placeholder="e.g. 100"
                      className={cn("w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-emerald-500", isDark ? "bg-black/20 border-white/10 text-slate-200 placeholder:text-slate-600" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400")}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      id={`standard-input-${std.id}-od`}
                      type="number"
                      step="any"
                      value={std.od}
                      onChange={(e) => updateStandard(std.id, 'od', e.target.value)}
                      onPaste={(e) => handlePaste(e, std.id, 'od')}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'od')}
                      placeholder="e.g. 0.5"
                      className={cn("w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-emerald-500", isDark ? "bg-black/20 border-white/10 text-slate-200 placeholder:text-slate-600" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400")}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => deleteStandard(std.id)}
                      className={cn("p-1 rounded transition-colors", isDark ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn("w-full lg:w-2/3 border rounded-xl shadow-sm p-6 flex flex-col shrink-0", isDark ? "bg-[#16161A] border-white/5" : "bg-white border-slate-200")}>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className={cn("text-[11px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-600")}>{t.standardCurveLine}</h2>
            <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>
               {(t as any)[`curve${settings.curveFit.charAt(0).toUpperCase() + settings.curveFit.slice(1)}`]}
            </p>
          </div>
          {regression.valid ? (
            <div className={cn("px-4 py-2 rounded-md border text-[11px] font-mono", isDark ? "bg-black/50 border-white/5 text-emerald-200/80" : "bg-slate-50 border-slate-200 text-emerald-700")}>
              <div className="flex flex-col gap-1">
                <div>
                  <span className="font-semibold text-slate-500 mr-2">Y(OD)</span> 
                  {regression.equationStr}
                </div>
                {regression.equationStrInverse && (
                  <div>
                    <span className="font-semibold text-slate-500 mr-2">X(Conc)</span> 
                    {regression.equationStrInverse}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-slate-500 mr-2">R²</span> 
                  {formatValue(regression.r2, { ...settings, numberFormat: 'decimal', decimals: 4 })}
                </div>
              </div>
            </div>
          ) : (
            <div className={cn("text-[11px] font-mono px-4 py-2 rounded-md border", isDark ? "text-slate-500 bg-black/50 border-white/5" : "text-slate-500 bg-slate-50 border-slate-200")}>
              {t.needMoreData}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#ffffff" : "#000000"} strokeOpacity={0.1} vertical={false} />
              <XAxis 
                dataKey="x" 
                type="number" 
                name={t.concentration} 
                stroke={isDark ? "#64748b" : "#94a3b8"} 
                tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                label={{ value: t.concentration, position: 'bottom', fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
              />
              <YAxis 
                stroke={isDark ? "#64748b" : "#94a3b8"} 
                tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                label={{ value: t.odValue, angle: -90, position: 'insideLeft', fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
              />
              <Scatter name={t.measuredOD} dataKey="y" fill={isDark ? "#ffffff" : "#334155"} />
              {regression.valid && (
                <Line
                  dataKey="predictedY"
                  stroke="#10b981"
                  dot={false}
                  activeDot={false}
                  name={t.regressionLine}
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
