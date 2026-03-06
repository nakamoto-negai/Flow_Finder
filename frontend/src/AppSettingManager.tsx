import React, { useEffect, useState } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

const AppSettingManager: React.FC = () => {
  const [stampUrl, setStampUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/settings/stamp_app_url'))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.value) setStampUrl(d.value); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(getApiUrl('/settings/stamp_app_url'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: stampUrl }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '保存しました' });
      } else {
        setMessage({ type: 'error', text: '保存に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: '通信エラーが発生しました' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 24, color: '#1e293b' }}>アプリ設定</h2>

      <div style={{ background: 'white', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8, color: '#374151' }}>
          スタンプアプリURL
        </label>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          ヘッダーの「スタンプ」ボタンをクリックしたときに開くURLを設定します。
        </p>
        <input
          type="url"
          value={stampUrl}
          onChange={e => setStampUrl(e.target.value)}
          placeholder="https://example.com/stamp"
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
            borderRadius: 6, fontSize: 14, boxSizing: 'border-box', marginBottom: 16,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px', background: saving ? '#93c5fd' : '#3b82f6',
            color: 'white', border: 'none', borderRadius: 6, fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>

        {message && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 6, fontSize: 14,
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
          }}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppSettingManager;
