import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

// 1. Firebase 初始化 (使用您提供的設定)
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

// 預設分類選項
const CATEGORIES = {
  expense: ['餐飲', '交通', '居住', '娛樂', '購物', '醫療', '其他'],
  income: ['薪水', '獎金', '投資', '兼職', '其他']
};

export default function App() {
  // 狀態管理
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [systemPassword, setSystemPassword] = useState('1234');
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [records, setRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense', // 'expense' 或 'income'
    category: '餐飲',
    amount: '',
    note: ''
  });

  // 2. 系統載入與設定初始化
  useEffect(() => {
    const initSystem = async () => {
      try {
        const settingsRef = doc(db, "settings", "auth");
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          setSystemPassword(settingsSnap.data().password);
        } else {
          // 如果資料庫中沒有設定，建立預設密碼 1234
          await setDoc(settingsRef, { password: '1234' });
          setSystemPassword('1234');
        }
      } catch (error) {
        console.error("系統初始化錯誤:", error);
      } finally {
        setIsLoading(false); // 結束載入狀態
      }
    };
    initSystem();
  }, []);

  // 3. 取得記帳紀錄
  useEffect(() => {
    if (!isAuthenticated) return;

    const recordsRef = collection(db, 'records');
    const unsubscribe = onSnapshot(recordsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecords(data);
    }, (error) => {
      console.error("讀取紀錄失敗:", error);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // 4. 排序與統計計算 (在記憶體中處理)
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [records]);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let inc = 0, exp = 0;
    records.forEach(record => {
      const amt = parseFloat(record.amount) || 0;
      if (record.type === 'income') inc += amt;
      else exp += amt;
    });
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [records]);

  // 5. 處理函式
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === systemPassword) {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('密碼錯誤，請重新輸入');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    try {
      await updateDoc(doc(db, "settings", "auth"), { password: newPassword });
      setSystemPassword(newPassword);
      setSettingsMsg('密碼修改成功！');
      setTimeout(() => setShowSettings(false), 1500);
    } catch (error) {
      setSettingsMsg('密碼修改失敗');
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      // 若切換收支類型，預設分類也要跟著換
      if (name === 'type') {
        newData.category = CATEGORIES[value][0];
      }
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || isNaN(formData.amount)) {
      alert("請輸入有效的金額");
      return;
    }

    try {
      const recordData = {
        ...formData,
        amount: parseFloat(formData.amount),
        createdAt: new Date().toISOString()
      };

      if (isEditing && editId) {
        await updateDoc(doc(db, 'records', editId), recordData);
        setIsEditing(false);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'records'), recordData);
      }

      // 重設表單
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: '餐飲',
        amount: '',
        note: ''
      });
    } catch (error) {
      console.error("儲存失敗:", error);
      alert("儲存失敗，請檢查網路連線");
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setEditId(record.id);
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      amount: record.amount,
      note: record.note
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("確定要刪除這筆紀錄嗎？")) {
      try {
        await deleteDoc(doc(db, 'records', id));
      } catch (error) {
        console.error("刪除失敗:", error);
      }
    }
  };

  // 6. 渲染 UI
  if (isLoading) {
    return (
      <div className="fullscreen-center">
        <div className="loader"></div>
        <p className="loading-text">系統載入中...</p>
        <style>{styles}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fullscreen-center bg-gray">
        <div className="card login-card">
          <h2 className="text-center mb-4">記帳系統登入</h2>
          <form onSubmit={handleLogin} className="flex-col gap-3">
            <input
              type="password"
              className="input"
              placeholder="請輸入系統密碼 (預設: 1234)"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              autoFocus
            />
            {loginError && <p className="text-danger text-sm">{loginError}</p>}
            <button type="submit" className="btn btn-primary w-full">進入系統</button>
          </form>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app-container">
      <style>{styles}</style>
      
      {/* 標題列 */}
      <header className="header card flex-between mb-4">
        <h1>我的記帳本</h1>
        <button className="btn btn-outline" onClick={() => {
            setShowSettings(!showSettings);
            setSettingsMsg('');
            setNewPassword('');
        }}>
          {showSettings ? '返回主頁' : '後台設定'}
        </button>
      </header>

      {/* 後台設定區域 */}
      {showSettings ? (
        <div className="card mb-4">
          <h2 className="mb-4">變更系統密碼</h2>
          <form onSubmit={handlePasswordChange} className="flex-col gap-3 max-w-sm">
            <input
              type="text"
              className="input"
              placeholder="輸入新密碼"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">儲存變更</button>
            {settingsMsg && <p className="text-success text-sm">{settingsMsg}</p>}
          </form>
        </div>
      ) : (
        <>
          {/* 統計儀表板 */}
          <div className="dashboard mb-4">
            <div className="dash-card">
              <span className="dash-label">總收入</span>
              <span className="dash-value text-success">${totalIncome.toLocaleString()}</span>
            </div>
            <div className="dash-card">
              <span className="dash-label">總支出</span>
              <span className="dash-value text-danger">${totalExpense.toLocaleString()}</span>
            </div>
            <div className="dash-card highlight">
              <span className="dash-label">目前結餘</span>
              <span className={`dash-value ${balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                ${balance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="main-content">
            {/* 新增/修改 表單 */}
            <div className="card form-section h-fit">
              <h2 className="mb-4">{isEditing ? '編輯紀錄' : '新增紀錄'}</h2>
              <form onSubmit={handleSubmit} className="flex-col gap-3">
                <div className="form-group">
                  <label>日期</label>
                  <input type="date" name="date" className="input" value={formData.date} onChange={handleFormChange} required />
                </div>
                
                <div className="flex-row gap-3">
                  <div className="form-group flex-1">
                    <label>類型</label>
                    <select name="type" className="input" value={formData.type} onChange={handleFormChange}>
                      <option value="expense">支出</option>
                      <option value="income">收入</option>
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label>分類</label>
                    <select name="category" className="input" value={formData.category} onChange={handleFormChange}>
                      {CATEGORIES[formData.type].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>金額</label>
                  <input type="number" name="amount" className="input" min="0" step="1" placeholder="輸入金額" value={formData.amount} onChange={handleFormChange} required />
                </div>

                <div className="form-group">
                  <label>備註</label>
                  <input type="text" name="note" className="input" placeholder="選填" value={formData.note} onChange={handleFormChange} />
                </div>

                <div className="flex-row gap-2 mt-2">
                  <button type="submit" className={`btn ${isEditing ? 'btn-warning' : 'btn-primary'} flex-1`}>
                    {isEditing ? '更新紀錄' : '新增紀錄'}
                  </button>
                  {isEditing && (
                    <button type="button" className="btn btn-outline" onClick={() => {
                      setIsEditing(false);
                      setEditId(null);
                      setFormData({ ...formData, amount: '', note: '' });
                    }}>取消</button>
                  )}
                </div>
              </form>
            </div>

            {/* 資料列表 */}
            <div className="card list-section">
              <h2 className="mb-4">紀錄列表</h2>
              {sortedRecords.length === 0 ? (
                <p className="text-light text-center py-4">目前還沒有任何紀錄喔！</p>
              ) : (
                <div className="records-list">
                  {sortedRecords.map((record) => (
                    <div key={record.id} className="record-item">
                      <div className="record-info">
                        <div className="record-header">
                          <span className={`badge ${record.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                            {record.category}
                          </span>
                          <span className="text-light text-sm">{record.date}</span>
                        </div>
                        <div className="record-note text-sm">{record.note || '無備註'}</div>
                      </div>
                      <div className="record-actions">
                        <span className={`record-amount ${record.type === 'income' ? 'text-success' : 'text-danger'}`}>
                          {record.type === 'income' ? '+' : '-'}${parseFloat(record.amount).toLocaleString()}
                        </span>
                        <div className="btn-group">
                          <button className="btn-icon" onClick={() => handleEdit(record)} title="編輯">✎</button>
                          <button className="btn-icon text-danger" onClick={() => handleDelete(record.id)} title="刪除">✖</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ================= CSS 樣式區域 =================
const styles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    background-color: #f3f4f6;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #1f2937;
    line-height: 1.5;
  }

  /* 通用佈局 */
  .app-container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }
  .fullscreen-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .bg-gray { background-color: #f3f4f6; }
  .flex-col { display: flex; flex-direction: column; }
  .flex-row { display: flex; flex-direction: row; align-items: center; }
  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .flex-1 { flex: 1; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 16px; }
  .mb-4 { margin-bottom: 24px; }
  .mt-2 { margin-top: 8px; }
  .h-fit { height: fit-content; }
  .max-w-sm { max-width: 400px; }
  .text-center { text-align: center; }
  .py-4 { padding: 16px 0; }

  /* 顏色與文字 */
  .text-primary { color: #4f46e5; }
  .text-danger { color: #ef4444; }
  .text-success { color: #10b981; }
  .text-light { color: #6b7280; }
  .text-sm { font-size: 0.875rem; }
  
  /* 卡片元件 */
  .card {
    background: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  .login-card { width: 100%; max-width: 400px; }

  /* 儀表板 */
  .dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  .dash-card {
    background: #ffffff;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .dash-card.highlight {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }
  .dash-label {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 8px;
  }
  .dash-value {
    font-size: 1.5rem;
    font-weight: bold;
  }

  /* 主體結構 (表單與列表) */
  .main-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }
  @media (min-width: 768px) {
    .main-content {
      grid-template-columns: 350px 1fr;
    }
  }

  /* 表單元件 */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }
  .input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .input:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2); }
  
  /* 按鈕 */
  .btn {
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    text-align: center;
  }
  .w-full { width: 100%; }
  .btn-primary { background: #4f46e5; color: white; }
  .btn-primary:hover { background: #4338ca; }
  .btn-warning { background: #f59e0b; color: white; }
  .btn-warning:hover { background: #d97706; }
  .btn-outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
  .btn-outline:hover { background: #f3f4f6; }
  .btn-icon { 
    background: none; 
    border: none; 
    cursor: pointer; 
    padding: 4px 8px;
    border-radius: 4px;
    color: #6b7280;
    font-size: 1rem;
  }
  .btn-icon:hover { background: #f3f4f6; color: #1f2937; }

  /* 列表元件 */
  .records-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 600px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .record-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: box-shadow 0.2s;
  }
  .record-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-color: #d1d5db; }
  .record-info { display: flex; flex-direction: column; gap: 8px; }
  .record-header { display: flex; align-items: center; gap: 12px; }
  .badge {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge-success { background: #d1fae5; color: #065f46; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .record-note { color: #4b5563; }
  .record-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .record-amount { font-size: 1.125rem; font-weight: bold; }
  .btn-group { display: flex; gap: 4px; }

  /* 系統載入動畫 */
  .loader {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f46e5;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  .loading-text {
    font-size: 1.125rem;
    color: #4b5563;
    font-weight: 500;
  }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
