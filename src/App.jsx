import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { Trash2, Edit2, Settings, Home, LogOut, Check, X, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

// 1. 替換為您提供的 Firebase API 配置
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
const auth = getAuth(app);
const db = getFirestore(app);

// 獲取當前環境的 App ID，確保資料路徑正確
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export default function App() {
  // 狀態管理
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null); // Firebase 驗證狀態
  const [isAuthenticated, setIsAuthenticated] = useState(false); // 應用程式 UI 密碼狀態
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'settings'
  
  // 驗證相關
  const [systemPassword, setSystemPassword] = useState('1234');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 資料相關
  const [transactions, setTransactions] = useState([]);
  
  // 表單相關
  const initialForm = {
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '',
    amount: '',
    note: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // 密碼設定相關
  const [newPassword, setNewPassword] = useState('');
  const [settingMessage, setSettingMessage] = useState('');

  // 1. Firebase 身份驗證初始化 (解決權限不足與 Token 不匹配問題)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            // 嘗試使用環境 Token
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenError) {
            // 若因為使用自訂 Firebase 設定導致 Token 不匹配，自動降級為匿名登入
            console.warn("自訂 Token 不適用於您的 Firebase 設定，將自動切換為匿名登入...", tokenError);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth 錯誤:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. 初始化與資料抓取 (確保在 user 通過驗證後才執行查詢)
  useEffect(() => {
    if (!user) return; // 等待 Firebase 驗證完成

    let unsub = () => {};

    const initData = async () => {
      try {
        // 檢查 LocalStorage 登入狀態
        const savedAuth = localStorage.getItem('app_auth_token');
        if (savedAuth === 'true') {
          setIsAuthenticated(true);
        }

        // 獲取系統密碼設定 (使用授權的專屬環境路徑)
        const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setSystemPassword(settingsSnap.data().password);
        } else {
          await setDoc(settingsRef, { password: '1234' });
        }

        // 監聽記帳資料 (即時更新)
        const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
        unsub = onSnapshot(transactionsRef, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTransactions(docs);
          setLoading(false);
        }, (err) => {
          console.error("讀取資料失敗:", err);
          setLoading(false);
        });

      } catch (error) {
        console.error("初始化資料錯誤:", error);
        setLoading(false);
      }
    };

    initData();

    return () => unsub();
  }, [user]);

  // 登入處理
  const handleLogin = (e) => {
    e.preventDefault();
    if (inputPassword === systemPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('app_auth_token', 'true');
      setLoginError('');
      setInputPassword('');
    } else {
      setLoginError('密碼錯誤，請重試。');
    }
  };

  // 登出處理
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('app_auth_token');
    setCurrentView('dashboard');
  };

  // 變更密碼處理
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || !user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth'), { password: newPassword });
      setSystemPassword(newPassword);
      setSettingMessage('密碼更新成功！');
      setNewPassword('');
      setTimeout(() => setSettingMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setSettingMessage('更新失敗。');
    }
  };

  // 表單處理 (新增與更新)
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount || !formData.date || !user) return;

    const submitData = {
      ...formData,
      amount: Number(formData.amount)
    };

    try {
      const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editingId), submitData);
        setEditingId(null);
      } else {
        await addDoc(transactionsRef, submitData);
      }
      setFormData(initialForm);
    } catch (error) {
      console.error("儲存失敗:", error);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      date: item.date,
      type: item.type,
      category: item.category,
      amount: item.amount,
      note: item.note || ''
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id));
      setDeletingId(null);
    } catch (error) {
      console.error("刪除失敗:", error);
    }
  };

  // 資料計算與排序
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  // ---------------- UI 渲染 ----------------

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-50">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-700 tracking-wide">系統載入中...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">簡易記帳系統</h1>
            <p className="text-slate-500 mt-2">請輸入密碼以繼續</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="預設密碼為 1234"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all text-center text-lg tracking-widest"
                autoFocus
              />
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md transition-colors"
            >
              登入
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <DollarSign className="w-6 h-6" />
            <h1 className="text-xl font-bold hidden sm:block">MyMoney 記帳本</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`p-2 rounded-lg flex items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">首頁</span>
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className={`p-2 rounded-lg flex items-center gap-1 transition-colors ${currentView === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">設定</span>
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">登出</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6">
        {currentView === 'dashboard' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between border-l-4 border-l-blue-500">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">目前結餘</p>
                  <h3 className="text-3xl font-bold text-blue-600">${balance.toLocaleString()}</h3>
                </div>
                <div className="bg-blue-50 p-3 rounded-full"><DollarSign className="w-6 h-6 text-blue-500" /></div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between border-l-4 border-l-green-500">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">總收入</p>
                  <h3 className="text-2xl font-bold text-green-600">${totalIncome.toLocaleString()}</h3>
                </div>
                <div className="bg-green-50 p-3 rounded-full"><TrendingUp className="w-6 h-6 text-green-500" /></div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between border-l-4 border-l-red-500">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">總支出</p>
                  <h3 className="text-2xl font-bold text-red-600">${totalExpense.toLocaleString()}</h3>
                </div>
                <div className="bg-red-50 p-3 rounded-full"><TrendingDown className="w-6 h-6 text-red-500" /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-24">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    {editingId ? <Edit2 className="w-5 h-5 text-blue-600" /> : <TrendingUp className="w-5 h-5 text-blue-600" />}
                    {editingId ? '編輯記錄' : '新增記錄'}
                  </h3>
                  <form onSubmit={handleSubmitTransaction} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">日期</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, type: 'expense'})}
                        className={`py-2 rounded-lg font-medium transition-all ${formData.type === 'expense' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                      >
                        支出
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, type: 'income'})}
                        className={`py-2 rounded-lg font-medium transition-all ${formData.type === 'income' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                      >
                        收入
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">分類</label>
                      <input
                        type="text"
                        required
                        placeholder="例如: 早餐、薪水..."
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">金額</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">備註 (選填)</label>
                      <input
                        type="text"
                        placeholder="詳細說明..."
                        value={formData.note}
                        onChange={(e) => setFormData({...formData, note: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="pt-2 flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg shadow-sm transition-colors"
                      >
                        {editingId ? '儲存修改' : '新增記錄'}
                      </button>
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setFormData(initialForm); }}
                          className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">近期記錄</h3>
                  </div>
                  
                  {sortedTransactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p>目前還沒有任何記錄，開始記帳吧！</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {sortedTransactions.map((item) => (
                        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {item.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-lg">{item.category}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{item.date}</span>
                              </div>
                              {item.note && <p className="text-sm text-slate-500 mt-0.5">{item.note}</p>}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                            <div className={`font-bold text-xl ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                            </div>
                            
                            {deletingId === item.id ? (
                              <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-100">
                                <span className="text-xs text-red-600 font-medium px-1">確定刪除?</span>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setDeletingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="編輯"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingId(item.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="刪除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-4">
                <Settings className="w-5 h-5 text-slate-500" />
                系統設定
              </h2>
              
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">修改登入密碼</label>
                  <p className="text-xs text-slate-400 mb-3">這將會同步更新到資料庫中，下次登入需使用新密碼。</p>
                  <input
                    type="text"
                    required
                    placeholder="輸入新密碼"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {settingMessage && (
                  <div className={`p-3 rounded-lg text-sm ${settingMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {settingMessage}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  儲存新密碼
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
