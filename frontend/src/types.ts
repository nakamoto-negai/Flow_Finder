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

export interface TouristSpot {
  id: number;
  name: string;
  description: string;
  category: string;
  nearest_node_id?: number;
  distance_to_nearest_node: number;
  x: number;
  y: number;
  max_capacity: number;
  current_count: number;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
  entry_fee: number;
  website: string;
  phone_number: string;
  image_url: string;
  rating: number;
  review_count: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

export interface UserFavoriteTouristSpot {
  id: number;
  user_id: number;
  tourist_spot_id: number;
  tourist_spot: TouristSpot;
  added_at: string;
  notes: string;
  priority: number;
  visit_status: '未訪問' | '訪問予定' | '訪問済み';
  visit_date?: string;
  created_at: string;
  updated_at: string;
}

export interface FavoriteStats {
  total_count: number;
  visited_count: number;
  planned_count: number;
  not_visited_count: number;
  visited_rate: number;
}