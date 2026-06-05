import React from 'react';
import { Plus, Trash2, Columns, ArrowRightLeft } from 'lucide-react';
import { SampleColumn, SampleRow } from '../types';
import { AppSettings, translations } from '../settings';
import { cn } from '../lib/utils';

interface SpreadsheetTabProps {
  columns: SampleColumn[];
  setColumns: React.Dispatch<React.SetStateAction<SampleColumn[]>>;
  rows: SampleRow[];
  setRows: React.Dispatch<React.SetStateAction<SampleRow[]>>;
  settings: AppSettings;
}

export function SpreadsheetTab({ columns, setColumns, rows, setRows, settings }: SpreadsheetTabProps) {
  const t = translations[settings.language];
  const isDark = settings.theme === 'dark';
  const addColumn = () => {
    const newColId = crypto.randomUUID();
    setColumns([...columns, { id: newColId, name: `Rep ${columns.length + 1}` }]);
  };

  const removeColumn = (id: string) => {
    setColumns(columns.filter(c => c.id !== id));
    // Optionally clean up values in rows
  };

  const updateColumnName = (id: string, newName: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, name: newName } : c));
  };

  const addRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), name: `Group ${rows.length + 1}`, values: {} }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRowName = (id: string, newName: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, name: newName } : r));
  };

  const updateCellValue = (rowId: string, colId: string, value: string) => {
    setRows(rows.map(r => {
      if (r.id === rowId) {
        return { ...r, values: { ...r.values, [colId]: value } };
      }
      return r;
    }));
  };

  const handlePaste = (e: React.ClipboardEvent, startRowId: string, startColId: string | 'name') => {
    const pasteStr = e.clipboardData.getData('text');
    if (!pasteStr) return;

    const rowsStr = pasteStr.split(/\r?\n/).filter(r => r.trim() !== '');

    if (rowsStr.length === 1 && rowsStr[0].split(/\t/).length === 1) {
      return; // Single value, let default handle it or we can process it, but default allows native behavior.
    }
    
    e.preventDefault();

    const newRows = [...rows];
    // Deep clone values objects to avoid mutation issues
    const clonedRows = newRows.map(r => ({ ...r, values: { ...r.values } }));
    let newColumns = [...columns];
    
    const startRowIndex = clonedRows.findIndex(r => r.id === startRowId);
    if (startRowIndex === -1) return;

    const startColIndex = startColId === 'name' ? -1 : newColumns.findIndex(c => c.id === startColId);

    rowsStr.forEach((rowStr, rIdx) => {
      const targetRowIndex = startRowIndex + rIdx;
      
      if (targetRowIndex >= clonedRows.length) {
        clonedRows.push({ id: crypto.randomUUID(), name: `Sample ${clonedRows.length + 1}`, values: {} });
      }

      const cols = rowStr.split(/\t/);
      cols.forEach((colVal, cIdx) => {
        let valueStr = colVal.trim();
        
        if (startColId === 'name') {
           if (cIdx === 0) {
             clonedRows[targetRowIndex].name = valueStr;
           } else {
             const targetColIndex = cIdx - 1;
             while (targetColIndex >= newColumns.length) {
               newColumns.push({ id: crypto.randomUUID(), name: `Rep ${newColumns.length + 1}` });
             }
             clonedRows[targetRowIndex].values[newColumns[targetColIndex].id] = valueStr;
           }
        } else {
           const targetColIndex = startColIndex + cIdx;
           if (targetColIndex >= 0) {
             while (targetColIndex >= newColumns.length) {
               newColumns.push({ id: crypto.randomUUID(), name: `Rep ${newColumns.length + 1}` });
             }
             clonedRows[targetRowIndex].values[newColumns[targetColIndex].id] = valueStr;
           }
        }
      });
    });

    if (newColumns.length > columns.length) {
      setColumns(newColumns);
    }
    setRows(clonedRows);
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentRowIndex: number, colId: string | 'name') => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentRowIndex + 1 < rows.length) {
        const nextRow = rows[currentRowIndex + 1];
        const nextId = colId === 'name' ? `spreadsheet-name-${nextRow.id}` : `spreadsheet-cell-${nextRow.id}-${colId}`;
        document.getElementById(nextId)?.focus();
      } else {
        addRow();
        // we can't focus immediately because it has to render, but adding a row on Enter is good UX
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentRowIndex - 1 >= 0) {
        const prevRow = rows[currentRowIndex - 1];
        const prevId = colId === 'name' ? `spreadsheet-name-${prevRow.id}` : `spreadsheet-cell-${prevRow.id}-${colId}`;
        document.getElementById(prevId)?.focus();
      }
    }
  };

  const transposeData = () => {
    if (rows.length === 0 && columns.length === 0) return;
    const newColumns = rows.map((r, i) => ({ id: r.id, name: r.name || `Row ${i+1}` }));
    const newRows = columns.map((c, i) => {
      const rowValues: Record<string, string> = {};
      rows.forEach(r => {
        rowValues[r.id] = r.values[c.id] || '';
      });
      return { id: c.id, name: c.name || `Col ${i+1}`, values: rowValues };
    });
    setColumns(newColumns);
    setRows(newRows);
  };

  return (
    <div className="h-full p-6 flex flex-col">
      <div className={cn("border rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden", isDark ? "border-white/5 bg-[#16161A]" : "border-slate-200 bg-white")}>
        <div className={cn("flex justify-between items-center p-4 border-b", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
          <div>
            <h2 className={cn("text-[11px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-600")}>{t.plateAnalysisSheet}</h2>
            <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>{t.renameColumns}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={transposeData}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition", isDark ? "text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10" : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-50")}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> {t.transpose}
            </button>
            <button
              onClick={addColumn}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition", isDark ? "text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10" : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-50")}
            >
              <Columns className="w-3.5 h-3.5" /> {t.addColumn}
            </button>
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> {t.addSampleRow}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="inline-block min-w-full align-middle">
            <table className={cn("min-w-full divide-y border rounded-md overflow-hidden table-fixed border-collapse", isDark ? "divide-white/10 border-white/10" : "divide-slate-200 border-slate-200")}>
              <thead className={cn("text-[10px] uppercase font-bold shadow-sm border-b", isDark ? "bg-black/20 text-slate-400 border-white/10" : "bg-slate-50 text-slate-500 border-slate-200")}>
                <tr>
                  <th className={cn("px-3 py-3 w-48 text-left border-r", isDark ? "border-white/10" : "border-slate-200")}>{t.sampleName}</th>
                  {columns.map(col => (
                    <th key={col.id} className={cn("px-3 py-2 border-r w-32 relative group", isDark ? "border-white/10" : "border-slate-200")}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => updateColumnName(col.id, e.target.value)}
                          className={cn("w-full bg-transparent font-bold border-b transition-colors px-1 py-1 focus:outline-none", isDark ? "border-transparent hover:border-white/20 focus:border-emerald-500 text-slate-300" : "border-transparent hover:border-slate-300 focus:border-emerald-600 text-slate-800")}
                        />
                        <button 
                          onClick={() => removeColumn(col.id)}
                          className={cn("opacity-0 group-hover:opacity-100 transition absolute right-2", isDark ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className={cn("bg-transparent divide-y font-mono text-xs", isDark ? "divide-white/5" : "divide-slate-200")}>
                {rows.map((row, rIdx) => (
                  <tr key={row.id} className={cn("transition-colors", isDark ? "hover:bg-white/5" : "hover:bg-slate-50")}>
                    <td className={cn("px-3 py-2 border-r", isDark ? "border-white/5" : "border-slate-200")}>
                      <input
                        id={`spreadsheet-name-${row.id}`}
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRowName(row.id, e.target.value)}
                        onPaste={(e) => handlePaste(e, row.id, 'name')}
                        onKeyDown={(e) => handleKeyDown(e, rIdx, 'name')}
                        placeholder={t.sampleName}
                        className={cn("w-full px-2 py-1.5 border hover:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-sans", isDark ? "border-transparent bg-transparent focus:bg-black/20 text-slate-300 placeholder:text-slate-600 hover:border-white/10" : "border-transparent bg-transparent focus:bg-white text-slate-800 placeholder:text-slate-400 hover:border-slate-200")}
                      />
                    </td>
                    {columns.map(col => (
                      <td key={col.id} className={cn("px-3 py-2 border-r", isDark ? "border-white/5" : "border-slate-200")}>
                        <input
                          id={`spreadsheet-cell-${row.id}-${col.id}`}
                          type="number"
                          step="any"
                          value={row.values[col.id] || ''}
                          onChange={(e) => updateCellValue(row.id, col.id, e.target.value)}
                          onPaste={(e) => handlePaste(e, row.id, col.id)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, col.id)}
                          placeholder="OD"
                          className={cn("w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono", isDark ? "border-transparent bg-transparent hover:border-white/10 focus:bg-black/20 text-slate-300 placeholder:text-slate-600" : "border-transparent bg-transparent hover:border-slate-200 focus:bg-white text-slate-800 placeholder:text-slate-400")}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        className={cn("p-1.5 rounded transition", isDark ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500")}
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
      </div>
    </div>
  );
}
