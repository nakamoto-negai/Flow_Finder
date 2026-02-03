import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "./config";

interface UserLog {
  id: number;
  user_id?: number;
  session_id: string;
  log_type: string;
  category: string;
  action: string;
  path: string;
  method: string;
  user_agent: string;
  ip_address: string;
  duration: number;
  error?: string;
  data?: string;
  referrer?: string;
  created_at: string;
}

interface LogStats {
  total_logs: number;
  unique_users: number;
  unique_sessions: number;
  page_views: number;
  actions: number;
  api_requests: number;
  errors: number;
}

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    logType: "",
    category: "",
    userId: "",
    action: "",
  });

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, limit, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.logType) params.append("log_type", filters.logType);
      if (filters.category) params.append("category", filters.category);
      if (filters.userId) params.append("user_id", filters.userId);
      if (filters.action) params.append("action", filters.action);

      const response = await fetch(`${API_BASE_URL}/api/logs?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logs/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* 統計情報 */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "15px",
            marginBottom: "30px",
          }}
        >
          {[
            { label: "総ログ件数", value: stats.total_logs },
            { label: "ユーザー数", value: stats.unique_users },
            { label: "セッション数", value: stats.unique_sessions },
            { label: "ページビュー", value: stats.page_views },
            { label: "アクション", value: stats.actions },
            { label: "API要求", value: stats.api_requests },
            { label: "エラー", value: stats.errors },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "15px",
                background: "white",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "5px" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#3b82f6" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* フィルター */}
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "15px" }}>フィルター</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
              ログタイプ
            </label>
            <select
              value={filters.logType}
              onChange={(e) => handleFilterChange("logType", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              <option value="">すべて</option>
              <option value="page_view">ページビュー</option>
              <option value="action">アクション</option>
              <option value="api_call">API呼び出し</option>
              <option value="error">エラー</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
              カテゴリー
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              <option value="">すべて</option>
              <option value="user">ユーザー</option>
              <option value="data">データ</option>
              <option value="system">システム</option>
              <option value="navigation">ナビゲーション</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
              ユーザーID
            </label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange("userId", e.target.value)}
              placeholder="ユーザーIDを入力"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
              アクション
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange("action", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              <option value="">すべて</option>
              <option value="favorite_list">お気に入り一覧</option>
            </select>
          </div>
        </div>
      </div>

      {/* ログテーブル */}
      <div
        style={{
          background: "white",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
            ロード中...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
            ログがありません
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      時刻
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      ユーザーID
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      ログタイプ
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      アクション
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      パス
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      ステータス
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        background: index % 2 === 0 ? "white" : "#f9fafb",
                      }}
                    >
                      <td style={{ padding: "12px" }}>
                        {new Date(log.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td style={{ padding: "12px" }}>{log.user_id || "-"}</td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "500",
                            background:
                              log.log_type === "error"
                                ? "#fee2e2"
                                : log.log_type === "page_view"
                                  ? "#dbeafe"
                                  : log.log_type === "action"
                                    ? "#dbeafe"
                                    : "#f0fdf4",
                            color:
                              log.log_type === "error"
                                ? "#dc2626"
                                : log.log_type === "page_view"
                                  ? "#2563eb"
                                  : log.log_type === "action"
                                    ? "#2563eb"
                                    : "#16a34a",
                          }}
                        >
                          {log.log_type}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>{log.action}
                        {/* お気に入り一覧ログの場合は観光地名を表示 */}
                        {log.action === "favorite_list" && log.data && (
                          <div style={{ fontSize: "12px", color: "#2563eb", marginTop: "4px" }}>
                            お気に入り: {(() => {
                              try {
                                const parsed = typeof log.data === "string" ? JSON.parse(log.data) : log.data;
                                return parsed.favorite_spots || log.data;
                              } catch {
                                return log.data;
                              }
                            })()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.path}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "500",
                            background: log.error ? "#fee2e2" : "#dcfce7",
                            color: log.error ? "#dc2626" : "#15803d",
                          }}
                        >
                          {log.error ? "エラー" : "成功"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            <div
              style={{
                padding: "15px",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                {page} / {totalPages} ページ（全 {total} 件）
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  <option value="10">10件</option>
                  <option value="20">20件</option>
                  <option value="50">50件</option>
                  <option value="100">100件</option>
                </select>

                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    background: page === 1 ? "#f3f4f6" : "white",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    fontSize: "14px",
                  }}
                >
                  前へ
                </button>

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    background: page === totalPages ? "#f3f4f6" : "white",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    fontSize: "14px",
                  }}
                >
                  次へ
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
