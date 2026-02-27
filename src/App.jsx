import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// ==========================================
// 1. Firebase 初始化與配置
// ==========================================
// 系統會優先使用您提供的設定，若在預覽環境中則自動對接預覽資料庫
const userFirebaseConfig = {
  apiKey: "AIzaSyCyiy4q9kzacnAaB-oURmXe00tRZ_ocf7M",
  authDomain: "test-ff8f4.firebaseapp.com",
  projectId: "test-ff8f4",
  storageBucket: "test-ff8f4.firebasestorage.app",
  messagingSenderId: "265340130264",
  appId: "1:265340130264:web:9f6ef17b118d0b455258ad",
  measurementId: "G-6Q5L31J9PK"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : userFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 輔助函式：確保在各環境下都能對應正確的 Collection 路徑
const getCollectionPath = (colName) => {
  if (typeof __firebase_config !== 'undefined' && typeof __app_id !== 'undefined') {
    return collection(db, 'artifacts', __app_id, 'public', 'data', colName);
  }
  return collection(db, colName); // 本地端使用正常的根目錄 collection
};

const getDocPath = (colName, docId) => {
  if (typeof __firebase_config !== 'undefined' && typeof __app_id !== 'undefined') {
    return doc(db, 'artifacts', __app_id, 'public', 'data', colName, docId);
  }
  return doc(db, colName, docId); // 本地端使用正常的 doc 路徑
};


// ==========================================
// 2. 主應用程式 Component
// ==========================================
export default function App() {
  // 狀態管理
  const [user, setUser] = useState(null);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [systemPassword, setSystemPassword] = useState('1234'); // 預設密碼 1234
  
  const [records, setRecords] = useState([]);
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' or 'settings'
  
  // 表單與登入輸入狀態
  const [loginInput, setLoginInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(getInitialForm());

  function getInitialForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      category: '',
      amount: '',
      note: ''
    };
  }

  // Firebase 匿名登入 (Firestore 安全性要求)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 監聽 Firestore 資料
  useEffect(() => {
    if (!user) return;

    // 監聽設定 (密碼)
    const unsubSettings = onSnapshot(getCollectionPath('settings'), (snapshot) => {
      let pwd = '1234'; // 若無設定則預設 1234
      snapshot.forEach(doc => {
        if (doc.id === 'auth') pwd = doc.data().password;
      });
      setSystemPassword(pwd);
      setSettingsLoaded(true);
    }, (error) => console.error("Settings Load Error:", error));

    // 監聽記帳紀錄
    const unsubRecords = onSnapshot(getCollectionPath('records'), (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      // 記憶體中進行「日期降序」排序
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecords(data);
      setRecordsLoaded(true);
    }, (error) => console.error("Records Load Error:", error));

    return () => {
      unsubSettings();
      unsubRecords();
    };
  }, [user]);

  // 統計計算 (利用 useMemo 避免多餘渲染)
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    records.forEach(r => {
      if (r.type === 'income') income += Number(r.amount);
      if (r.type === 'expense') expense += Number(r.amount);
    });
    return { totalIncome: income, totalExpense: expense, balance: income - expense };
  }, [records]);

  // ==========================================
  // 操作處理邏輯
  // ==========================================
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === systemPassword) {
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
    } else {
      alert('密碼錯誤，請重新輸入。');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setLoginInput('');
    setCurrentTab('dashboard');
  };

  const handleSubmitRecord = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) return;

    const dataToSave = {
      ...formData,
      amount: Number(formData.amount)
    };

    try {
      if (editId) {
        await updateDoc(getDocPath('records', editId), dataToSave);
      } else {
        await addDoc(getCollectionPath('records'), dataToSave);
      }
      setFormData(getInitialForm());
      setEditId(null);
    } catch (error) {
      console.error("Save Record Error:", error);
    }
  };

  const handleEdit = (record) => {
    setEditId(record.id);
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      amount: record.amount,
      note: record.note || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("確定要刪除這筆記錄嗎？")) {
      try {
        await deleteDoc(getDocPath('records', id));
      } catch (error) {
        console.error("Delete Record Error:", error);
      }
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPasswordInput) return;
    try {
      await setDoc(getDocPath('settings', 'auth'), { password: newPasswordInput });
      alert("密碼更新成功！");
      setNewPasswordInput('');
    } catch (error) {
      console.error("Update Password Error:", error);
    }
  };

  // 全螢幕載入中遮罩
  const isLoading = !recordsLoaded || !settingsLoaded;

  // ==========================================
  // UI 渲染
  // ==========================================
  return (
    <>
      {/* 使用內嵌 Style 封裝樣式 */}
      <style>{`
        * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { margin: 0; background-color: #f3f4f6; color: #1f2937; }
        
        /* 載入中與登入頁面 (水平垂直置中) */
        .fullscreen-center { 
          position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          background: #f3f4f6; z-index: 1000;
        }
        .overlay { background: rgba(243, 244, 246, 0.95); }
        .spinner {
          border: 4px solid #e5e7eb; border-top: 4px solid #4F46E5;
          border-radius: 50%; width: 50px; height: 50px;
          animation: spin 1s linear infinite; margin-bottom: 20px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* 登入卡片 */
        .login-card {
          background: white; padding: 40px; border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 100%; max-width: 400px;
          text-align: center;
        }
        
        /* 主體架構 (max-width 800px 居中) */
        .app-container { max-width: 800px; margin: 40px auto; padding: 0 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .nav-btn {
          margin-left: 10px; padding: 8px 16px; border: none; border-radius: 8px;
          cursor: pointer; background: #e5e7eb; color: #374151; font-weight: 500; transition: 0.2s;
        }
        .nav-btn.active { background: #4F46E5; color: white; }
        .nav-btn.logout { background: #ef4444; color: white; margin-left: 20px; }
        
        /* 卡片共用樣式 */
        .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 30px; }
        
        /* 統計卡片 */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr; } }
        .stat-card { padding: 20px; border-radius: 12px; color: white; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .stat-card.income { background: #10B981; }
        .stat-card.expense { background: #EF4444; }
        .stat-card.balance { background: #3B82F6; }
        .stat-card h3 { margin: 0 0 10px 0; font-size: 15px; font-weight: 500; opacity: 0.9; }
        .stat-card p { margin: 0; font-size: 28px; font-weight: bold; }

        /* 表單元件 */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
        .form-group { display: flex; flex-direction: column; text-align: left; margin-bottom: 15px; }
        .form-group label { margin-bottom: 6px; font-size: 14px; color: #4b5563; font-weight: 500; }
        .form-control {
          padding: 12px; border: 1px solid #d1d5db; border-radius: 8px;
          font-size: 15px; outline: none; transition: border-color 0.2s; width: 100%;
        }
        .form-control:focus { border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
        
        /* 按鈕 */
        .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: 0.2s; width: 100%; }
        .btn-primary { background: #4F46E5; color: white; }
        .btn-primary:hover { background: #4338CA; }
        .btn-secondary { background: #6b7280; color: white; margin-top: 10px; }
        .btn-secondary:hover { background: #4b5563; }
        
        /* 列表樣式 */
        .record-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px; border: 1px solid #f3f4f6; border-radius: 12px;
          margin-bottom: 10px; transition: 0.2s; background: white;
        }
        .record-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); transform: translateY(-1px); border-color: #e5e7eb; }
        .record-info { display: flex; flex-direction: column; }
        .record-title { font-weight: 600; font-size: 16px; margin-bottom: 6px; color: #111827; }
        .record-meta { font-size: 13px; color: #6b7280; }
        .record-right { display: flex; align-items: center; gap: 20px; }
        .record-amount { font-weight: bold; font-size: 18px; }
        .text-income { color: #10B981; }
        .text-expense { color: #EF4444; }
        .action-btns button {
          padding: 6px 12px; margin-left: 8px; border: none; border-radius: 6px;
          cursor: pointer; font-size: 13px; font-weight: 500; transition: 0.2s;
        }
        .btn-edit { background: #fef3c7; color: #d97706; }
        .btn-edit:hover { background: #fde68a; }
        .btn-delete { background: #fee2e2; color: #dc2626; }
        .btn-delete:hover { background: #fecaca; }
        
        .empty-state { text-align: center; padding: 40px; color: #6b7280; }
      `}</style>

      {/* 1. 載入中遮罩 (防未排版閃爍) */}
      {isLoading && (
        <div className="fullscreen-center overlay">
          <div className="spinner"></div>
          <h2 style={{ color: '#4b5563' }}>系統載入中...</h2>
        </div>
      )}

      {/* 2. 登入介面 (完全水平垂直置中) */}
      {!isLoading && !isLoggedIn && (
        <div className="fullscreen-center">
          <div className="login-card">
            <h2 style={{ marginBottom: '10px' }}>簡易記帳系統</h2>
            <p style={{ color: '#6b7280', marginBottom: '30px', fontSize: '14px' }}>請輸入系統密碼以登入</p>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <input
                  type="password"
                  className="form-control"
                  placeholder="輸入密碼 (預設: 1234)"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                登入系統
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. 主應用程式介面 */}
      {!isLoading && isLoggedIn && (
        <div className="app-container">
          {/* Header 導覽列 */}
          <div className="header">
            <h2>個人記帳看板</h2>
            <div>
              <button 
                className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentTab('dashboard')}
              >
                主控台
              </button>
              <button 
                className={`nav-btn ${currentTab === 'settings' ? 'active' : ''}`}
                onClick={() => setCurrentTab('settings')}
              >
                系統設定
              </button>
              <button className="nav-btn logout" onClick={handleLogout}>
                登出
              </button>
            </div>
          </div>

          {/* 儀表板分頁 */}
          {currentTab === 'dashboard' && (
            <>
              {/* 統計看板 */}
              <div className="stats-grid">
                <div className="stat-card income">
                  <h3>總收入</h3>
                  <p>${totalIncome.toLocaleString()}</p>
                </div>
                <div className="stat-card expense">
                  <h3>總支出</h3>
                  <p>${totalExpense.toLocaleString()}</p>
                </div>
                <div className="stat-card balance">
                  <h3>目前結餘</h3>
                  <p>${balance.toLocaleString()}</p>
                </div>
              </div>

              {/* 新增/編輯表單 */}
              <div className="card">
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
                  {editId ? '編輯記錄' : '新增記錄'}
                </h3>
                <form onSubmit={handleSubmitRecord}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>日期</label>
                      <input 
                        type="date" className="form-control" required
                        value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>收支類型</label>
                      <select 
                        className="form-control"
                        value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}
                      >
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>分類名稱</label>
                      <input 
                        type="text" className="form-control" required placeholder="例：薪水、餐飲、交通"
                        value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>金額</label>
                      <input 
                        type="number" className="form-control" required min="0" placeholder="0"
                        value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>備註 (選填)</label>
                    <input 
                      type="text" className="form-control" placeholder="記錄細節..."
                      value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})}
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary">
                    {editId ? '儲存修改' : '新增記錄'}
                  </button>
                  {editId && (
                    <button type="button" className="btn btn-secondary" onClick={() => { setEditId(null); setFormData(getInitialForm()); }}>
                      取消編輯
                    </button>
                  )}
                </form>
              </div>

              {/* 記錄列表 */}
              <div className="card" style={{ padding: '0', background: 'transparent', boxShadow: 'none' }}>
                <h3 style={{ marginBottom: '15px' }}>明細列表 (日期降序)</h3>
                
                {records.length === 0 ? (
                  <div className="card empty-state">目前尚無任何記帳記錄</div>
                ) : (
                  <div>
                    {records.map(record => (
                      <div className="record-item" key={record.id}>
                        <div className="record-info">
                          <span className="record-title">{record.category}</span>
                          <span className="record-meta">
                            {record.date} {record.note && ` • ${record.note}`}
                          </span>
                        </div>
                        <div className="record-right">
                          <span className={`record-amount ${record.type === 'income' ? 'text-income' : 'text-expense'}`}>
                            {record.type === 'income' ? '+' : '-'}${Number(record.amount).toLocaleString()}
                          </span>
                          <div className="action-btns">
                            <button className="btn-edit" onClick={() => handleEdit(record)}>編輯</button>
                            <button className="btn-delete" onClick={() => handleDelete(record.id)}>刪除</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 系統設定分頁 */}
          {currentTab === 'settings' && (
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>後台管理與設定</h3>
              <form onSubmit={handleUpdatePassword}>
                <div className="form-group" style={{ maxWidth: '400px' }}>
                  <label>修改登入密碼</label>
                  <input 
                    type="password" className="form-control" required placeholder="輸入新密碼"
                    value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    密碼將安全加密儲存於 Firestore 的 settings 集合中。
                  </p>
                </div>
                <button type="submit" className="btn btn-primary" style={{ maxWidth: '400px' }}>
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
