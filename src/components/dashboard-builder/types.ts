export type WidgetType = "PlotlyChart" | "MetricCard" | "DataTable" | "Markdown";

export interface WidgetBinding {
  run_id: number | null;
  node_id: string;
  field_path: string;
}

export interface Widget {
  id: string;
  type: WidgetType;
  binding: WidgetBinding;
  config: Record<string, unknown>;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardDef {
  id?: number;
  name: string;
  project?: number | null;
  layout: LayoutItem[];
  widgets: Widget[];
}

export interface NodeResultMap {
  [nodeId: string]: Record<string, unknown>;
}

export interface RunSummary {
  id: number;
  pipeline: number | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  results: NodeResultMap;
}
