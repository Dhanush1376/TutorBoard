import React, { useState, useMemo, useCallback } from 'react';

/**
 * Parses markdown table or JSON array into structured data.
 */
const parseTableData = (content) => {
  if (!content) return { headers: [], rows: [] };

  // Try JSON first
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const headers = Object.keys(parsed[0]);
      const rows = parsed.map(item => headers.map(h => String(item[h] ?? '')));
      return { headers, rows, isJson: true };
    }
  } catch (e) {
    // Not JSON, try markdown
  }

  // Parse markdown table
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    // Remove leading and trailing pipes if they exist
    const cleanLine = line.trim().replace(/^\||\|$/g, '');
    return cleanLine.split('|').map(cell => cell.trim());
  };

  const headers = parseRow(lines[0]);
  // Skip separator row (if it exists: ---|----|---)
  const startIdx = lines[1]?.match(/^[\s|:-]+$/) ? 2 : 1;
  const rows = lines.slice(startIdx).map(parseRow).filter(row => row.length === headers.length);

  return { headers, rows, isJson: false };
};

const TableRenderer = ({ content, onContentChange, isDark }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [editCell, setEditCell] = useState(null); // { row, col }
  const [editValue, setEditValue] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const { headers, rows } = useMemo(() => parseTableData(content), [content]);

  const sortedRows = useMemo(() => {
    if (sortColumn === null) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortColumn, sortDirection]);

  const handleSort = (colIdx) => {
    if (sortColumn === colIdx) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colIdx);
      setSortDirection('asc');
    }
  };

  const handleCellDoubleClick = (rowIdx, colIdx) => {
    setEditCell({ row: rowIdx, col: colIdx });
    setEditValue(sortedRows[rowIdx]?.[colIdx] || '');
  };

  const handleCellSave = useCallback(() => {
    if (!editCell) return;
    const newRows = [...rows];
    // Find the original row index (sortedRows may reorder)
    const originalRow = sortedRows[editCell.row];
    const origIdx = rows.findIndex(r => r === originalRow);
    if (origIdx >= 0) {
      newRows[origIdx] = [...newRows[origIdx]];
      newRows[origIdx][editCell.col] = editValue;

      // Rebuild markdown table
      const headerLine = '| ' + headers.join(' | ') + ' |';
      const sepLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
      const bodyLines = newRows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
      onContentChange?.(`${headerLine}\n${sepLine}\n${bodyLines}`);
    }
    setEditCell(null);
  }, [editCell, editValue, rows, sortedRows, headers, onContentChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, [content]);

  if (headers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-sm">
        No table data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {rows.length} rows · {headers.length} columns · Double-click to edit
        </span>
        <button
          onClick={handleCopy}
          className="px-2 py-0.5 text-[10px] rounded border border-[var(--border-color)]/30 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          {isCopied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[12.5px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)] cursor-pointer select-none hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {header}
                    {sortColumn === i && (
                      <span className="text-[9px] opacity-60">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                    className="px-3 py-2 border-b border-[var(--border-color)]/15 cursor-default"
                  >
                    {editCell?.row === rowIdx && editCell?.col === colIdx ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--text-primary)]/30 rounded px-1.5 py-0.5 text-[12px] outline-none"
                      />
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableRenderer;
