import React, { useMemo } from 'react';
import { StandardData, RegressionParams, SampleColumn, SampleRow } from '../types';
import { AppSettings, translations, formatValue } from '../settings';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ErrorBar } from 'recharts';
import { calculateMeanAndSD } from '../lib/math';

interface Props {
  standards: StandardData[];
  regression: RegressionParams;
  columns: SampleColumn[];
  rows: SampleRow[];
  settings: AppSettings;
}

export function PrintableReport({ standards, regression, columns, rows, settings }: Props) {
  const t = translations[settings.language];
  
  const chartData = useMemo(() => {
    const validData = standards
      .map(std => ({
        x: parseFloat(std.concentration),
        rawY: parseFloat(std.od),
        y: parseFloat(std.od) - (regression.useBlankOffset ? regression.blankOD : 0)
      }))
      .filter(d => !isNaN(d.x) && !isNaN(d.rawY))
      .sort((a, b) => a.x - b.x);

    if (validData.length === 0) return { points: [], merged: [] };
    
    const minX = validData[0].x;
    const maxX = validData[validData.length - 1].x;
    
    const smoothData: {x: number, predictedY: number}[] = [];
    if (regression.valid && validData.length > 0) {
      const steps = 100;
      const stepSize = (maxX - minX) / steps;
      for (let i = 0; i <= steps; i++) {
        const cx = minX + i * stepSize;
        smoothData.push({ x: cx, predictedY: regression.predictY(cx) });
      }
    }

    const merged = [...validData, ...smoothData].sort((a, b) => a.x - b.x);
    return { points: validData, merged };
  }, [standards, regression]);

  const analysisResults = useMemo(() => {
    return rows.map(row => {
      const rawOds = columns.map(col => parseFloat(row.values[col.id])).filter(val => !isNaN(val));
      const adjustedOds = rawOds.map(od => od - (regression.useBlankOffset ? regression.blankOD : 0));
      const concentrations = adjustedOds.map(od => regression.valid ? regression.predictX(od) : 0);

      const odStats = calculateMeanAndSD(rawOds);
      const concStats = calculateMeanAndSD(concentrations);

      return {
        id: row.id,
        name: row.name,
        rawOds: rawOds,
        adjustedOds: adjustedOds,
        concentrations: concentrations,
        odMean: odStats.mean,
        odSd: odStats.sd,
        odSem: odStats.sem,
        concMean: concStats.mean,
        concSd: concStats.sd,
        concSem: concStats.sem,
        concCv: concStats.cv,
        concError: [0, settings.errorBarType === 'sem' ? concStats.sem : concStats.sd]
      };
    });
  }, [rows, columns, regression, settings.errorBarType]);

  const validResults = analysisResults.filter(r => r.rawOds.length > 0);

  const chunkedResults = [];
  for (let i = 0; i < validResults.length; i += 8) {
    chunkedResults.push(validResults.slice(i, i + 8));
  }

  const ReportHeader = () => (
    <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
      <h1 className="text-2xl font-bold">{t.title} - Analysis Report</h1>
      <div className="text-right text-gray-500 text-xs">
        {new Date().toLocaleString(settings.language === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'long', timeStyle: 'short' })}
      </div>
    </div>
  );

  return (
    <div id="printable-report" className="fixed -left-[9999px] -top-[9999px] flex-col gap-8 items-center bg-gray-100 w-[210mm]">
      {/* PAGE 1: Standard Curve */}
      <div className="pdf-page bg-white text-black p-10 font-sans w-[210mm] h-[297mm] box-border relative overflow-hidden text-sm shrink-0">
        <ReportHeader />
        
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 border-b border-gray-200 pb-1">{t.standardCurveData}</h2>
          <div className="flex gap-8">
             <div className="w-1/3">
               <table className="w-full text-xs border-collapse border border-gray-300">
                 <thead className="bg-gray-100">
                   <tr>
                     <th className="border border-gray-300 p-2 text-left">{t.concentration}</th>
                     <th className="border border-gray-300 p-2 text-left">{t.odValue}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200">
                    {standards.filter(s => s.concentration && s.od).map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="border-x border-gray-300 p-1.5">{s.concentration}</td>
                        <td className="border-x border-gray-300 p-1.5">{s.od}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
               {regression.useBlankOffset && (
                 <div className="mt-2 text-xs text-gray-600">
                   * {t.subtractBackground}: {formatValue(regression.blankOD, settings)}
                 </div>
               )}
             </div>
             
             <div className="w-2/3 flex flex-col items-center">
               <div className="mb-2 text-sm font-semibold bg-gray-50 px-4 py-2 border border-gray-200 rounded text-center w-full">
                 {(t as any)[`curve${settings.curveFit.charAt(0).toUpperCase() + settings.curveFit.slice(1)}`]} <br/>
                 <div className="flex flex-col text-blue-700 text-xs mt-1">
                    <span>Y(OD): {regression.equationStr}</span>
                    {regression.equationStrInverse && <span>X(Conc): {regression.equationStrInverse}</span>}
                    <span>R² = {formatValue(regression.r2, {...settings, numberFormat: 'decimal', decimals: 4})}</span>
                 </div>
               </div>
               {chartData.points?.length > 0 && (
                  <div id="print-std-chart" style={{ width: 450, height: 250, backgroundColor: '#ffffff' }}>
                    <ComposedChart width={450} height={250} data={chartData.merged} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="x" type="number" name={t.concentration} stroke="#374151" tick={{fontSize: 10}} />
                      <YAxis stroke="#374151" tick={{fontSize: 10}} />
                      <Scatter dataKey="y" fill="#000" isAnimationActive={false} />
                      {regression.valid && (
                        <Line dataKey="predictedY" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
                      )}
                    </ComposedChart>
                  </div>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* PAGE 2~N: Samples Table Chunks */}
      {chunkedResults.map((chunk, idx) => (
        <div key={`chunk-${idx}`} className="pdf-page bg-white text-black p-10 font-sans w-[210mm] h-[297mm] box-border relative overflow-hidden text-sm shrink-0">
          <ReportHeader />
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 border-b border-gray-200 pb-1">
              {t.plateAnalysisSheet} {chunkedResults.length > 1 ? `(${idx + 1}/${chunkedResults.length})` : ''}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {chunk.map(res => (
                <div key={res.id} className="border border-gray-300 rounded overflow-hidden shadow-sm text-xs">
                  <div className="bg-gray-100 p-2 font-bold border-b border-gray-300">{res.name}</div>
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                         <th className="p-1.5 text-left w-16">Rep</th>
                         <th className="p-1.5 text-right">{t.odValue}</th>
                         <th className="p-1.5 text-right">{t.conc}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {res.rawOds.map((od, i) => (
                         <tr key={i}>
                           <td className="p-1.5 text-gray-500">#{i+1}</td>
                           <td className="p-1.5 text-right">{formatValue(od, settings)}</td>
                           <td className="p-1.5 text-right font-medium text-blue-800">{formatValue(res.concentrations[i], settings)}</td>
                         </tr>
                       ))}
                       <tr className="bg-blue-50 font-bold border-t border-blue-200">
                         <td className="p-1.5">{t.mean}</td>
                         <td className="p-1.5 text-right">{formatValue(res.odMean, settings)}</td>
                         <td className="p-1.5 text-right text-blue-700">{formatValue(res.concMean, settings)}</td>
                       </tr>
                       <tr className="bg-gray-50 text-gray-600 font-medium">
                         <td className="p-1.5">SD / CV</td>
                         <td className="p-1.5 text-right">{formatValue(res.odSd, settings)}</td>
                         <td className="p-1.5 text-right whitespace-nowrap">{formatValue(res.concSd, settings)} ({formatValue(res.concCv, {...settings, numberFormat: 'decimal', decimals: 1})}%)</td>
                       </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* FINAL PAGE: Bar Chart */}
      {validResults.length > 0 && (
         <div className="pdf-page bg-white text-black p-10 font-sans w-[210mm] h-[297mm] box-border relative overflow-hidden text-sm shrink-0">
           <ReportHeader />
           <div className="mt-8">
             <h2 className="text-lg font-bold mb-4 border-b border-gray-200 pb-1">{t.calculatedConcentration}</h2>
             <div id="print-analysis-chart" className="flex justify-center border border-gray-200 rounded p-4 bg-white" style={{ width: 685, height: 485 }}>
               <BarChart width={650} height={450} data={validResults} margin={{ top: 20, right: 30, left: 10, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} angle={-45} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#374151' }} />
                  <Bar dataKey="concMean" fill="#2563eb" isAnimationActive={false}>
                    <ErrorBar dataKey="concError" width={4} strokeWidth={2} stroke="#000" direction="y" />
                  </Bar>
               </BarChart>
             </div>
           </div>
         </div>
      )}
    </div>
  );
}
