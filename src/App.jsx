import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Wallet, TrendingUp, TrendingDown, Settings, LogOut, Edit2, Trash2, Plus, Check, X, Lock } from 'lucide-react';

// ----------------------------------------------------------------------
// 1. Firebase 初始化 (使用提供的 API Key)
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// 2. 主應用程式元件
// ----------------------------------------------------------------------
export default function App() {
  // 系統狀態
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isRecordsLoaded, setIsRecordsLoaded] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [systemPassword, setSystemPassword] = useState('1234'); // 預設密碼
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState('');

  // 資料狀態
  const [records, setRecords] = useState([]);
  
  // 表單與輸入狀態
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // 記帳表單預設值
  const defaultForm = {
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '',
    amount: '',
    note: ''
  };
  const [formData, setFormData] = useState(defaultForm);

  // ----------------------------------------------------------------------
  // 3. 抓取 Firebase 資料
  // ----------------------------------------------------------------------
  useEffect(() => {
    // 監聽密碼設定
    const unsubSettings = onSnapshot(doc(db, 'settings', 'auth'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().password) {
        setSystemPassword(docSnap.data().password);
      } else {
        // 如果資料庫還沒有密碼設定，初始化預設密碼 1234
        setDoc(doc(db, 'settings', 'auth'), { password: '1234' }, { merge: true }).catch(err => console.error(err));
        setSystemPassword('1234');
      }
      setIsSettingsLoaded(true);
      setDbError(false);
    }, (error) => {
      console.error("設定載入失敗:", error);
      if (error.code === 'permission-denied') {
        setDbError(true);
      }
      setIsSettingsLoaded(true);
    });

    // 監聽記帳紀錄
    const unsubRecords = onSnapshot(collection(db, 'records'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 在記憶體中進行排序：依日期降序，若日期相同則依建立時間降序 (避免複雜查詢需要建立索引)
      data.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setRecords(data);
      setIsRecordsLoaded(true);
      setDbError(false);
    }, (error) => {
      console.error("紀錄載入失敗:", error);
      if (error.code === 'permission-denied') {
        setDbError(true);
      }
      setIsRecordsLoaded(true);
    });

    return () => {
      unsubSettings();
      unsubRecords();
    };
  }, []);

  const isLoading = !(isSettingsLoaded && isRecordsLoaded) && !dbError;

  // ----------------------------------------------------------------------
  // 4. 邏輯處理函數
  // ----------------------------------------------------------------------
  const showNotification = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (inputPassword === systemPassword) {
      localStorage.setItem('isLoggedIn', 'true');
      setIsLoggedIn(true);
      setLoginError('');
      setInputPassword('');
    } else {
      setLoginError('密碼錯誤，請重試！');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    setShowSettings(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.trim().length === 0) return;
    try {
      await setDoc(doc(db, 'settings', 'auth'), { password: newPassword }, { merge: true });
      setSystemPassword(newPassword);
      setNewPassword('');
      setShowSettings(false);
      showNotification('密碼修改成功！');
    } catch (error) {
      showNotification('密碼修改失敗');
    }
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.category || !formData.amount) {
      showNotification('請填寫完整資訊');
      return;
    }

    const recordData = {
      ...formData,
      amount: Number(formData.amount),
      createdAt: editingId ? records.find(r => r.id === editingId)?.createdAt : Date.now()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'records', editingId), recordData);
        setEditingId(null);
        showNotification('紀錄更新成功！');
      } else {
        await addDoc(collection(db, 'records'), recordData);
        showNotification('新增紀錄成功！');
      }
      // 重置表單，但保留日期與類型以便連續輸入
      setFormData(prev => ({ ...prev, category: '', amount: '', note: '' }));
    } catch (error) {
      showNotification('儲存失敗');
    }
  };

  const handleEdit = (record) => {
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      amount: record.amount,
      note: record.note
    });
    setEditingId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定要刪除這筆紀錄嗎？')) {
      try {
        await deleteDoc(doc(db, 'records', id));
        showNotification('紀錄已刪除');
      } catch (error) {
        showNotification('刪除失敗');
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(defaultForm);
  };

  // ----------------------------------------------------------------------
  // 5. 畫面計算與渲染
  // ----------------------------------------------------------------------
  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  // 資料庫權限錯誤畫面
  if (dbError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-lg w-full border border-red-100">
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 p-4 rounded-full">
              <X className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-red-600 mb-4">資料庫權限被拒 (Permission Denied)</h2>
          <p className="text-gray-700 mb-4 text-center">
            系統無法讀寫資料庫。請確認您已在 Firebase 控制台的 <strong>Firestore Rules</strong> 設定為允許測試存取。
          </p>
          <div className="bg-gray-100 p-4 rounded-xl text-sm font-mono overflow-x-auto mb-6 border border-gray-200">
            <p className="text-gray-500 mb-2">// 請將規則修改為以下內容並發布：</p>
            rules_version = '2';<br />
            service cloud.firestore {'{'}<br />
            &nbsp;&nbsp;match /databases/{"{database}"}/documents {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;match /{"{document=**}"} {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;<br />
            &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br />
            &nbsp;&nbsp;{'}'}<br />
            {'}'}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors shadow-md shadow-red-200"
          >
            我已更新規則，重新整理頁面
          </button>
        </div>
      </div>
    );
  }

  // 載入中遮罩
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center z-50">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-700 tracking-wider">系統載入中...</h2>
        <p className="text-gray-400 mt-2 text-sm">正在同步雲端資料</p>
      </div>
    );
  }

  // 登入畫面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-sm w-full border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">專屬記帳系統</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">請輸入系統密碼</label>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="預設密碼: 1234"
                autoFocus
              />
              {loginError && <p className="text-red-500 text-sm mt-2">{loginError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors shadow-md shadow-blue-200"
            >
              登入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 主畫面
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* 頂部導覽 */}
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Wallet className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">記帳系統</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:bg-red-50 text-red-500 rounded-full transition-colors flex items-center"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* 提示訊息 (Toast) */}
      {toast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2 animate-bounce">
          <Check className="w-4 h-4 text-green-400" />
          <span>{toast}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* 設定區塊 (後台管理) */}
        {showSettings && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-500" /> 系統設定
            </h2>
            <form onSubmit={handlePasswordChange} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">修改登入密碼</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="輸入新密碼"
                />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full sm:w-auto bg-gray-800 hover:bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
                  儲存密碼
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 統計看板 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* 總收入 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-50 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-emerald-50 p-6 rounded-full group-hover:scale-110 transition-transform">
              <TrendingUp className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
            <p className="text-emerald-600 text-sm font-bold mb-1">總收入</p>
            <h3 className="text-3xl font-bold text-gray-800">${totalIncome.toLocaleString()}</h3>
          </div>
          {/* 總支出 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-50 relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 bg-rose-50 p-6 rounded-full group-hover:scale-110 transition-transform">
              <TrendingDown className="w-8 h-8 text-rose-500 opacity-50" />
            </div>
            <p className="text-rose-600 text-sm font-bold mb-1">總支出</p>
            <h3 className="text-3xl font-bold text-gray-800">${totalExpense.toLocaleString()}</h3>
          </div>
          {/* 結餘 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-blue-50 p-6 rounded-full group-hover:scale-110 transition-transform">
              <Wallet className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
            <p className="text-blue-600 text-sm font-bold mb-1">目前結餘</p>
            <h3 className={`text-3xl font-bold ${balance >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>
              ${balance.toLocaleString()}
            </h3>
          </div>
        </div>

        {/* 新增/編輯表單 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center">
            {editingId ? <Edit2 className="w-5 h-5 mr-2 text-blue-500" /> : <Plus className="w-5 h-5 mr-2 text-blue-500" />}
            {editingId ? '編輯紀錄' : '新增紀錄'}
          </h2>
          <form onSubmit={handleSaveRecord} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">日期</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">類型</label>
              <select
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">分類</label>
              <input
                type="text"
                required
                placeholder="如: 餐飲、薪資"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">金額</label>
              <input
                type="number"
                required
                min="0"
                placeholder="0"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="lg:col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">備註</label>
              <input
                type="text"
                placeholder="選填"
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="lg:col-span-1 sm:col-span-2 lg:col-span-1 flex gap-2">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center"
              >
                {editingId ? '儲存' : '新增'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 紀錄列表 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">明細紀錄</h2>
            <span className="text-sm text-gray-500">共 {records.length} 筆</span>
          </div>
          
          <div className="overflow-x-auto">
            {records.length === 0 ? (
               <div className="p-8 text-center text-gray-400">
                 目前還沒有任何紀錄喔！
               </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500 text-sm">
                    <th className="px-6 py-3 font-medium">日期</th>
                    <th className="px-6 py-3 font-medium">分類</th>
                    <th className="px-6 py-3 font-medium">備註</th>
                    <th className="px-6 py-3 font-medium text-right">金額</th>
                    <th className="px-6 py-3 font-medium text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 text-gray-600">{record.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          record.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {record.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{record.note || '-'}</td>
                      <td className={`px-6 py-4 text-right font-bold ${
                        record.type === 'income' ? 'text-emerald-600' : 'text-gray-800'
                      }`}>
                        {record.type === 'income' ? '+' : '-'}${record.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(record)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="編輯"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(record.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
