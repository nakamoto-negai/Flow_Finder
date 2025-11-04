// 共通の型定義

export interface Node {
  id: number;
  name: string;
  x: number;
  y: number;
  congestion: number;
  tourist: boolean;
  field_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Field {
  id: number;
  name: string;
  description: string;
  image_url: string;
  width: number;
  height: number;
  is_active: boolean;
}

export interface Link {
  id: number;
  from_node_id: number;
  to_node_id: number;
  distance: number;
  weight: number;
  is_directed: boolean;
}