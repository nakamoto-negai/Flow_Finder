// API設定
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// APIエンドポイントのヘルパー関数
export const getApiUrl = (endpoint: string): string => {
  // endpointが'/'で始まらない場合は追加
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

// よく使用するAPIエンドポイント
export const API_ENDPOINTS = {
  nodes: '/nodes',
  images: '/images',
  links: '/links',
  dijkstra: '/dijkstra',
  touristSpots: '/tourist-spots',
  favorites: '/favorites/tourist-spots',
  fields: '/fields',
  upload: '/upload',
  auth: '/auth',
} as const;