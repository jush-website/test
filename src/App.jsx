import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
  deleteDoc, doc, updateDoc, getDoc, setDoc 
} from 'firebase/firestore';

// 初始化 Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCyiy4q9kzacnAaB-oURmXe00tRZ_ocf7M",
  authDomain: "test-ff8f4.firebaseapp.com",
  projectId: "test-ff8f4",
  storageBucket: "test-ff8f4.firebasestorage.app",
  messagingSenderId: "265340130264",
  appId: "1:265340130264:web:9f6ef17b118d0b455258ad",
  measurementId: "G-6Q5L31J9PK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'settings'
  
  // 資料狀態
  const [transactions, setTransactions] = useState([]);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 表單狀態
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '',
    amount: '',
    note: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [formMessage, setFormMessage] = useState({ text: '', type: '' });

  // 設定頁面狀態
  const [newPassword, setNewPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState({ text: '', type: '' });

  // 1. 初始化應用程式與檢查登入狀態
  useEffect(() => {
    const initApp = async () => {
      try {
        // 確保設定檔中存在密碼，若無則預設為 1234
        const authDocRef = doc(db, "settings", "auth");
        const authDoc = await getDoc(authDocRef);
        if (!authDoc.exists()) {
          await setDoc(authDocRef, { password: "1234" });
        }

        // 檢查 LocalStorage 登入狀態
        const isAuth = localStorage.getItem('accounting_isAuth') === 'true';
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error("初始化失敗:", error);
      } finally {
        // 只有未登入時才在此關閉 loading，登入的話由資料監聽器關閉
        if (!(localStorage.getItem('accounting_isAuth') === 'true')) {
          setIsLoading(false);
        }
      }
    };
    initApp();
  }, []);

  // 2. 登入後監聽資料庫變化
  useEffect(() => {
    let unsubscribe = () => {};
    
    if (isAuthenticated) {
      setIsLoading(true);
      const q = query(collection(db, "transactions"), orderBy("date", "desc"));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTransactions(data);
        setIsLoading(false);
      }, (error) => {
        console.error("讀取資料失敗:", error);
        setIsLoading(false);
      });
    }

    return () => unsubscribe();
  }, [isAuthenticated]);

  // 登入處理
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const authDoc = await getDoc(doc(db, "settings", "auth"));
      const currentPassword = authDoc.data().password;
      
      if (loginPassword === currentPassword) {
        localStorage.setItem('accounting_isAuth', 'true');
        setIsAuthenticated(true);
      } else {
        setLoginError('密碼錯誤，請重新輸入。');
      }
    } catch (error) {
      setLoginError('系統發生錯誤，無法驗證密碼。');
    }
    setIsLoading(false);
  };

  // 登出處理
  const handleLogout = () => {
    localStorage.removeItem('accounting_isAuth');
    setIsAuthenticated(false);
    setCurrentView('dashboard');
  };

  // 表單輸入處理
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 提交記帳表單
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) {
      showMessage(setFormMessage, '分類與金額為必填欄位', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        timestamp: new Date().getTime()
      };

      if (editingId) {
        await updateDoc(doc(db, "transactions", editingId), payload);
        showMessage(setFormMessage, '更新成功', 'success');
        setEditingId(null);
      } else {
        await addDoc(collection(db, "transactions"), payload);
        showMessage(setFormMessage, '新增成功', 'success');
      }
      
      // 重置部分表單
      setFormData(prev => ({ ...prev, category: '', amount: '', note: '' }));
    } catch (error) {
      console.error(error);
      showMessage(setFormMessage, '儲存失敗，請重試', 'error');
    }
    setIsLoading(false);
  };

  // 編輯記錄
  const handleEdit = (transaction) => {
    setFormData({
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      note: transaction.note || ''
    });
    setEditingId(transaction.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 刪除記錄
  const handleDelete = async (id) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "transactions", id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      showMessage(setFormMessage, '刪除失敗', 'error');
    }
    setIsLoading(false);
  };

  // 更新密碼
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      showMessage(setSettingsMessage, '新密碼至少需 4 個字元', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await updateDoc(doc(db, "settings", "auth"), { password: newPassword });
      showMessage(setSettingsMessage, '密碼更新成功！', 'success');
      setNewPassword('');
    } catch (error) {
      showMessage(setSettingsMessage, '密碼更新失敗', 'error');
    }
    setIsLoading(false);
  };

  // 共用顯示訊息工具
  const showMessage = (setter, text, type) => {
    setter({ text, type });
    setTimeout(() => setter({ text: '', type: '' }), 3000);
  };

  // 統計計算
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <>
      {/* 內嵌樣式定義區 */}
      <style>{`
        :root {
          --primary: #3b82f6;     /* 藍色 */
          --success: #10b981;     /* 綠色 */
          --danger: #ef4444;      /* 紅色 */
          --bg-color: #f3f4f6;
          --card-bg: #ffffff;
          --text-main: #1f2937;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-main);
          box-sizing: border-box;
        }
        
        * {
          box-sizing: inherit;
        }

        /* 全螢幕載入遮罩 */
        .loading-mask {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid var(--border-color);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* 登入畫面 - 絕對置中 */
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }

        .card {
          background-color: var(--card-bg);
          border-radius: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          padding: 32px;
          width: 100%;
        }

        .login-card {
          max-width: 400px;
          text-align: center;
        }

        /* 系統主要容器 */
        .app-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 16px;
        }

        /* 導覽列 */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .nav-brand {
          font-size: 1.5rem;
          font-weight: bold;
          color: var(--primary);
          margin: 0;
        }

        .nav-menu {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        /* 統計看板 */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          padding: 24px;
          border-radius: 16px;
          background: var(--card-bg);
          box-shadow: 0 4px 6px rgba(0,0,0,0.03);
          text-align: center;
          border-top: 4px solid transparent;
        }

        .stat-card.income { border-top-color: var(--success); }
        .stat-card.expense { border-top-color: var(--danger); }
        .stat-card.balance { border-top-color: var(--primary); }

        .stat-title {
          font-size: 0.95rem;
          color: var(--text-muted);
          margin-bottom: 8px;
          font-weight: 500;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
        }
        
        .text-success { color: var(--success); }
        .text-danger { color: var(--danger); }
        .text-primary { color: var(--primary); }

        /* 表單與列表 */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
        }

        .form-group label {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .form-control {
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: #fafafa;
        }

        .form-control:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          background: #fff;
        }

        /* 按鈕樣式 */
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
          text-align: center;
        }

        .btn:active { transform: scale(0.98); }
        
        .btn-primary { background-color: var(--primary); color: white; }
        .btn-primary:hover { background-color: #2563eb; }
        
        .btn-danger { background-color: var(--danger); color: white; }
        .btn-danger:hover { background-color: #dc2626; }
        
        .btn-outline { background-color: transparent; border: 1px solid var(--border-color); color: var(--text-main); }
        .btn-outline:hover { background-color: #f9fafb; }
        
        .btn-sm { padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; }
        .btn-block { width: 100%; }

        /* 列表樣式 */
        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 32px;
          margin-bottom: 16px;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 8px;
        }

        .transaction-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--card-bg);
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          transition: transform 0.2s;
        }

        .transaction-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }

        .t-left { display: flex; flex-direction: column; gap: 4px; }
        .t-date { font-size: 0.85rem; color: var(--text-muted); }
        .t-cat { font-weight: 600; font-size: 1.1rem; }
        .t-note { font-size: 0.9rem; color: var(--text-muted); }
        
        .t-right { display: flex; align-items: center; gap: 16px; }
        .t-amount { font-size: 1.25rem; font-weight: 700; }
        .t-actions { display: flex; gap: 8px; }

        /* 訊息提示 */
        .message-box {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 0.95rem;
          font-weight: 500;
          text-align: center;
        }
        .msg-error { background-color: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
        .msg-success { background-color: #ecfdf5; color: var(--success); border: 1px solid #a7f3d0; }

        @media (max-width: 600px) {
          .transaction-item { flex-direction: column; align-items: flex-start; gap: 12px; }
          .t-right { width: 100%; justify-content: space-between; }
        }
      `}</style>

      {/* 系統載入中遮罩 */}
      {isLoading && (
        <div className="loading-mask">
          <div className="spinner"></div>
          <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>系統載入中...</div>
        </div>
      )}

      {/* 尚未登入：顯示登入畫面 */}
      {!isAuthenticated && !isLoading && (
        <div className="login-container">
          <div className="card login-card">
            <h2 style={{ marginBottom: '8px', color: 'var(--primary)' }}>簡易記帳系統</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>請輸入管理員密碼以繼續 (預設: 1234)</p>
            
            {loginError && <div className="message-box msg-error">{loginError}</div>}
            
            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <input
                  type="password"
                  className="form-control"
                  placeholder="請輸入密碼"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                登入系統
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 已登入：顯示主系統介面 */}
      {isAuthenticated && (
        <div className="app-container">
          {/* 導覽列 */}
          <header className="header">
            <h1 className="nav-brand">記帳系統</h1>
            <div className="nav-menu">
              <button 
                className={`btn btn-sm ${currentView === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCurrentView('dashboard')}
              >
                記帳看板
              </button>
              <button 
                className={`btn btn-sm ${currentView === 'settings' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCurrentView('settings')}
              >
                系統設定
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleLogout}>
                登出
              </button>
            </div>
          </header>

          {/* 視圖：記帳看板 */}
          {currentView === 'dashboard' && (
            <>
              {/* 統計看板 */}
              <div className="stats-grid">
                <div className="stat-card income">
                  <div className="stat-title">總收入</div>
                  <div className="stat-value text-success">${totalIncome.toLocaleString()}</div>
                </div>
                <div className="stat-card expense">
                  <div className="stat-title">總支出</div>
                  <div className="stat-value text-danger">${totalExpense.toLocaleString()}</div>
                </div>
                <div className="stat-card balance">
                  <div className="stat-title">目前結餘</div>
                  <div className="stat-value text-primary">${balance.toLocaleString()}</div>
                </div>
              </div>

              {/* 新增/編輯表單 */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
                  {editingId ? '編輯收支紀錄' : '新增收支紀錄'}
                </h3>
                
                {formMessage.text && (
                  <div className={`message-box msg-${formMessage.type}`}>
                    {formMessage.text}
                  </div>
                )}

                <form onSubmit={handleSubmitTransaction}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>日期</label>
                      <input 
                        type="date" className="form-control" name="date" 
                        value={formData.date} onChange={handleInputChange} required 
                      />
                    </div>
                    <div className="form-group">
                      <label>類型</label>
                      <select 
                        className="form-control" name="type" 
                        value={formData.type} onChange={handleInputChange}
                      >
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>分類 (如: 飲食, 薪水)</label>
                      <input 
                        type="text" className="form-control" name="category" 
                        value={formData.category} onChange={handleInputChange} 
                        placeholder="請輸入分類" required 
                      />
                    </div>
                    <div className="form-group">
                      <label>金額</label>
                      <input 
                        type="number" className="form-control" name="amount" min="1"
                        value={formData.amount} onChange={handleInputChange} 
                        placeholder="0" required 
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>備註 (選填)</label>
                    <input 
                      type="text" className="form-control" name="note" 
                      value={formData.note} onChange={handleInputChange} 
                      placeholder="填寫備註細節..." 
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    {editingId && (
                      <button 
                        type="button" 
                        className="btn btn-outline" 
                        onClick={() => {
                          setEditingId(null);
                          setFormData({ ...formData, category: '', amount: '', note: '' });
                        }}
                      >
                        取消編輯
                      </button>
                    )}
                    <button type="submit" className="btn btn-primary">
                      {editingId ? '儲存變更' : '新增紀錄'}
                    </button>
                  </div>
                </form>
              </div>

              {/* 收支明細列表 */}
              <div className="list-header">
                <h3 style={{ margin: 0 }}>收支明細</h3>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  共 {transactions.length} 筆紀錄
                </span>
              </div>

              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  目前尚無任何收支紀錄。
                </div>
              ) : (
                <div className="transaction-list">
                  {transactions.map(t => (
                    <div className="transaction-item" key={t.id}>
                      <div className="t-left">
                        <span className="t-date">{t.date}</span>
                        <span className="t-cat">{t.category}</span>
                        {t.note && <span className="t-note">{t.note}</span>}
                      </div>
                      
                      <div className="t-right">
                        <span className={`t-amount ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                          {t.type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                        </span>
                        
                        <div className="t-actions">
                          {deleteConfirmId === t.id ? (
                            <>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>
                                確認刪除
                              </button>
                              <button className="btn btn-sm btn-outline" onClick={() => setDeleteConfirmId(null)}>
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-sm btn-outline" onClick={() => handleEdit(t)}>
                                編輯
                              </button>
                              <button className="btn btn-sm btn-outline" style={{color: 'var(--danger)', borderColor: '#fca5a5'}} onClick={() => setDeleteConfirmId(t.id)}>
                                刪除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 視圖：系統設定 (修改密碼) */}
          {currentView === 'settings' && (
            <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>系統安全設定</h3>
              
              {settingsMessage.text && (
                <div className={`message-box msg-${settingsMessage.type}`}>
                  {settingsMessage.text}
                </div>
              )}

              <form onSubmit={handleUpdatePassword}>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>設定新密碼</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="請輸入新密碼 (至少4碼)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                    修改後將自動存入 Firestore 的 settings 集合中。
                  </small>
                </div>
                <button type="submit" className="btn btn-primary btn-block">
                  更新密碼
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
