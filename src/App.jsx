import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Settings, 
  LogOut, 
  Edit2, 
  Trash2, 
  Plus,
  Lock,
  Loader2,
  CheckCircle2
} from 'lucide-react';

// 1. Firebase 配置 (使用您提供的金鑰)
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

// 2. 內嵌樣式與動畫 (滿足樣式需求)
const CustomStyles = () => (
  <style>{`
    .fade-in { animation: fadeIn 0.4s ease-out; }
    .slide-up { animation: slideUp 0.4s ease-out forwards; }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* 隱藏數字輸入框的上下箭頭 */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    
    /* 自訂捲軸 */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  `}</style>
);

export default function App() {
  // --- 狀態管理 ---
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [systemPass, setSystemPass] = useState('1234');
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'settings'
  
  // 表單狀態
  const getToday = () => new Date().toISOString().split('T')[0];
  const initialForm = { date: getToday(), type: 'expense', category: '', amount: '', note: '' };
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  
  // 刪除確認彈窗狀態
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // 設定頁面狀態
  const [newPassword, setNewPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  // --- 初始化與資料獲取 ---
  useEffect(() => {
    // 檢查 localStorage 登入狀態
    const checkAuth = localStorage.getItem('accounting_logged_in') === 'true';
    if (checkAuth) setIsLoggedIn(true);

    const initSystem = async () => {
      try {
        // 獲取系統密碼設定
        const settingsRef = doc(db, 'settings', 'config');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          setSystemPass(settingsSnap.data().password);
        } else {
          // 如果沒有設定檔，初始化預設密碼 '1234'
          await setDoc(settingsRef, { password: '1234' });
        }

        // 監聽記帳紀錄
        const unsub = onSnapshot(collection(db, 'transactions'), (snapshot) => {
          const data = [];
          snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
          
          // 在前端進行日期降序排列
          data.sort((a, b) => new Date(b.date) - new Date(a.date));
          setTransactions(data);
          setIsLoading(false); // 資料載入完成，解除全螢幕遮罩
        }, (error) => {
          console.error("Firestore 同步錯誤:", error);
          setIsLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error("系統初始化錯誤:", error);
        setIsLoading(false);
      }
    };

    initSystem();
  }, []);

  // --- 計算統計數據 ---
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      const amt = Number(t.amount);
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [transactions]);

  // --- 事件處理 ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === systemPass) {
      localStorage.setItem('accounting_logged_in', 'true');
      setIsLoggedIn(true);
      setLoginError('');
      setLoginInput('');
    } else {
      setLoginError('密碼錯誤，請重試');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accounting_logged_in');
    setIsLoggedIn(false);
    setView('dashboard');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.category || !formData.amount) return;

    const dataToSave = {
      ...formData,
      amount: Number(formData.amount)
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), dataToSave);
      } else {
        await addDoc(collection(db, 'transactions'), dataToSave);
      }
      // 重置表單
      setFormData(initialForm);
      setEditingId(null);
    } catch (error) {
      console.error("儲存失敗:", error);
    }
  };

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

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'transactions', deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("刪除失敗:", error);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setSettingsMessage('密碼長度至少需 4 個字元');
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'config'), { password: newPassword });
      setSystemPass(newPassword);
      setNewPassword('');
      setSettingsMessage('密碼修改成功！');
      setTimeout(() => setSettingsMessage(''), 3000);
    } catch (error) {
      console.error("密碼修改失敗:", error);
      setSettingsMessage('修改失敗，請稍後再試');
    }
  };

  // --- 畫面渲染 ---

  // 1. 全螢幕載入遮罩
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center">
        <CustomStyles />
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-medium text-slate-700 fade-in">系統載入中...</h2>
        <p className="text-slate-500 text-sm mt-2 fade-in">正在連線至安全資料庫</p>
      </div>
    );
  }

  // 2. 登入畫面 (確保完全水平垂直置中)
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center p-4">
        <CustomStyles />
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm slide-up border border-slate-100">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-2 text-slate-800">歡迎回來</h2>
          <p className="text-center text-slate-500 mb-8 text-sm">請輸入安全密碼以存取您的記帳資料</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="password"
                placeholder="請輸入密碼"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-center tracking-widest text-lg"
                autoFocus
              />
              {loginError && <p className="text-red-500 text-sm mt-2 text-center">{loginError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] shadow-md hover:shadow-lg flex justify-center items-center gap-2"
            >
              進入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. 主應用程式畫面
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <CustomStyles />
      
      {/* 頂部導航列 */}
      <nav className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800 tracking-wide">簡易記帳</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setView('dashboard')}
                className={`p-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="hidden sm:inline">儀表板</span>
                <Wallet className="w-5 h-5 sm:hidden" />
              </button>
              <button 
                onClick={() => setView('settings')}
                className={`p-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-colors ${view === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="hidden sm:inline">設定</span>
                <Settings className="w-5 h-5 sm:hidden" />
              </button>
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <button 
                onClick={handleLogout}
                className="p-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">登出</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 內容區域 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 fade-in">
        
        {view === 'dashboard' ? (
          <>
            {/* 統計看板 (不同顏色區分) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-50 rounded-full group-hover:scale-110 transition-transform"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-medium">總收入</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-800">
                    $ {stats.income.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-50 rounded-full group-hover:scale-110 transition-transform"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <TrendingDown className="w-5 h-5" />
                    <span className="font-medium">總支出</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-800">
                    $ {stats.expense.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <Wallet className="w-5 h-5" />
                    <span className="font-medium">結餘</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-800">
                    $ {stats.balance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 新增/編輯表單 */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-24">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    {editingId ? <Edit2 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                    {editingId ? '編輯紀錄' : '新增紀錄'}
                  </h3>
                  
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">日期</label>
                      <input 
                        type="date" 
                        required
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">類型</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, type: 'expense'})}
                          className={`py-2 rounded-lg text-sm font-medium transition-all ${formData.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          支出
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, type: 'income'})}
                          className={`py-2 rounded-lg text-sm font-medium transition-all ${formData.type === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          收入
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">分類</label>
                      <input 
                        type="text" 
                        required
                        placeholder="例如：餐飲、交通、薪水..."
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">金額</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        placeholder="0"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">備註 (選填)</label>
                      <input 
                        type="text" 
                        placeholder="寫點什麼..."
                        value={formData.note}
                        onChange={e => setFormData({...formData, note: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button 
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] shadow-sm flex justify-center items-center gap-2"
                      >
                        {editingId ? '儲存修改' : '新增紀錄'}
                      </button>
                      {editingId && (
                        <button 
                          type="button"
                          onClick={() => { setEditingId(null); setFormData(initialForm); }}
                          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all active:scale-[0.98]"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* 交易列表 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">近期紀錄</h3>
                    <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">共 {transactions.length} 筆</span>
                  </div>
                  
                  {transactions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>尚無任何記帳紀錄，趕快來新增一筆吧！</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {transactions.map((t) => (
                        <div key={t.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {t.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800 text-lg">{t.category}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{t.date}</span>
                              </div>
                              {t.note && <p className="text-sm text-slate-500">{t.note}</p>}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full pl-16 sm:pl-0">
                            <span className={`text-xl font-bold ${t.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                              {t.type === 'income' ? '+' : '-'} ${Number(t.amount).toLocaleString()}
                            </span>
                            <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEdit(t)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="編輯"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(t.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* 設定頁面 */
          <div className="max-w-md mx-auto slide-up">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-6">
                <Settings className="w-6 h-6 text-slate-700" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">系統設定</h2>
              <p className="text-slate-500 mb-8 text-sm">修改您的登入密碼以確保資料安全。</p>
              
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">新密碼</label>
                  <input
                    type="text"
                    placeholder="請輸入新密碼 (至少 4 碼)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] shadow-md"
                >
                  儲存新密碼
                </button>

                {settingsMessage && (
                  <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${settingsMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {settingsMessage.includes('成功') ? <CheckCircle2 className="w-5 h-5" /> : null}
                    {settingsMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </main>

      {/* 自訂刪除確認彈窗 (取代原生的 confirm) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full slide-up">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-center text-slate-800">確認刪除</h3>
            <p className="text-slate-500 mb-6 text-center">確定要刪除這筆記帳紀錄嗎？<br/>此動作無法復原。</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
