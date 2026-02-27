import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDoc, setDoc, 
  addDoc, updateDoc, deleteDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  Wallet, TrendingUp, TrendingDown, Settings, LogOut, 
  Edit2, Trash2, Plus, Loader2, DollarSign, ArrowLeft, Check, X
} from 'lucide-react';

// --- Firebase 初始化 ---
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

// --- 主應用程式元件 ---
export default function App() {
  // 系統狀態
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'settings'
  const [systemPassword, setSystemPassword] = useState('1234');
  
  // 提示訊息狀態 (取代 alert)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  // 資料狀態
  const [transactions, setTransactions] = useState([]);
  const [loginInput, setLoginInput] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 表單狀態
  const initialForm = {
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '',
    amount: '',
    note: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  // 顯示提示訊息
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // 初始化 Firebase 資料與監聽
  useEffect(() => {
    let unsubscribe = () => {};

    const setupApp = async () => {
      try {
        // 1. 取得或建立系統設定 (密碼)
        const settingsRef = doc(db, 'settings', 'config');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          setSystemPassword(settingsSnap.data().password);
        } else {
          await setDoc(settingsRef, { password: '1234' });
        }

        // 2. 檢查 LocalStorage 登入狀態
        if (localStorage.getItem('isLoggedIn') === 'true') {
          setIsLoggedIn(true);
        }

        // 3. 監聽記帳資料 (在客戶端排序以避免 orderBy 索引問題)
        unsubscribe = onSnapshot(collection(db, 'transactions'), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // 日期降序排列
          data.sort((a, b) => new Date(b.date) - new Date(a.date));
          setTransactions(data);
          setIsLoading(false); // 資料載入完成，關閉遮罩
        }, (error) => {
          console.error("讀取資料失敗:", error);
          showToast('資料庫連線異常，請檢查設定', 'error');
          setIsLoading(false);
        });

      } catch (error) {
        console.error("初始化失敗:", error);
        showToast('系統初始化失敗', 'error');
        setIsLoading(false);
      }
    };

    setupApp();
    return () => unsubscribe();
  }, []);

  // 處理登入
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === systemPassword) {
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
      showToast('登入成功！');
    } else {
      showToast('密碼錯誤，請重試', 'error');
    }
  };

  // 處理登出
  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setLoginInput('');
    setView('dashboard');
    showToast('已登出系統');
  };

  // 處理新增或更新記帳
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) {
      showToast('請填寫分類與金額', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const dataToSave = {
        ...formData,
        amount: Number(formData.amount),
        timestamp: new Date().getTime()
      };

      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), dataToSave);
        showToast('更新成功！');
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'transactions'), dataToSave);
        showToast('新增成功！');
      }
      setFormData(initialForm);
    } catch (error) {
      console.error(error);
      showToast('儲存失敗，請重試', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 處理刪除
  const handleDelete = async (id) => {
    try {
      setIsLoading(true);
      await deleteDoc(doc(db, 'transactions', id));
      showToast('刪除成功！');
      setConfirmDelete(null);
    } catch (error) {
      console.error(error);
      showToast('刪除失敗', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 進入編輯模式
  const startEdit = (transaction) => {
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

  // 取消編輯
  const cancelEdit = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  // 處理修改密碼
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      showToast('密碼長度至少需 4 碼', 'error');
      return;
    }
    try {
      setIsLoading(true);
      await updateDoc(doc(db, 'settings', 'config'), { password: newPassword });
      setSystemPassword(newPassword);
      setNewPassword('');
      setView('dashboard');
      showToast('密碼修改成功！');
    } catch (error) {
      console.error(error);
      showToast('密碼修改失敗', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 計算統計數據
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = totalIncome - totalExpense;

  // --- UI 元件渲染 ---

  // 1. 全螢幕載入遮罩
  if (isLoading && !isLoggedIn && transactions.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">系統載入中...</h2>
        <p className="text-sm text-gray-400 mt-2">正在與 Firebase 建立連線</p>
      </div>
    );
  }

  // 2. 登入畫面 (確保水平垂直完全置中)
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 relative">
        {/* Toast 提示 */}
        {toast.show && (
          <div className={`absolute top-4 px-6 py-3 rounded-xl shadow-lg text-white font-medium transition-all transform translate-y-0 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
            {toast.message}
          </div>
        )}

        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md transform transition-all">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <Wallet className="w-10 h-10 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">專屬記帳系統</h1>
          <p className="text-center text-gray-500 mb-8">請輸入密碼以登入您的帳戶</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                placeholder="請輸入密碼 (預設: 1234)"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-lg text-center tracking-widest"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all hover:shadow-blue-300 transform hover:-translate-y-1 active:translate-y-0"
            >
              登入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. 主系統畫面
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-12 relative">
      {/* 系統層級載入遮罩 (操作中) */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Toast 提示訊息 */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`px-6 py-3 rounded-full shadow-lg text-white font-medium flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* 自訂確認刪除對話框 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">確認刪除</h3>
            <p className="text-gray-500 mb-6">您確定要刪除這筆紀錄嗎？此動作無法復原。</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 導覽列 */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">雲端記帳</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setView(view === 'dashboard' ? 'settings' : 'dashboard')}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex items-center gap-2"
            >
              {view === 'dashboard' ? <Settings className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              <span className="hidden sm:inline font-medium">{view === 'dashboard' ? '設定' : '返回看板'}</span>
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">登出</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 主要內容區 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {view === 'settings' ? (
          /* --- 設定頁面 --- */
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gray-100 p-3 rounded-full">
                <Settings className="w-6 h-6 text-gray-700" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">系統設定</h2>
            </div>
            
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">修改登入密碼</label>
                <input
                  type="password"
                  required
                  placeholder="請輸入新密碼"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                儲存新密碼
              </button>
            </form>
          </div>
        ) : (
          /* --- 儀表板頁面 --- */
          <div className="space-y-8">
            
            {/* 統計卡片區域 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 總收入 (綠色) */}
              <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl p-6 text-white shadow-lg shadow-green-200/50 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-green-50 font-medium mb-1">總收入</p>
                  <h3 className="text-3xl font-bold flex items-center gap-1">
                    <DollarSign className="w-6 h-6 opacity-80" />
                    {totalIncome.toLocaleString()}
                  </h3>
                </div>
                <TrendingUp className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-20 transform -rotate-12" />
              </div>

              {/* 總支出 (紅色) */}
              <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200/50 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-red-50 font-medium mb-1">總支出</p>
                  <h3 className="text-3xl font-bold flex items-center gap-1">
                    <DollarSign className="w-6 h-6 opacity-80" />
                    {totalExpense.toLocaleString()}
                  </h3>
                </div>
                <TrendingDown className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-20 transform rotate-12" />
              </div>

              {/* 結餘 (藍色) */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200/50 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-blue-50 font-medium mb-1">目前結餘</p>
                  <h3 className="text-3xl font-bold flex items-center gap-1">
                    <DollarSign className="w-6 h-6 opacity-80" />
                    {balance.toLocaleString()}
                  </h3>
                </div>
                <Wallet className="absolute -bottom-2 -right-2 w-20 h-20 text-white opacity-20" />
              </div>
            </div>

            {/* 表單與列表的網格佈局 (大螢幕並排，小螢幕堆疊) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* 新增/編輯表單 */}
              <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
                <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                  {editingId ? <Edit2 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                  {editingId ? '編輯紀錄' : '新增紀錄'}
                </h3>
                
                <form onSubmit={handleSubmitTransaction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                    <input
                      type="date"
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">收支類型</label>
                      <select
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                      >
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                    <input
                      type="text"
                      required
                      placeholder="例如：餐飲、交通、薪水"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">備註 (選填)</label>
                    <input
                      type="text"
                      placeholder="輸入相關細節..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      value={formData.note}
                      onChange={(e) => setFormData({...formData, note: e.target.value})}
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-sm shadow-blue-200"
                    >
                      {editingId ? '儲存更新' : '新增一筆'}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* 歷史紀錄列表 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">收支明細</h3>
                    <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                      共 {transactions.length} 筆
                    </span>
                  </div>
                  
                  {transactions.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Wallet className="w-8 h-8 text-gray-300" />
                      </div>
                      <p>目前尚無任何紀錄，請由左方新增。</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                          
                          <div className="flex items-center gap-4">
                            {/* 圖示 */}
                            <div className={`p-3 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {tx.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                            </div>
                            
                            {/* 資訊 */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-900">{tx.category}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{tx.date}</span>
                              </div>
                              {tx.note && <p className="text-sm text-gray-500">{tx.note}</p>}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0">
                            {/* 金額 */}
                            <span className={`font-bold text-lg ${tx.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                              {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                            </span>
                            
                            {/* 操作按鈕 (PC版懸停顯示，手機版常駐) */}
                            <div className="flex items-center gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEdit(tx)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="編輯"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setConfirmDelete(tx.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          </div>
        )}
      </main>
    </div>
  );
}
