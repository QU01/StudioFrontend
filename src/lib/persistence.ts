import { fetchWithAuth, getAccessToken, DJANGO_API_BASE } from "./auth";

export interface DjangoPipeline {
  id: number;
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  created_at: string;
  updated_at: string;
}

export interface DjangoArchitecture {
  id: number;
  name: string;
  description?: string;
  config: { nodes: any[]; edges: any[]; inputShape?: number[] };
  created_at: string;
  updated_at: string;
}

export async function loadLatestPipeline(): Promise<DjangoPipeline | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await fetchWithAuth(`${DJANGO_API_BASE}/pipelines/`);
    if (!res.ok) return null;
    const list: DjangoPipeline[] = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];
  } catch {
    return null;
  }
}

export async function loadLatestArchitecture(): Promise<DjangoArchitecture | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await fetchWithAuth(`${DJANGO_API_BASE}/architectures/`);
    if (!res.ok) return null;
    const list: DjangoArchitecture[] = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];
  } catch {
    return null;
  }
}
