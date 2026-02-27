import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { Wallet, TrendingUp, TrendingDown, Edit2, Trash2, LogOut, Settings, PlusCircle, List, Lock, Check } from "lucide-react";

// --- Firebase 初始化配置 ---
// 自動判斷是否在預覽環境，若非預覽環境則使用您提供的 API Key
const isEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = isEnv ? JSON.parse(__firebase_config) : {
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
const envAppId = typeof __app_id !== 'undefined' ? __app_id : 'test-ff8f4';

// 動態獲取集合路徑 (兼容預覽環境安全規則與本地標準開發)
const getCollectionPath = (collectionName) => {
  if (isEnv) {
    return `artifacts/${envAppId}/public/data/${collectionName}`;
  }
  return collectionName;
};

export default function App() {
  // --- 狀態管理 ---
  const [fbUser, setFbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // 密碼與設定
  const [appPassword, setAppPassword] = useState('1234');
  const [loginInput, setLoginInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  // 記帳資料與表單
  const [records, setRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'settings'
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '',
    amount: '',
    note: ''
  });

  // --- Firebase 驗證與資料獲取 ---
  useEffect(() => {
    // 1. 初始化 Firebase 匿名驗證 (確保能讀寫資料庫)
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

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFbUser(user);
    });
    
    // 檢查 LocalStorage 登入狀態
    const storedLogin = localStorage.getItem('isAccountingAppLoggedIn');
    if (storedLogin === 'true') {
      setIsLoggedIn(true);
    }

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!fbUser) return;

    // 2. 獲取系統密碼設定
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, getCollectionPath('settings'), 'auth');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          setAppPassword(snap.data().password);
        } else {
          // 初始化預設密碼
          await setDoc(settingsRef, { password: '1234' });
          setAppPassword('1234');
        }
      } catch (error) {
        console.error("Fetch settings error:", error);
      }
    };

    // 3. 監聽記帳紀錄
    const fetchRecords = () => {
      const q = collection(db, getCollectionPath('records'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = [];
        snapshot.forEach(doc => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setRecords(data);
        setLoading(false); // 資料載入完成，解除遮罩
      }, (error) => {
        console.error("Fetch records error:", error);
        setLoading(false);
      });
      return unsubscribe;
    };

    fetchSettings().then(() => {
      const unsubRecords = fetchRecords();
      return () => unsubRecords();
    });

  }, [fbUser]);

  // --- 邏輯處理 ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === appPassword) {
      setIsLoggedIn(true);
      localStorage.setItem('isAccountingAppLoggedIn', 'true');
      setLoginInput('');
    } else {
      alert("密碼錯誤，請重試！");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isAccountingAppLoggedIn');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount || !formData.date) return;

    const recordToSave = {
      ...formData,
      amount: parseFloat(formData.amount),
      timestamp: new Date().getTime() // 輔助時間戳
    };

    try {
      if (isEditing) {
        await updateDoc(doc(db, getCollectionPath('records'), isEditing), recordToSave);
        setIsEditing(null);
      } else {
        await addDoc(collection(db, getCollectionPath('records')), recordToSave);
      }
      // 重置表單
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: '',
        amount: '',
        note: ''
      });
    } catch (error) {
      console.error("Save error:", error);
      alert("儲存失敗！");
    }
  };

  const handleEdit = (record) => {
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      amount: record.amount.toString(),
      note: record.note || ''
    });
    setIsEditing(record.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定要刪除這筆紀錄嗎？')) {
      try {
        await deleteDoc(doc(db, getCollectionPath('records'), id));
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return;
    try {
      const settingsRef = doc(db, getCollectionPath('settings'), 'auth');
      await updateDoc(settingsRef, { password: newPassword });
      setAppPassword(newPassword);
      setNewPassword('');
      setSettingsMessage('密碼修改成功！');
      setTimeout(() => setSettingsMessage(''), 3000);
    } catch (error) {
      console.error("Change password error:", error);
      setSettingsMessage('修改失敗，請稍後再試。');
    }
  };

  // --- 資料計算與排序 ---
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let inc = 0, exp = 0;
    records.forEach(r => {
      if (r.type === 'income') inc += r.amount;
      if (r.type === 'expense') exp += r.amount;
    });
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [records]);

  // 記憶體內日期降序排列
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [records]);


  // --- 畫面渲染 ---

  // 1. 全螢幕載入中遮罩
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-700 tracking-wide">系統載入中...</h2>
        <p className="text-slate-500 mt-2 text-sm">正在同步您的雲端資料庫</p>
      </div>
    );
  }

  // 2. 登入介面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full text-blue-600">
              <Wallet size={36} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">簡易記帳系統</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">請輸入系統密碼</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="預設密碼為 1234"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Lock size={18} /> 登入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. 主應用程式介面
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      {/* 導覽列 */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <Wallet size={24} className="stroke-2" />
            <span className="font-bold text-lg tracking-wide text-slate-800 hidden sm:inline-block">個人財務管理</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-4">
            <button 
              onClick={() => setActiveTab('main')}
              className={`px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'main' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <List size={18} /> <span className="hidden sm:inline">記帳板</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Settings size={18} /> <span className="hidden sm:inline">設定</span>
            </button>
            <div className="w-px h-6 bg-slate-300 mx-1"></div>
            <button 
              onClick={handleLogout}
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 pt-8">
        {activeTab === 'settings' ? (
          /* 設定頁面 */
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Lock className="text-blue-500" /> 修改登入密碼
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">新密碼</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="輸入新的安全密碼"
                />
              </div>
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-xl transition">
                儲存設定
              </button>
              {settingsMessage && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm flex items-center gap-2">
                  <Check size={16} /> {settingsMessage}
                </div>
              )}
            </form>
          </div>
        ) : (
          /* 記帳主頁面 */
          <>
            {/* 統計看板 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">總收入</p>
                  <p className="text-2xl font-bold text-emerald-600">${totalIncome.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                  <TrendingDown size={28} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">總支出</p>
                  <p className="text-2xl font-bold text-rose-600">${totalExpense.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                  <Wallet size={28} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">結餘</p>
                  <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    ${balance.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
              {/* 表單區塊 */}
              <div className="lg:w-1/3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-24">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2 text-slate-800">
                    <PlusCircle className="text-blue-500" /> {isEditing ? '編輯紀錄' : '新增紀錄'}
                  </h2>
                  <form onSubmit={handleSaveRecord} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">日期</label>
                        <input type="date" name="date" required value={formData.date} onChange={handleFormChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">類型</label>
                        <select name="type" value={formData.type} onChange={handleFormChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="expense">支出</option>
                          <option value="income">收入</option>
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">金額</label>
                        <input type="number" name="amount" min="0" step="1" required placeholder="0" value={formData.amount} onChange={handleFormChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-lg" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">分類</label>
                        <input type="text" name="category" required placeholder="例如：餐飲、薪水、交通" value={formData.category} onChange={handleFormChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">備註 (選填)</label>
                        <input type="text" name="note" placeholder="輸入備註細節" value={formData.note} onChange={handleFormChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                    <div className="pt-2 flex gap-2">
                      <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition">
                        {isEditing ? '儲存修改' : '新增紀錄'}
                      </button>
                      {isEditing && (
                        <button type="button" onClick={() => { setIsEditing(null); setFormData({date: new Date().toISOString().split('T')[0], type: 'expense', category: '', amount: '', note: ''})}} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl transition">
                          取消
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* 列表區塊 */}
              <div className="lg:w-2/3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">近期明細</h2>
                    <span className="text-sm text-slate-500 font-medium">共 {records.length} 筆資料</span>
                  </div>
                  
                  {sortedRecords.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                      <List className="mx-auto mb-3 opacity-20" size={48} />
                      <p>目前尚無紀錄，開始新增第一筆吧！</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {sortedRecords.map((record) => (
                        <div key={record.id} className="p-4 sm:p-5 hover:bg-slate-50 transition group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm ${record.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              {record.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800">{record.category}</span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{record.date}</span>
                              </div>
                              {record.note && <p className="text-sm text-slate-500">{record.note}</p>}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 pl-14 sm:pl-0">
                            <span className={`text-lg font-bold ${record.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {record.type === 'income' ? '+' : '-'}${Number(record.amount).toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => handleEdit(record)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition" title="編輯">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => handleDelete(record.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="刪除">
                                <Trash2 size={18} />
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
        )}
      </main>
    </div>
  );
}
