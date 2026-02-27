import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Wallet, PlusCircle, List, Settings, LogOut, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, Lock, AlertCircle } from 'lucide-react';

// ==========================================
// Firebase 初始設定
// ==========================================
// 判斷是否在預覽環境，若無則使用您提供的 Config
const isCanvasEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnv 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyCyiy4q9kzacnAaB-oURmXe00tRZ_ocf7M",
      authDomain: "test-ff8f4.firebaseapp.com",
      projectId: "test-ff8f4",
      storageBucket: "test-ff8f4.firebasestorage.app",
      messagingSenderId: "265340130264",
      appId: "1:265340130264:web:9f6ef17b118d0b455258ad",
      measurementId: "G-6Q5L31J9PK"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 輔助函式：處理不同環境的資料庫路徑
const getCollectionPath = (user, collectionName) => {
  if (isCanvasEnv) return collection(db, 'artifacts', appId, 'users', user.uid, collectionName);
  return collection(db, 'users', user.uid, collectionName);
};
const getDocPath = (user, collectionName, docId) => {
  if (isCanvasEnv) return doc(db, 'artifacts', appId, 'users', user.uid, collectionName, docId);
  return doc(db, 'users', user.uid, collectionName, docId);
};

// ==========================================
// 主應用程式元件
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // 系統密碼鎖狀態
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [systemPassword, setSystemPassword] = useState('1234'); // 預設密碼
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // 應用程式狀態
  const [transactions, setTransactions] = useState([]);
  const [currentTab, setCurrentTab] = useState('dashboard'); // dashboard, records, settings
  
  // 表單狀態
  const initialForm = {
    date: new Date().toISOString().split('T')[0],
    type: 'expense', // 'income' or 'expense'
    category: '餐飲',
    amount: '',
    note: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const categories = {
    expense: ['餐飲', '交通', '購物', '娛樂', '居家', '其他'],
    income: ['薪水', '獎金', '投資', '零用錢', '其他']
  };

  // 1. 初始化 Firebase 驗證
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 獲取資料 (當使用者登入後)
  useEffect(() => {
    if (!user) return;

    // 獲取設定 (密碼)
    const fetchSettings = async () => {
      try {
        const settingsRef = getDocPath(user, 'settings', 'auth');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          setSystemPassword(docSnap.data().password);
        } else {
          // 初始化預設密碼
          await setDoc(settingsRef, { password: '1234' });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    // 監聽記帳紀錄
    const recordsRef = getCollectionPath(user, 'transactions');
    const unsubscribeRecords = onSnapshot(recordsRef, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 在前端依照日期排序 (新到舊)
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setTransactions(data);
      },
      (error) => {
        console.error("Error fetching transactions:", error);
      }
    );

    return () => {
      unsubscribeRecords();
    };
  }, [user]);

  // ==========================================
  // 邏輯處理函式
  // ==========================================
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === systemPassword) {
      setIsUnlocked(true);
      setLoginError('');
      setLoginInput('');
    } else {
      setLoginError('密碼錯誤，請重新輸入');
    }
  };

  const handleLogout = () => {
    setIsUnlocked(false);
    setCurrentTab('dashboard');
  };

  const handleChangePassword = async (newPassword) => {
    if (!user) return;
    try {
      const settingsRef = getDocPath(user, 'settings', 'auth');
      await setDoc(settingsRef, { password: newPassword });
      setSystemPassword(newPassword);
      alert('密碼已成功更新！');
    } catch (error) {
      console.error("Error updating password:", error);
      alert('更新失敗，請稍後再試。');
    }
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!user || !formData.amount || !formData.date) return;

    const recordData = {
      ...formData,
      amount: Number(formData.amount),
      timestamp: new Date().getTime()
    };

    try {
      const recordsRef = getCollectionPath(user, 'transactions');
      if (editingId) {
        const docRef = getDocPath(user, 'transactions', editingId);
        await updateDoc(docRef, recordData);
        setEditingId(null);
      } else {
        await addDoc(recordsRef, recordData);
      }
      setFormData(initialForm);
      setCurrentTab('records');
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  const handleEdit = (record) => {
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      amount: record.amount.toString(),
      note: record.note
    });
    setEditingId(record.id);
    setCurrentTab('dashboard'); // 切換回表單頁
  };

  const handleDelete = async (id) => {
    if (!user) return;
    // 替代瀏覽器的 confirm，直接使用簡單的狀態管理或直接刪除 (為了符合環境限制避免 alert)
    try {
      const docRef = getDocPath(user, 'transactions', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  // ==========================================
  // 統計數據計算
  // ==========================================
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      if (t.type === 'expense') expense += Number(t.amount);
    });
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [transactions]);

  // ==========================================
  // 原生 CSS 樣式定義 (完全取代 Tailwind)
  // ==========================================
  const customStyles = `
    :root {
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --primary-light: #e0e7ff;
      --danger: #e11d48;
      --danger-light: #ffe4e6;
      --success: #059669;
      --success-light: #d1fae5;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg); color: var(--text-main); }
    .container { max-width: 800px; margin: 0 auto; padding: 24px 20px; }
    .card { background: var(--card-bg); border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); border: 1px solid var(--border); padding: 24px; margin-bottom: 24px; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
    .btn { padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 15px; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-danger { background: var(--danger-light); color: var(--danger); }
    .btn-danger:hover { background: #fecdd3; }
    .btn-dark { background: #0f172a; color: white; }
    .btn-dark:hover { background: #1e293b; }
    .input { width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 10px; margin-top: 6px; font-size: 15px; transition: 0.2s; background: var(--bg); color: var(--text-main); }
    .input:focus { outline: none; border-color: var(--primary); background: white; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
    select.input { appearance: none; cursor: pointer; }
    .stat-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
    .stat-title { font-size: 14px; color: var(--text-muted); margin: 0 0 8px 0; font-weight: 500; }
    .stat-amount { font-size: 28px; font-weight: 800; margin: 0; line-height: 1; }
    .text-success { color: var(--success); }
    .text-danger { color: var(--danger); }
    .text-primary { color: var(--primary); }
    .text-blue { color: #0284c7; }
    .icon-box { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bg-success-light { background: var(--success-light); color: var(--success); }
    .bg-danger-light { background: var(--danger-light); color: var(--danger); }
    .bg-primary-light { background: var(--primary-light); color: var(--primary); }
    .bg-blue-light { background: #e0f2fe; color: #0284c7; }
    .header { background: white; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-content { max-width: 800px; margin: 0 auto; padding: 0 20px; height: 70px; display: flex; align-items: center; justify-content: space-between; }
    .nav { display: flex; gap: 8px; }
    .nav-btn { padding: 10px 16px; border-radius: 10px; border: none; background: transparent; cursor: pointer; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 8px; transition: 0.2s; font-size: 15px; }
    .nav-btn.active { background: var(--primary-light); color: var(--primary); }
    .nav-btn:hover:not(.active) { background: #f1f5f9; color: var(--text-main); }
    .mobile-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 1px solid var(--border); padding: 10px 16px; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 100; justify-content: space-around; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); }
    .mobile-nav-btn { display: flex; flex-direction: column; align-items: center; background: transparent; border: none; color: #94a3b8; font-size: 11px; font-weight: 600; gap: 6px; cursor: pointer; min-width: 60px; }
    .mobile-nav-btn.active { color: var(--primary); }
    .record-item { padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
    .record-item:hover { background: #f8fafc; }
    .record-item:last-child { border-bottom: none; }
    .badge { font-size: 12px; padding: 4px 10px; border-radius: 20px; background: #f1f5f9; color: var(--text-muted); margin-left: 10px; font-weight: 500; }
    .lock-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); }
    .lock-card { background: white; width: 100%; max-width: 380px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
    .lock-header { background: var(--primary); padding: 40px 24px; text-align: center; color: white; }
    .actions { opacity: 0; display: flex; gap: 8px; transition: 0.2s; }
    .record-item:hover .actions { opacity: 1; }
    .action-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); transition: 0.2s; }
    .action-btn:hover { background: #f1f5f9; color: var(--primary); border-color: #cbd5e1; }
    .action-btn.danger:hover { background: var(--danger-light); color: var(--danger); border-color: #fecdd3; }
    .type-switch { display: flex; gap: 10px; margin-top: 6px; }
    .type-btn { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); cursor: pointer; font-weight: 600; color: var(--text-muted); transition: 0.2s; }
    .type-btn.expense.active { background: var(--danger-light); border-color: #fecdd3; color: var(--danger); }
    .type-btn.income.active { background: var(--success-light); border-color: #a7f3d0; color: var(--success); }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 6px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .card-title { font-size: 18px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; color: var(--text-main); }
    .empty-state { padding: 60px 20px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; }
    @media (max-width: 768px) {
      .header { display: none; }
      .mobile-nav { display: flex; }
      .container { padding-bottom: 100px; padding-top: 16px; }
      .grid-3, .grid-2 { grid-template-columns: 1fr; }
      .actions { opacity: 1; }
      .stat-amount { font-size: 24px; }
      .record-item { flex-direction: column; align-items: flex-start; gap: 16px; }
      .record-item > div:last-child { width: 100%; justify-content: space-between; }
    }
  `;

  // ==========================================
  // 畫面渲染
  // ==========================================
  if (isAuthLoading) {
    return (
      <>
        <style>{customStyles}</style>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>載入中...</div>
      </>
    );
  }

  // --- 鎖定畫面 ---
  if (!isUnlocked) {
    return (
      <>
        <style>{customStyles}</style>
        <div className="lock-screen">
          <div className="lock-card">
            <div className="lock-header">
              <div className="icon-box" style={{ background: 'rgba(255,255,255,0.2)', margin: '0 auto 16px auto' }}>
                <Wallet size={32} color="white" />
              </div>
              <h1 style={{ margin: 0, fontSize: '24px' }}>個人記帳系統</h1>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>請輸入密碼以進入</p>
            </div>
            <form onSubmit={handleLogin} style={{ padding: '32px 24px' }}>
              <div className="form-group">
                <label className="form-label">系統密碼</label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '16px', top: '16px', color: '#94a3b8' }} size={18} />
                  <input
                    type="password"
                    className="input"
                    style={{ paddingLeft: '44px', marginTop: 0 }}
                    placeholder="預設密碼為 1234"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    required
                  />
                </div>
                {loginError && (
                  <p className="text-danger" style={{ fontSize: '13px', marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                    <AlertCircle size={16} style={{ marginRight: '6px' }} /> {loginError}
                  </p>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                進入系統
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // --- 主畫面 ---
  return (
    <>
      <style>{customStyles}</style>
      <div>
        {/* 頂部導覽列 (桌面版) */}
        <header className="header">
          <div className="header-content">
            <div className="card-title text-primary">
              <Wallet size={24} /> 記帳系統
            </div>
            <nav className="nav">
              <NavButton icon={<PlusCircle size={18}/>} label="新增收支" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} />
              <NavButton icon={<List size={18}/>} label="歷史紀錄" active={currentTab === 'records'} onClick={() => setCurrentTab('records')} />
              <NavButton icon={<Settings size={18}/>} label="系統設定" active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} />
              <button onClick={handleLogout} className="nav-btn" style={{ marginLeft: '16px', color: '#e11d48' }}>
                <LogOut size={18} /> 登出
              </button>
            </nav>
          </div>
        </header>

        {/* 底部導覽列 (手機版) */}
        <nav className="mobile-nav">
          <MobileNavButton icon={<PlusCircle size={22}/>} label="新增" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} />
          <MobileNavButton icon={<List size={22}/>} label="紀錄" active={currentTab === 'records'} onClick={() => setCurrentTab('records')} />
          <MobileNavButton icon={<Settings size={22}/>} label="設定" active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} />
          <button onClick={handleLogout} className="mobile-nav-btn" style={{ color: '#e11d48' }}>
            <LogOut size={22} />
            <span>登出</span>
          </button>
        </nav>

        {/* 內容區塊 */}
        <main className="container">
          
          {/* 儀表板與新增表單 */}
          {currentTab === 'dashboard' && (
            <div>
              {/* 統計面板 */}
              <div className="grid-3">
                <StatCard title="本月結餘" amount={stats.balance} icon={<DollarSign size={24} />} colorClass={stats.balance >= 0 ? 'text-blue' : 'text-danger'} bgClass="bg-blue-light" />
                <StatCard title="總收入" amount={stats.income} icon={<TrendingUp size={24} />} colorClass="text-success" bgClass="bg-success-light" />
                <StatCard title="總支出" amount={stats.expense} icon={<TrendingDown size={24} />} colorClass="text-danger" bgClass="bg-danger-light" />
              </div>

              {/* 新增/編輯表單 */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    {editingId ? <Edit2 size={20} className="text-primary"/> : <PlusCircle size={20} className="text-primary"/>}
                    {editingId ? '編輯紀錄' : '新增收支'}
                  </h2>
                  {editingId && (
                    <button onClick={() => { setEditingId(null); setFormData(initialForm); }} className="badge" style={{ border: 'none', cursor: 'pointer' }}>取消編輯</button>
                  )}
                </div>
                
                <form onSubmit={handleSubmitTransaction}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">日期</label>
                      <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">類型</label>
                      <div className="type-switch">
                        <button type="button" 
                          onClick={() => setFormData({...formData, type: 'expense', category: categories.expense[0]})}
                          className={`type-btn expense ${formData.type === 'expense' ? 'active' : ''}`}>
                          支出
                        </button>
                        <button type="button" 
                          onClick={() => setFormData({...formData, type: 'income', category: categories.income[0]})}
                          className={`type-btn income ${formData.type === 'income' ? 'active' : ''}`}>
                          收入
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">分類</label>
                      <select required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="input">
                        {categories[formData.type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">金額</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '16px', top: '16px', color: '#94a3b8', fontWeight: 600 }}>$</span>
                        <input type="number" required min="1" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0" className="input" style={{ paddingLeft: '32px' }} />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">備註</label>
                    <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="選填..." className="input" />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                    {editingId ? '儲存修改' : '新增紀錄'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 歷史紀錄列表 */}
          {currentTab === 'records' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title">
                  <List size={20} className="text-primary"/> 所有紀錄
                </h2>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>共 {transactions.length} 筆</span>
              </div>
              
              {transactions.length === 0 ? (
                <div className="empty-state">
                  <List size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>目前還沒有任何紀錄喔！</p>
                </div>
              ) : (
                <div>
                  {transactions.map(record => (
                    <div key={record.id} className="record-item">
                      <div className="flex items-center" style={{ gap: '16px' }}>
                        <div className={`icon-box ${record.type === 'income' ? 'bg-success-light' : 'bg-danger-light'}`} style={{ fontWeight: 700, fontSize: '18px' }}>
                          {record.category[0]}
                        </div>
                        <div>
                          <div className="flex items-center">
                            <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)' }}>{record.category}</span>
                            {record.note && <span className="badge">{record.note}</span>}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500 }}>{record.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center" style={{ gap: '24px' }}>
                        <span className={`stat-amount ${record.type === 'income' ? 'text-success' : ''}`} style={{ fontSize: '20px' }}>
                          {record.type === 'income' ? '+' : '-'}${record.amount.toLocaleString()}
                        </span>
                        <div className="actions">
                          <button onClick={() => handleEdit(record)} className="action-btn">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="action-btn danger">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 系統設定 */}
          {currentTab === 'settings' && (
            <SettingsPanel 
              currentPassword={systemPassword} 
              onChangePassword={handleChangePassword} 
            />
          )}
        </main>
      </div>
    </>
  );
}

// ==========================================
// 輔助 UI 元件
// ==========================================
const NavButton = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`nav-btn ${active ? 'active' : ''}`}>
    {icon} {label}
  </button>
);

const MobileNavButton = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`mobile-nav-btn ${active ? 'active' : ''}`}>
    {icon}
    <span>{label}</span>
  </button>
);

const StatCard = ({ title, amount, icon, colorClass, bgClass }) => (
  <div className="stat-card">
    <div>
      <p className="stat-title">{title}</p>
      <h3 className={`stat-amount ${colorClass}`}>
        ${amount.toLocaleString()}
      </h3>
    </div>
    <div className={`icon-box ${bgClass}`}>
      {icon}
    </div>
  </div>
);

const SettingsPanel = ({ currentPassword, onChangePassword }) => {
  const [newPwd, setNewPwd] = useState('');
  
  const onSubmit = (e) => {
    e.preventDefault();
    if (newPwd.length < 4) {
      alert('密碼長度至少需 4 個字元');
      return;
    }
    onChangePassword(newPwd);
    setNewPwd('');
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2 className="card-title" style={{ marginBottom: '24px' }}>
        <Settings size={20} className="text-primary"/> 系統後台設定
      </h2>
      
      <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>目前登入密碼：</p>
        <p style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 800, letterSpacing: '4px', margin: 0, color: 'var(--text-main)' }}>{currentPassword}</p>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label">設定新密碼</label>
          <input 
            type="text" 
            value={newPwd} 
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="請輸入新密碼"
            required
            className="input"
          />
        </div>
        <button type="submit" className="btn btn-dark" style={{ width: '100%' }}>
          更新密碼
        </button>
      </form>
    </div>
  );
};
