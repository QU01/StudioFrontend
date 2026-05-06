"use client";

import { useRef, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import type { ProfileResponse, ColumnProfile, PreviewResponse } from "@/lib/api";
import { ArrowUpDown, ArrowUp, ArrowDown, BarChart2, RefreshCw } from "lucide-react";

// Plotly is large — load client-side only
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function dtypeColor(dtype: string): string {
  if (dtype.includes("int")) return "#007bff";
  if (dtype.includes("float")) return "#17C2D7";
  if (dtype === "bool") return "#28a745";
  if (dtype.includes("datetime")) return "#9367B4";
  return "#F39C12";
}

function DtypeBadge({ dtype }: { dtype: string }) {
  const color = dtypeColor(dtype);
  return (
    <span
      className="inline-block text-[9px] font-bold uppercase tracking-widest rounded px-1 py-0.5 ml-1.5"
      style={{
        color,
        border: `1px solid ${color}`,
        opacity: 0.9,
      }}
    >
      {dtype}
    </span>
  );
}

function KpiCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="bg-[#222a35] border border-white/5 rounded-xl p-4 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "22" }}
      >
        <BarChart2 size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-white text-2xl font-bold leading-none">{value}</div>
        <div className="text-white/50 text-[12px] mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function StatsPanel({
  col,
  profile,
}: {
  col: ColumnProfile | null;
  profile: ProfileResponse;
}) {
  if (!col) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-2 p-6 text-center">
        <BarChart2 size={32} className="opacity-30" />
        Click a column header to see statistics
      </div>
    );
  }

  const isNumeric = col.histogram != null;
  const nullPct = col.count + col.nulls > 0
    ? ((col.nulls / (col.count + col.nulls)) * 100).toFixed(1)
    : "0.0";

  // Build Plotly histogram data from bin edges
  const histData = useMemo(() => {
    if (!col.histogram) return null;
    const { counts, edges } = col.histogram;
    const midpoints = edges.slice(0, -1).map((e, i) => (e + edges[i + 1]) / 2);
    return { x: midpoints, y: counts };
  }, [col]);

  const top5 = col.top5 ? Object.entries(col.top5) : [];
  const maxTop5 = top5.length > 0 ? Math.max(...top5.map(([, v]) => v)) : 1;

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full custom-scrollbar">
      {/* Column header */}
      <div>
        <div className="text-white font-semibold text-sm truncate">{col.name}</div>
        <DtypeBadge dtype={col.dtype} />
      </div>

      {/* KPI mini-grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Count", value: col.count.toLocaleString() },
          { label: "Nulls", value: `${col.nulls} (${nullPct}%)` },
          { label: "Unique", value: col.unique.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-white text-sm font-bold">{value}</div>
            <div className="text-white/40 text-[10px] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Numeric stats */}
      {isNumeric && col.mean != null && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Mean", value: col.mean?.toFixed(4) },
            { label: "Std", value: col.std?.toFixed(4) },
            { label: "Min", value: col.min?.toFixed(4) },
            { label: "Max", value: col.max?.toFixed(4) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1a2030] rounded-lg p-2">
              <div className="text-[#17C2D7] text-xs font-bold font-mono">{value}</div>
              <div className="text-white/40 text-[10px]">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Plotly histogram */}
      {isNumeric && histData && (
        <div className="rounded-lg overflow-hidden">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">
            Distribution
          </div>
          <Plot
            data={[
              {
                type: "bar",
                x: histData.x,
                y: histData.y,
                marker: { color: "#007bff", opacity: 0.8 },
              },
            ]}
            layout={{
              height: 160,
              margin: { t: 4, b: 28, l: 36, r: 4 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#1a2030",
              font: { color: "rgba(255,255,255,0.4)", size: 9 },
              xaxis: { gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
              yaxis: { gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Categorical top-5 */}
      {!isNumeric && top5.length > 0 && (
        <div>
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2 font-bold">
            Top Values
          </div>
          <div className="flex flex-col gap-1.5">
            {top5.map(([val, count]) => (
              <div key={val}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-white/80 truncate max-w-[60%]">{val}</span>
                  <span className="text-white/40">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxTop5) * 100}%`,
                      backgroundColor: "#F39C12",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface DataExplorerProps {
  preview: PreviewResponse;
  profile: ProfileResponse;
}

export function DataExplorer({ preview, profile }: DataExplorerProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedColName, setSelectedColName] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const selectedCol = useMemo(
    () => profile.columns.find((c) => c.name === selectedColName) ?? null,
    [profile.columns, selectedColName]
  );

  const numericCount = profile.columns.filter((c) => c.histogram != null).length;

  // Build TanStack columns from schema
  const columnHelper = createColumnHelper<Record<string, unknown>>();
  const columns = useMemo(
    () =>
      preview.schema.map((col) =>
        columnHelper.accessor((row) => row[col.name], {
          id: col.name,
          header: col.name,
          cell: (info) => {
            const val = info.getValue();
            if (val === null || val === undefined) {
              return <span className="text-white/20 italic text-[11px]">null</span>;
            }
            return <span className="text-white/80">{String(val)}</span>;
          },
          enableSorting: true,
        })
      ),
    [preview.schema]
  );

  const table = useReactTable({
    data: preview.rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="flex flex-col h-full bg-[#181d23] p-4 md:p-6 gap-5">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <KpiCard value={profile.rows.toLocaleString()} label="Total Rows" color="#007bff" />
        <KpiCard value={String(profile.col_count)} label="Columns" color="#17C2D7" />
        <KpiCard value={String(numericCount)} label="Numeric Columns" color="#9367B4" />
        <KpiCard value={`${profile.pct_missing}%`} label="Missing Values" color="#F39C12" />
      </div>

      {/* Main area: table + stats panel */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Table */}
        <div className="flex-1 bg-[#222a35] border border-white/5 rounded-xl overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="text-[13px] font-semibold text-white/80">
              {profile.filename}
            </div>
            <div className="text-[11px] text-white/40">
              Showing {preview.rows.length} of {preview.total_rows.toLocaleString()} rows
            </div>
          </div>

          <div
            ref={tableContainerRef}
            className="overflow-auto flex-1 custom-scrollbar"
          >
            <table className="w-full text-[13px] border-collapse" style={{ minWidth: "max-content" }}>
              <thead className="sticky top-0 z-10 bg-[#1a2030]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const col = preview.schema.find((s) => s.name === header.id);
                      const isSorted = header.column.getIsSorted();
                      const isSelected = selectedColName === header.id;
                      return (
                        <th
                          key={header.id}
                          className="px-3 py-2.5 text-left font-semibold text-white/70 border-b border-white/10 whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors"
                          style={{
                            borderBottom: isSelected
                              ? "2px solid #007bff"
                              : "1px solid rgba(255,255,255,0.08)",
                          }}
                          onClick={() => {
                            setSelectedColName(header.id);
                            header.column.toggleSorting();
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {col && <DtypeBadge dtype={col.dtype} />}
                            <span className="ml-1 text-white/30">
                              {isSorted === "asc" ? (
                                <ArrowUp size={11} />
                              ) : isSorted === "desc" ? (
                                <ArrowDown size={11} />
                              ) : (
                                <ArrowUpDown size={11} />
                              )}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: paddingTop }} colSpan={columns.length} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: paddingBottom }} colSpan={columns.length} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="w-[280px] shrink-0 bg-[#222a35] border border-white/5 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 shrink-0">
            <div className="text-[13px] font-semibold text-white/80">Column Statistics</div>
          </div>
          <div className="flex-1 min-h-0">
            <StatsPanel col={selectedCol} profile={profile} />
          </div>
        </div>

      </div>
    </div>
  );
}
