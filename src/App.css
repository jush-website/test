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
  // 畫面渲染
  // ==========================================
  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-600">載入中...</div>;
  }

  // --- 鎖定畫面 ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-6 text-center text-white">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
              <Wallet size={32} />
            </div>
            <h1 className="text-2xl font-bold">個人記帳系統</h1>
            <p className="text-indigo-100 mt-2 text-sm">請輸入密碼以進入</p>
          </div>
          <form onSubmit={handleLogin} className="p-6">
            <div className="mb-4">
              <label className="block text-slate-700 text-sm font-bold mb-2">系統密碼</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="password"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="預設密碼為 1234"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  required
                />
              </div>
              {loginError && (
                <p className="text-red-500 text-xs mt-2 flex items-center">
                  <AlertCircle size={14} className="mr-1" /> {loginError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              進入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 主畫面 ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 md:pb-0">
      {/* 頂部導覽列 (桌面版) */}
      <header className="bg-white shadow-sm sticky top-0 z-10 hidden md:block">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center text-indigo-600 font-bold text-xl">
            <Wallet className="mr-2" size={24} /> 記帳系統
          </div>
          <nav className="flex space-x-1">
            <NavButton icon={<PlusCircle size={18}/>} label="新增收支" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} />
            <NavButton icon={<List size={18}/>} label="歷史紀錄" active={currentTab === 'records'} onClick={() => setCurrentTab('records')} />
            <NavButton icon={<Settings size={18}/>} label="系統設定" active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} />
            <button onClick={handleLogout} className="flex items-center px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-md transition text-sm font-medium ml-4">
              <LogOut size={18} className="mr-1.5" /> 登出
            </button>
          </nav>
        </div>
      </header>

      {/* 底部導覽列 (手機版) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20 flex justify-around p-2">
        <MobileNavButton icon={<PlusCircle size={20}/>} label="新增" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} />
        <MobileNavButton icon={<List size={20}/>} label="紀錄" active={currentTab === 'records'} onClick={() => setCurrentTab('records')} />
        <MobileNavButton icon={<Settings size={20}/>} label="設定" active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} />
        <button onClick={handleLogout} className="flex flex-col items-center p-2 text-slate-400 hover:text-red-500">
          <LogOut size={20} />
          <span className="text-[10px] mt-1 font-medium">登出</span>
        </button>
      </nav>

      {/* 內容區塊 */}
      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        
        {/* 儀表板與新增表單 */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 統計面板 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="本月結餘" amount={stats.balance} icon={<DollarSign size={24} className="text-blue-500"/>} colorClass={stats.balance >= 0 ? 'text-blue-600' : 'text-red-500'} bgClass="bg-blue-50" />
              <StatCard title="總收入" amount={stats.income} icon={<TrendingUp size={24} className="text-emerald-500"/>} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
              <StatCard title="總支出" amount={stats.expense} icon={<TrendingDown size={24} className="text-rose-500"/>} colorClass="text-rose-600" bgClass="bg-rose-50" />
            </div>

            {/* 新增/編輯表單 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  {editingId ? <Edit2 size={20} className="mr-2 text-indigo-500"/> : <PlusCircle size={20} className="mr-2 text-indigo-500"/>}
                  {editingId ? '編輯紀錄' : '新增收支'}
                </h2>
                {editingId && (
                  <button onClick={() => { setEditingId(null); setFormData(initialForm); }} className="text-sm text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1 rounded-full">取消編輯</button>
                )}
              </div>
              
              <form onSubmit={handleSubmitTransaction} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 日期 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">日期</label>
                    <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition" />
                  </div>
                  {/* 收支類型 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">類型</label>
                    <div className="flex space-x-2">
                      <button type="button" 
                        onClick={() => setFormData({...formData, type: 'expense', category: categories.expense[0]})}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${formData.type === 'expense' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                        支出
                      </button>
                      <button type="button" 
                        onClick={() => setFormData({...formData, type: 'income', category: categories.income[0]})}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${formData.type === 'income' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                        收入
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 分類 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">分類</label>
                    <select required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition">
                      {categories[formData.type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  {/* 金額 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">金額</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                      <input type="number" required min="1" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition" />
                    </div>
                  </div>
                </div>

                {/* 備註 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">備註</label>
                  <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="選填..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition" />
                </div>

                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm mt-4">
                  {editingId ? '儲存修改' : '新增紀錄'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 歷史紀錄列表 */}
        {currentTab === 'records' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <List size={20} className="mr-2 text-indigo-500"/> 所有紀錄
              </h2>
              <span className="text-sm text-slate-500">共 {transactions.length} 筆</span>
            </div>
            
            {transactions.length === 0 ? (
              <div className="p-10 text-center text-slate-400 flex flex-col items-center">
                <List size={48} className="mb-3 opacity-20" />
                <p>目前還沒有任何紀錄喔！</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.map(record => (
                  <div key={record.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between group">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${record.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {record.category[0]}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800">{record.category}</span>
                          {record.note && <span className="text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{record.note}</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{record.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`font-bold text-lg ${record.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {record.type === 'income' ? '+' : '-'}${record.amount.toLocaleString()}
                      </span>
                      <div className="flex space-x-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(record)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white shadow-sm border border-slate-100 rounded-full hover:bg-indigo-50 transition">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(record.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-full hover:bg-red-50 transition">
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
  );
}

// ==========================================
// 輔助 UI 元件
// ==========================================
const NavButton = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
    <span className="mr-2">{icon}</span> {label}
  </button>
);

const MobileNavButton = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center p-2 min-w-[64px] transition ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon}
    <span className={`text-[10px] mt-1 ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
);

const StatCard = ({ title, amount, icon, colorClass, bgClass }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className={`text-2xl font-black ${colorClass}`}>
        ${amount.toLocaleString()}
      </h3>
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgClass}`}>
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-md mx-auto">
      <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center">
        <Settings size={20} className="mr-2 text-indigo-500"/> 系統後台設定
      </h2>
      
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
        <p className="text-sm text-slate-600 mb-1">目前登入密碼：</p>
        <p className="text-lg font-mono font-bold tracking-widest text-slate-800">{currentPassword}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">設定新密碼</label>
          <input 
            type="text" 
            value={newPwd} 
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="請輸入新密碼"
            required
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>
        <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-lg transition">
          更新密碼
        </button>
      </form>
    </div>
  );
};
