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
  console.log('🔍 getAuthHeadersForFormData 関数開始');
  
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  
  console.log('🗝️ getAuthHeadersForFormData - token:', token ? `${token.substring(0, 8)}...` : 'null');
  console.log('👤 getAuthHeadersForFormData - userId:', userId);
  
  const headers: Record<string, string> = {};
  
  if (token && userId) {
    headers['Authorization'] = token; // Bearer プレフィックスを除去
    headers['X-User-Id'] = userId;
    console.log('✅ getAuthHeadersForFormData - 作成されたヘッダー:', {
      Authorization: `${token.substring(0, 8)}...`,
      'X-User-Id': userId
    });
  } else {
    console.warn('⚠️ 認証情報が不完全です - token:', token ? 'あり' : 'なし', 'userId:', userId);
  }
  
  console.log('📤 getAuthHeadersForFormData 戻り値:', Object.keys(headers));
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