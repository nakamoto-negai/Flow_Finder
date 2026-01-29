
import { useState, useEffect } from 'react';
import MapView from './MapView';
import Admin from './Admin';
import DijkstraTestPage from './DijkstraTestPage';
import FavoriteTouristSpots from './FavoriteTouristSpots';
import MyPage from './MyPage';
import Header from './Header';
import Login from './Login';
import CategorySelector from './CategorySelector';
import TutorialViewer from './TutorialViewer';
// import TouristSpotDetail from './TouristSpotDetail'; // 管理者用
import TouristSpotDetailUser from './TouristSpotDetailUser';
import { logger } from './logger';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [userId, setUserId] = useState<number | null>(
    localStorage.getItem('userId') ? parseInt(localStorage.getItem('userId')!) : null
  );
  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);

  useEffect(() => {
    // ページビューログを送信
    logger.logPageView();
    
    // ページ離脱時のログ送信
    const handleBeforeUnload = () => {
      logger.logPageLeave();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
      
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [token]);

  // ログイン成功処理
  const handleLogin = (newToken: string, newUserId: number, isNewUser: boolean = false) => {
    setToken(newToken);
    setUserId(newUserId);

    // ログイン成功をログに記録
    logger.logLogin(newUserId);

    // 新規ユーザー登録直後であれば強制的にカテゴリー選択を表示
    if (isNewUser) {
      setShowCategorySelector(true);
      return;
    }

    // カテゴリー選択を今回のセッションで既に表示したかチェック
    const hasShownCategorySelector = sessionStorage.getItem('hasShownCategorySelector');
    if (!hasShownCategorySelector) {
      setShowCategorySelector(true);
    }
  };

  // カテゴリー選択完了処理
  const handleCategorySelectorComplete = (selectedCategories?: string[]) => {
    setShowCategorySelector(false);
    sessionStorage.setItem('hasShownCategorySelector', 'true');

    // カテゴリーが渡されたらチュートリアル画面へ遷移
    if (selectedCategories && selectedCategories.length > 0) {
      const csv = selectedCategories.map(c => encodeURIComponent(c)).join(',');
      window.location.href = `/tutorials?categories=${csv}`;
      return;
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    if (userId) {
      logger.logLogout();
    }
    setToken(null);
    setUserId(null);
    setShowCategorySelector(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    sessionStorage.removeItem('hasShownCategorySelector');
  };

  // 簡易ルーティング
  if (window.location.pathname === "/admin") {
    if (!token) {
      return <Login onLogin={handleLogin} />;
    }
    return <Admin />;
  }
  
  if (window.location.pathname === "/dijkstra") {
    return <DijkstraTestPage />;
  }

  if (window.location.pathname.startsWith('/tutorials')) {
    return <TutorialViewer />;
  }
  
  if (window.location.pathname === "/favorites") {
    if (!token) {
      return <Login onLogin={handleLogin} />;
    }
    return (
      <>
        <Header onLogout={handleLogout} />
        <FavoriteTouristSpots />
      </>
    );
  }

  if (window.location.pathname === "/mypage") {
    if (!token) {
      return <Login onLogin={handleLogin} />;
    }
    return <MyPage />;
  }

  if (window.location.pathname === "/category-selector") {
    if (!token) {
      return <Login onLogin={handleLogin} />;
    }
    return (
      <>
        <Header onLogout={handleLogout} />
        <CategorySelector onComplete={handleCategorySelectorComplete} />
      </>
    );
  }

  if (window.location.pathname.startsWith("/tourist-spot/")) {
    if (!token) {
      return <Login onLogin={handleLogin} />;
    }
    const spotId = parseInt(window.location.pathname.split("/tourist-spot/")[1]);
    return (
      <>
        <Header onLogout={handleLogout} />
        <TouristSpotDetailUser 
          spotId={spotId} 
          onBack={() => window.history.back()} 
        />
      </>
    );
  }

  return (
    <div className="App">
      {!token ? (
        <Login onLogin={handleLogin} />
      ) : showCategorySelector ? (
        <CategorySelector onComplete={handleCategorySelectorComplete} />
      ) : (
        <>
          <Header onLogout={handleLogout} />
          <MapView />
        </>
      )}
    </div>
  );
}

export default App;
