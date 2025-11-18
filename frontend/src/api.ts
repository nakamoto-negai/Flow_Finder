// APIリクエスト用のヘルパー関数

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token && userId) {
    headers['Authorization'] = token; // Bearer プレフィックスを除去
    headers['X-User-Id'] = userId;
  }
  
  return headers;
};

// FormData用の認証ヘッダー（Content-Typeなし）
export const getAuthHeadersForFormData = (): Record<string, string> => {
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  const headers: Record<string, string> = {};
  
  if (token && userId) {
    headers['Authorization'] = token; // Bearer プレフィックスを除去
    headers['X-User-Id'] = userId;
  }
  
  return headers;
};

export const apiRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const authHeaders = getAuthHeaders();
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  };
  
  const response = await fetch(url, config);
  
  // 認証エラーの場合はログアウト処理
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    window.location.reload();
  }
  
  return response;
};