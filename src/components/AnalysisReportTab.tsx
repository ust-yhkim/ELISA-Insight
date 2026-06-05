import React, { useMemo, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Loader2, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar } from 'recharts';
import { StandardData, SampleColumn, SampleRow, RegressionParams } from '../types';
import { calculateMeanAndSD } from '../lib/math';
import { AppSettings, translations, formatValue } from '../settings';
import { cn } from '../lib/utils';

interface AnalysisReportTabProps {
  standards: StandardData[];
  columns: SampleColumn[];
  rows: SampleRow[];
  regression: RegressionParams;
  settings: AppSettings;
}

export function AnalysisReportTab({ standards, columns, rows, regression, settings }: AnalysisReportTabProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportModal, setExportModal] = useState<{type: 'pdf' | 'excel', open: boolean}>({ type: 'pdf', open: false });
  const [exportFileName, setExportFileName] = useState('analysis_report');
  const t = translations[settings.language];
  const isDark = settings.theme === 'dark';

  const confirmExport = async () => {
    const type = exportModal.type;
    const baseName = exportFileName || 'analysis_report';
    setExportModal({ ...exportModal, open: false });
    
    if (type === 'pdf') {
      await performExportPDF(baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`);
    } else {
      await performExportExcel(baseName.endsWith('.xlsx') ? baseName : `${baseName}.xlsx`);
    }
  };

  const performExportPDF = async (fileName: string) => {
    setIsExporting(true);
    try {
      const elements = document.querySelectorAll('.pdf-page');
      if (elements.length === 0) return;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const imgData = await toPng(el, { 
          backgroundColor: '#ffffff',
          pixelRatio: 2
        });
        
        if (i > 0) pdf.addPage();
        
        const props = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (props.height * pdfWidth) / props.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(fileName);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const performExportExcel = async (fileName: string) => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ELISA App';
      workbook.created = new Date();

      // 1. Standard Curve Sheet
      const stdSheet = workbook.addWorksheet('Standard Curve');
      stdSheet.columns = [
        { header: t.concentration || 'Concentration', key: 'conc', width: 25 },
        { header: t.odValue || 'OD Value', key: 'od', width: 20 },
      ];
      stdSheet.getRow(1).font = { bold: true };
      
      const validStandards = standards.filter(s => s.concentration && s.od);
      validStandards.forEach(s => {
        stdSheet.addRow({ 
          conc: Number(s.concentration), 
          od: Number(s.od) 
        });
      });
      stdSheet.addRow([]);
      stdSheet.addRow({ conc: 'Formula Y(OD)', od: regression.equationStr });
      if (regression.equationStrInverse) {
        stdSheet.addRow({ conc: 'Formula X(Conc)', od: regression.equationStrInverse });
      }
      stdSheet.addRow({ conc: 'R²', od: regression.r2 });

      // Capture Standard Curve Chart
      const stdChartEl = document.getElementById('print-std-chart');
      if (stdChartEl) {
        const stdImgData = await toPng(stdChartEl, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const imageId1 = workbook.addImage({ base64: stdImgData, extension: 'png' });
        stdSheet.addImage(imageId1, {
          tl: { col: 3, row: 1 },
          ext: { width: 450, height: 250 }
        });
      }

      // 2. Group Data Sheet
      const sampleSheet = workbook.addWorksheet('Group Data');
      sampleSheet.columns = [
        { header: t.sampleName || 'Group Name', key: 'name', width: 30 },
        ...columns.map(c => ({ header: c.name, key: c.id, width: 15 }))
      ];
      sampleSheet.getRow(1).font = { bold: true };
      
      rows.forEach(r => {
        const rowData: any = { name: r.name };
        columns.forEach(c => {
          rowData[c.id] = r.values[c.id] ? Number(r.values[c.id]) : '';
        });
        sampleSheet.addRow(rowData);
      });

      // 3. Analysis Result Sheet
      const resultSheet = workbook.addWorksheet('Analysis Result');
      resultSheet.columns = [
        { header: t.sampleName || 'Group Name', key: 'name', width: 30 },
        { header: `${t.odValue} (Mean)`, key: 'odMean', width: 15 },
        { header: `${t.odValue} (SD)`, key: 'odSd', width: 15 },
        { header: `${t.conc} (Mean)`, key: 'concMean', width: 15 },
        { header: `${t.conc} (SD)`, key: 'concSd', width: 15 },
        { header: `${t.cv} (%)`, key: 'cv', width: 15 },
      ];
      resultSheet.getRow(1).font = { bold: true };

      analysisResults.forEach(r => {
        if (r.rawOds.length > 0) {
          resultSheet.addRow({
            name: r.name,
            odMean: r.odMean,
            odSd: r.rawOds.length > 1 ? r.odSd : '-',
            concMean: r.concMean,
            concSd: r.rawOds.length > 1 ? r.concSd : '-',
            cv: r.rawOds.length > 1 ? r.concCv : '-'
          });
        }
      });

      // Capture Analysis Result Chart
      const analysisChartEl = document.getElementById('print-analysis-chart');
      if (analysisChartEl) {
        const analysisImgData = await toPng(analysisChartEl, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const imageId2 = workbook.addImage({ base64: analysisImgData, extension: 'png' });
        resultSheet.addImage(imageId2, {
          tl: { col: 7, row: 1 },
          ext: { width: 500, height: 350 }
        });
      }

      // Save Excel File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      saveAs(blob, fileName);

    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const analysisResults = useMemo(() => {
    return rows.map(row => {
      const rawOds = columns
        .map(col => parseFloat(row.values[col.id]))
        .filter(val => !isNaN(val));

      const adjustedOds = rawOds.map(od => od - (regression.useBlankOffset ? regression.blankOD : 0));

      // Calculate Concentration accurately using curve fit predictX
      const concentrations = adjustedOds.map(od => 
        regression.valid ? regression.predictX(od) : 0
      );

      const odStats = calculateMeanAndSD(rawOds);
      const concStats = calculateMeanAndSD(concentrations);

      return {
        id: row.id,
        name: row.name,
        rawOds: rawOds,
        odMean: odStats.mean,
        odSd: odStats.sd,
        odSem: odStats.sem,
        concentrations,
        concMean: concStats.mean,
        concSd: concStats.sd,
        concSem: concStats.sem,
        concCv: concStats.cv,
        concError: [0, settings.errorBarType === 'sem' ? concStats.sem : concStats.sd]
      };
    });
  }, [rows, columns, regression, settings.errorBarType]);

  const validResults = analysisResults.filter(r => r.rawOds.length > 0);

  return (
    <div className="flex flex-col gap-6 h-full p-6 overflow-auto">
      <div className="flex justify-between items-center shrink-0">
         <h1 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{t.tab3} - {t.plateAnalysisSheet}</h1>
         <div className="flex gap-2">
           <button
             onClick={() => setExportModal({ type: 'pdf', open: true })}
             disabled={isExporting}
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
           >
             {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
             {t.exportPDF || 'Export PDF'}
           </button>
           <button
             onClick={() => setExportModal({ type: 'excel', open: true })}
             disabled={isExporting}
             className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
           >
             {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
             {(t as any).exportExcel || 'Export Spreadsheet'}
           </button>
         </div>
      </div>

      {!regression.valid && (
        <div className={cn("px-4 py-3 rounded-xl border text-sm flex flex-col", isDark ? "bg-red-950/30 text-red-400 border-red-900/50" : "bg-red-50 text-red-700 border-red-200")}>
          <span className={cn("font-semibold", isDark ? "text-red-300" : "text-red-800")}>{t.invalidStandardCurve}</span>
          <span className="mt-1 opacity-80">{t.invalidStandardCurveDesc}</span>
        </div>
      )}

      <div className={cn("border rounded-xl shadow-sm overflow-hidden flex-shrink-0", isDark ? "border-white/5 bg-[#16161A]" : "border-slate-200 bg-white")}>
         <div className={cn("p-4 border-b", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
           <h2 className={cn("text-[11px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-600")}>{t.computedResultsGrid}</h2>
         </div>
         <div className="overflow-x-auto">
           <table className={cn("min-w-full divide-y text-sm", isDark ? "divide-white/10" : "divide-slate-200")}>
             <thead className={cn("text-[10px] uppercase font-bold border-b", isDark ? "bg-black/20 text-slate-400 border-white/10" : "bg-slate-50 text-slate-500 border-slate-200")}>
               <tr>
                 <th className={cn("px-4 py-3 text-left w-64 border-r whitespace-nowrap", isDark ? "border-white/10" : "border-slate-200")}>{t.sampleName}</th>
                 <th className="px-4 py-3 text-right">{t.odValue} ({t.mean})</th>
                 <th className={cn("px-4 py-3 text-right border-r", isDark ? "border-white/10" : "border-slate-200")}>{t.odValue} ({t.sd})</th>
                 <th className={cn("px-4 py-3 text-right", isDark ? "text-emerald-400 bg-emerald-400/5" : "text-emerald-700 bg-emerald-50")}>{t.conc} ({t.mean})</th>
                 <th className={cn("px-4 py-3 text-right", isDark ? "bg-emerald-400/5 text-slate-400" : "bg-emerald-50 text-slate-600")}>{t.conc} ({t.sd})</th>
                 <th className={cn("px-4 py-3 text-right", isDark ? "bg-emerald-400/5 text-slate-400" : "bg-emerald-50 text-slate-600")}>{t.cv}</th>
               </tr>
             </thead>
             <tbody className={cn("bg-transparent divide-y font-mono text-xs", isDark ? "divide-white/5" : "divide-slate-200")}>
               {analysisResults.map((result) => (
                 <tr key={result.id} className={cn("transition-colors", isDark ? "hover:bg-white/5" : "hover:bg-slate-50")}>
                   <td className={cn("px-4 py-3 border-r font-sans font-medium whitespace-nowrap", isDark ? "border-white/5 text-slate-300" : "border-slate-200 text-slate-800")}>{result.name}</td>
                   <td className={cn("px-4 py-3 text-right", isDark ? "text-slate-400" : "text-slate-600")}>{result.rawOds.length > 0 ? formatValue(result.odMean, settings) : '-'}</td>
                   <td className={cn("px-4 py-3 text-right border-r", isDark ? "border-white/5 text-slate-500" : "border-slate-200 text-slate-500")}>{result.rawOds.length > 1 ? formatValue(result.odSd, settings) : '-'}</td>
                   
                   <td className={cn("px-4 py-3 text-right font-bold", isDark ? "text-white bg-emerald-500/5" : "text-slate-900 bg-emerald-50")}>
                     {result.rawOds.length > 0 ? formatValue(result.concMean, settings) : '-'}
                   </td>
                   <td className={cn("px-4 py-3 text-right", isDark ? "bg-emerald-500/5 text-slate-400" : "bg-emerald-50 text-slate-600")}>
                     {result.rawOds.length > 1 ? formatValue(result.concSd, settings) : '-'}
                   </td>
                   <td className={cn("px-4 py-3 text-right", isDark ? "bg-emerald-500/5 text-slate-500" : "bg-emerald-50 text-slate-500")}>
                     {result.rawOds.length > 1 ? formatValue(result.concCv, {...settings, numberFormat: 'decimal', decimals: 1}) + '%' : '-'}
                   </td>
                 </tr>
               ))}
               {analysisResults.length === 0 && (
                 <tr>
                    <td colSpan={6} className={cn("px-4 py-8 text-center", isDark ? "text-slate-500" : "text-slate-400")}>
                      {t.noData}
                    </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
      </div>

      <div className={cn("border rounded-xl shadow-sm p-6 min-h-[400px] flex flex-col flex-1", isDark ? "border-white/5 bg-[#16161A]" : "border-slate-200 bg-white")}>
        <h2 className={cn("text-[11px] font-bold uppercase tracking-widest mb-6", isDark ? "text-slate-500" : "text-slate-600")}>{t.calculatedConcentration} ({t.mean} ± {settings.errorBarType.toUpperCase()})</h2>
        {validResults.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={validResults} 
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              barSize={40}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#ffffff" : "#000000"} strokeOpacity={0.05} vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11, fill: isDark ? '#64748b' : '#94a3b8' }} 
                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                tickLine={false}
                angle={-45}
                textAnchor="end"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: isDark ? '#64748b' : '#94a3b8' }}
                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                tickLine={false}
                label={{ value: t.concentration, angle: -90, position: 'insideLeft', fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11, offset: -5 }}
              />
              <Tooltip 
                 cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                 contentStyle={{ backgroundColor: isDark ? '#111114' : '#ffffff', borderRadius: '8px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', fontSize: '12px', color: isDark ? '#cbd5e1' : '#334155' }}
                 labelStyle={{ fontWeight: '600', color: isDark ? '#ffffff' : '#0f172a', marginBottom: '4px' }}
                 itemStyle={{ color: '#10b981' }}
                 formatter={(value: number, name: string) => [formatValue(value, settings), name === 'concMean' ? t.meanConcentration : name]}
              />
              <Bar dataKey="concMean" fill="#10b981" radius={[4, 4, 0, 0]} fillOpacity={0.8}>
                <ErrorBar 
                  dataKey="concError" 
                  width={4} 
                  strokeWidth={2} 
                  stroke={isDark ? "#ffffff" : "#334155"} 
                  direction="y" 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className={cn("flex-1 flex items-center justify-center border border-dashed rounded-xl", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
            <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-400")}>{t.noChartData}</p>
          </div>
        )}
      </div>

      {exportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={cn("w-full max-w-sm rounded-xl shadow-xl border p-6 text-sm flex flex-col gap-4", isDark ? "bg-[#16161A] border-white/10" : "bg-white border-slate-200")}>
            <h3 className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
              {exportModal.type === 'pdf' ? (t.exportPDF || 'Export PDF') : ((t as any).exportExcel || 'Export Spreadsheet')}
            </h3>
            
            <div className="flex flex-col gap-2">
              <label className={cn("text-xs font-semibold", isDark ? "text-slate-400" : "text-slate-600")}>
                File Name
              </label>
              <div className="flex relative items-center">
                <input
                  type="text"
                  autoFocus
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmExport()}
                  placeholder="analysis_report"
                  className={cn(
                    "w-full px-3 py-2 pr-12 rounded-md outline-none transition-colors border",
                    isDark 
                      ? "bg-black/20 border-white/10 focus:border-blue-500/50 text-white placeholder-slate-600" 
                      : "bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                  )}
                />
                <span className={cn("absolute right-3 text-xs pointer-events-none", isDark ? "text-slate-500" : "text-slate-400")}>
                  {exportModal.type === 'pdf' ? '.pdf' : '.xlsx'}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setExportModal({ ...exportModal, open: false })}
                className={cn(
                  "px-4 py-2 font-medium rounded-md transition-colors",
                  isDark ? "bg-white/5 hover:bg-white/10 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                {t.save || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
