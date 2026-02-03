import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "./config";

interface ChangeHistory {
  id: number;
  table_name: string;
  record_id: string;
  user_id?: number;
  operation: string;
  before: string;
  after: string;
  created_at: string;
}

interface ChangeHistoryStats {
  total_changes: number;
  creates: number;
  updates: number;
  deletes: number;
  unique_users: number;
  unique_tables: number;
}

const ChangeHistoryViewer: React.FC = () => {
  const [histories, setHistories] = useState<ChangeHistory[]>([]);
  const [stats, setStats] = useState<ChangeHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    tableName: "",
    operation: "",
    userId: "",
  });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    fetchHistories();
    fetchStats();
  }, [page, limit, filters]);

  const fetchHistories = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.tableName) params.append("table_name", filters.tableName);
      if (filters.operation) params.append("operation", filters.operation);
      if (filters.userId) params.append("user_id", filters.userId);

      const response = await fetch(`${API_BASE_URL}/api/change-history?${params}`);
      const data = await response.json();

      setHistories(data.histories || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch change history:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/change-history/stats`);
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

  const formatJSON = (jsonStr: string) => {
    if (!jsonStr) return "データなし";
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonStr;
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
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
            { label: "総変更数", value: stats.total_changes, color: "#3b82f6" },
            { label: "作成", value: stats.creates, color: "#10b981" },
            { label: "更新", value: stats.updates, color: "#f59e0b" },
            { label: "削除", value: stats.deletes, color: "#ef4444" },
            { label: "ユーザー数", value: stats.unique_users, color: "#8b5cf6" },
            { label: "テーブル数", value: stats.unique_tables, color: "#ec4899" },
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
              <div style={{ fontSize: "20px", fontWeight: "bold", color: stat.color }}>
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
              テーブル名
            </label>
            <select
              value={filters.tableName}
              onChange={(e) => handleFilterChange("tableName", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              <option value="">すべて</option>
              <option value="tourist_spots">観光地</option>
              <option value="nodes">ノード</option>
              <option value="links">リンク</option>
              <option value="users">ユーザー</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
              操作種別
            </label>
            <select
              value={filters.operation}
              onChange={(e) => handleFilterChange("operation", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              <option value="">すべて</option>
              <option value="create">作成</option>
              <option value="update">更新</option>
              <option value="delete">削除</option>
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
        </div>
      </div>

      {/* 変更履歴テーブル */}
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
        ) : histories.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
            変更履歴がありません
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
                      テーブル
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      レコードID
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      ユーザーID
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      操作
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                      詳細
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map((history, index) => (
                    <React.Fragment key={history.id}>
                      <tr
                        style={{
                          borderBottom: "1px solid #e5e7eb",
                          background: index % 2 === 0 ? "white" : "#f9fafb",
                        }}
                      >
                        <td style={{ padding: "12px" }}>
                          {new Date(history.created_at).toLocaleString("ja-JP")}
                        </td>
                        <td style={{ padding: "12px", fontWeight: "500" }}>
                          {history.table_name}
                        </td>
                        <td style={{ padding: "12px" }}>{history.record_id}</td>
                        <td style={{ padding: "12px" }}>{history.user_id || "-"}</td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "500",
                              background:
                                history.operation === "create"
                                  ? "#d1fae5"
                                  : history.operation === "update"
                                    ? "#fef3c7"
                                    : "#fee2e2",
                              color:
                                history.operation === "create"
                                  ? "#065f46"
                                  : history.operation === "update"
                                    ? "#92400e"
                                    : "#991b1b",
                            }}
                          >
                            {history.operation === "create" ? "作成" : history.operation === "update" ? "更新" : "削除"}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <button
                            onClick={() => toggleRow(history.id)}
                            style={{
                              padding: "4px 12px",
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            {expandedRow === history.id ? "閉じる" : "表示"}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === history.id && (
                        <tr style={{ background: "#f9fafb" }}>
                          <td colSpan={6} style={{ padding: "20px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                              <div>
                                <h4 style={{ margin: "0 0 10px 0", color: "#dc2626" }}>変更前</h4>
                                <pre
                                  style={{
                                    background: "#fff",
                                    padding: "12px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    overflow: "auto",
                                    maxHeight: "300px",
                                    border: "1px solid #e5e7eb",
                                  }}
                                >
                                  {formatJSON(history.before)}
                                </pre>
                              </div>
                              <div>
                                <h4 style={{ margin: "0 0 10px 0", color: "#059669" }}>変更後</h4>
                                <pre
                                  style={{
                                    background: "#fff",
                                    padding: "12px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    overflow: "auto",
                                    maxHeight: "300px",
                                    border: "1px solid #e5e7eb",
                                  }}
                                >
                                  {formatJSON(history.after)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

export default ChangeHistoryViewer;
