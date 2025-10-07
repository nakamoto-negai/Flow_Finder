// ログ送信のためのユーティリティクラス
export class Logger {
  private static instance: Logger;
  public sessionId: string;
  private userId: number;
  private pageStartTime: number;
  private lastLoggedPath: string = '';
  private lastLoggedTime: number = 0;

  private constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.userId = this.getUserId();
    this.pageStartTime = Date.now();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // セッションIDの取得または生成
  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  // ユーザーIDを取得
  private getUserId(): number {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId, 10) : 0;
  }

  // セッションIDを生成
  private generateSessionId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ユーザーIDを更新（ログイン時など）
  updateUserId(userId: number): void {
    this.userId = userId;
  }

  // セッションIDを更新
  updateSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    sessionStorage.setItem('session_id', sessionId);
  }

  // ログを送信する共通メソッド
  private async sendLog(logData: {
    log_type: string;
    category: string;
    action: string;
    path?: string;
    duration?: number;
    data?: string;
    referrer?: string;
  }): Promise<void> {
    try {
      const response = await fetch('http://localhost:8080/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.sessionId,
        },
        body: JSON.stringify({
          user_id: this.userId,
          session_id: this.sessionId,
          referrer: document.referrer,
          ...logData,
        }),
      });

      if (!response.ok) {
        console.warn('ログ送信に失敗しました:', response.statusText);
      } else {
        const result = await response.json();
        // サーバーから返されたセッションIDを更新
        if (result.session_id && result.session_id !== this.sessionId) {
          this.updateSessionId(result.session_id);
        }
      }
    } catch (error) {
      console.warn('ログ送信エラー:', error);
    }
  }

  // ページビューログ（重複を避ける）
  logPageView(path: string = window.location.pathname): void {
    const currentTime = Date.now();
    
    // 同一パスでの短時間内（5秒以内）の重複ログを避ける
    if (this.lastLoggedPath === path && (currentTime - this.lastLoggedTime) < 5000) {
      console.debug('重複ページビューログをスキップ:', path);
      return;
    }
    
    this.pageStartTime = currentTime;
    this.lastLoggedPath = path;
    this.lastLoggedTime = currentTime;
    
    this.sendLog({
      log_type: 'page_view',
      category: 'navigation',
      action: 'page_view',
      path,
    });
  }

  // ページ離脱ログ（滞在時間付き）
  logPageLeave(path: string = window.location.pathname): void {
    const duration = Date.now() - this.pageStartTime;
    this.sendLog({
      log_type: 'page_view',
      category: 'navigation',
      action: 'page_leave',
      path,
      duration,
    });
  }

  // ユーザーアクションログ
  logAction(action: string, category: string = 'interaction', data?: any): void {
    this.sendLog({
      log_type: 'action',
      category,
      action,
      path: window.location.pathname,
      data: data ? JSON.stringify(data) : undefined,
    });
  }

  // ログインログ
  logLogin(userId: number): void {
    this.updateUserId(userId);
    this.sendLog({
      log_type: 'action',
      category: 'auth',
      action: 'login',
      path: window.location.pathname,
    });
  }

  // ログアウトログ
  logLogout(): void {
    this.sendLog({
      log_type: 'action',
      category: 'auth',
      action: 'logout',
      path: window.location.pathname,
    });
    this.updateUserId(0);
  }

  // ノード選択ログ
  logNodeSelect(nodeId: number, nodeName: string): void {
    this.sendLog({
      log_type: 'action',
      category: 'map',
      action: 'node_select',
      path: window.location.pathname,
      data: JSON.stringify({ nodeId, nodeName }),
    });
  }

  // リンク移動ログ
  logLinkMove(linkId: number, fromNode: string, toNode: string): void {
    this.sendLog({
      log_type: 'action',
      category: 'navigation',
      action: 'link_move',
      path: window.location.pathname,
      data: JSON.stringify({ linkId, fromNode, toNode }),
    });
  }

  // 画像表示ログ
  logImageView(imageId: number, imageUrl: string): void {
    this.sendLog({
      log_type: 'action',
      category: 'interaction',
      action: 'image_view',
      path: window.location.pathname,
      data: JSON.stringify({ imageId, imageUrl }),
    });
  }

  // フォーム送信ログ
  logFormSubmit(formType: string, success: boolean = true): void {
    this.sendLog({
      log_type: 'action',
      category: 'interaction',
      action: 'form_submit',
      path: window.location.pathname,
      data: JSON.stringify({ formType, success }),
    });
  }

  // エラーログ
  logError(error: string, context?: string): void {
    this.sendLog({
      log_type: 'error',
      category: 'system',
      action: 'error',
      path: window.location.pathname,
      data: JSON.stringify({ error, context }),
    });
  }

  // 地図インタラクションログ
  logMapInteraction(interactionType: string, data?: any): void {
    this.sendLog({
      log_type: 'action',
      category: 'map',
      action: 'map_interact',
      path: window.location.pathname,
      data: JSON.stringify({ interactionType, ...data }),
    });
  }
}

// グローバルロガーインスタンス
export const logger = Logger.getInstance();