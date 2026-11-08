import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  AppData,
  ActiveTab,
  DivisionMode,
  DateFilterType,
  DateRange,
  Customer,
  Vehicle,
  LpgTransaction,
  ExpeditionTrip,
  Expense,
  CompanySettings,
  FinancialSummary
} from './types';
import { storageService } from './services/storage';
import { excelExportService } from './services/excelExport';
import { fileSystemService } from './services/fileSystemService';
import { getTodayDateString, getCurrentMonthString, getCurrentMonthRange, indonesianMonths, formatDate } from './utils/formatters';


// Components & Views
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LpgDashboardView } from './views/LpgDashboardView';
import { LpgView } from './views/LpgView';
import { LpgReportsView } from './views/LpgReportsView';
import { ExpeditionDashboardView } from './views/ExpeditionDashboardView';
import { ExpeditionView } from './views/ExpeditionView';
import { ExpeditionReportsView } from './views/ExpeditionReportsView';
import { ConsolidationView } from './views/ConsolidationView';
import { ExpensesView } from './views/ExpensesView';
import { ReportsView } from './views/ReportsView';
import { DataManagerView } from './views/DataManagerView';
import { SettingsView } from './views/SettingsView';
import { SplashScreen } from './components/onboarding/SplashScreen';
import { WelcomeScreen } from './components/onboarding/WelcomeScreen';
import { SetupProfileScreen } from './components/onboarding/SetupProfileScreen';

export function App() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [divisionMode, setDivisionMode] = useState<DivisionMode>('consolidation');
  const [activeTab, setActiveTab] = useState<ActiveTab>('consolidation-dashboard');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
  const [dateRange, setDateRange] = useState<DateRange>(() => getCurrentMonthRange());
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [exportFolderName, setExportFolderName] = useState<string>(fileSystemService.getDirectoryName());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [onboardingStep, setOnboardingStep] = useState<'splash' | 'welcome' | 'setup' | 'done'>('splash');

  const [exportNotif, setExportNotif] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const notifTimeoutRef = useRef<number | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const showExportNotif = useCallback((type: 'success' | 'error', message: string) => {
    setExportNotif({ type, message });
    if (notifTimeoutRef.current) {
      window.clearTimeout(notifTimeoutRef.current);
    }
    notifTimeoutRef.current = window.setTimeout(() => {
      setExportNotif(null);
    }, 7000);
  }, []);

  // Load Data on Startup (Asynchronous for IndexedDB)
  useEffect(() => {
    storageService.loadAppDataAsync().then((data) => {
      setAppData(data);
      setIsLoading(false);
    }).catch((err) => {
      console.error('Failed to load initial data:', err);
      // Fallback
      setAppData(storageService.loadAppData());
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    fileSystemService.init().then((name) => {
      if (name) setExportFolderName(name);
      storageService.startAutoBackupScheduler(() => null);
    });
  }, []);

  const handleSelectExportFolder = async () => {
    const res = await fileSystemService.selectDirectory();
    if (res.success) {
      setExportFolderName(res.folderName);
      if (appData) void storageService.performAutoBackupToLocalFile(appData, 'manual');
      showExportNotif('success', `Folder penyimpanan & auto-backup diatur ke: "${res.folderName}"`);
    } else if (res.error && res.error !== 'Pemilihan folder dibatalkan.') {
      showExportNotif('error', `Gagal memilih folder: ${res.error}`);
    }
  };

  // Auto persist to IndexedDB when appData changes
  const updateAppData = (updater: (prev: AppData) => AppData) => {
    setAppData((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      storageService.scheduleAutoSave(next);
      return next;
    });
    setIsDirty(true);
  };

  // Date Filter Label (100% Dynamic based on active system date & user selection)
  const periodLabel = useMemo(() => {
    const now = new Date();
    const currentMonthName = indonesianMonths[now.getMonth()] || '';
    const currentYear = now.getFullYear();

    if (dateFilter === 'today') return `Hari Ini (${formatDate(getTodayDateString(), 'short')})`;
    if (dateFilter === 'week') return 'Minggu Ini';
    if (dateFilter === 'month') return `Bulan Ini (${currentMonthName} ${currentYear})`;
    if (dateFilter === 'year') return `Tahun Ini (${currentYear})`;
    if (dateFilter === 'custom') {
      const start = dateRange.startDate ? formatDate(dateRange.startDate, 'short') : '-';
      const end = dateRange.endDate ? formatDate(dateRange.endDate, 'short') : '-';
      return `${start} s/d ${end}`;
    }
    return 'Semua Waktu';
  }, [dateFilter, dateRange]);

  // Date filter matcher helper (100% Dynamic based on real calendar dates)
  // Dependency dipecah ke dua primitif string (startDate, endDate) agar
  // isDateInFilter TIDAK membuat referensi baru ketika object dateRange
  // diganti ulang dengan nilai yang sama (React.Object.is gagal pada object).
  const startDate = dateRange.startDate;
  const endDate   = dateRange.endDate;
  const isDateInFilter = useCallback((dateStr: string): boolean => {
    if (!dateStr) return false;
    if (dateFilter === 'all') return true;

    const todayStr = getTodayDateString();
    const currentMonth = getCurrentMonthString();
    const currentYear = todayStr.slice(0, 4);

    if (dateFilter === 'today') {
      return dateStr === todayStr;
    }
    if (dateFilter === 'month') {
      return dateStr.startsWith(currentMonth);
    }
    if (dateFilter === 'year') {
      return dateStr.startsWith(currentYear);
    }
    if (dateFilter === 'week') {
      const d = new Date();
      const day = d.getDay(); // 0 is Sunday, 1 is Monday
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);
      const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      return dateStr >= mondayStr && dateStr <= todayStr;
    }
    if (dateFilter === 'custom') {
      if (startDate && endDate) return dateStr >= startDate && dateStr <= endDate;
      if (startDate) return dateStr >= startDate;
      if (endDate) return dateStr <= endDate;
      return true;
    }
    return true;
  }, [dateFilter, startDate, endDate]);

  // Calculate Financial Summary based on active date filter
  const financialSummary: FinancialSummary = useMemo(() => {
    if (!appData) {
      return {
        totalRevenue: 0, lpgRevenue: 0, expeditionRevenue: 0,
        totalExpenses: 0, lpgExpenses: 0, expeditionExpenses: 0, generalExpenses: 0,
        netProfit: 0, totalLpgCylinders: 0, totalLpgTransactions: 0,
        totalTrips: 0, totalDistanceKm: 0, totalWeightKg: 0, totalTonnage: 0,
      };
    }

    const filteredLpg = appData.lpgTransactions.filter((t) => isDateInFilter(t.date));
    const filteredExp = appData.expeditionTrips.filter((t) => isDateInFilter(t.date));
    const filteredExpenses = appData.expenses.filter((e) => isDateInFilter(e.date));

    const lpgRevenue = filteredLpg.reduce((sum, t) => sum + t.total, 0);
    const expeditionRevenue = filteredExp.reduce((sum, t) => sum + t.totalRevenue, 0);
    const totalRevenue = lpgRevenue + expeditionRevenue;

    const lpgExpenses = filteredExpenses
      .filter((e) => e.sector === 'lpg')
      .reduce((sum, e) => sum + e.total, 0);

    const expeditionExpenses = filteredExpenses
      .filter((e) => e.sector === 'expedition')
      .reduce((sum, e) => sum + e.total, 0);

    const generalExpenses = filteredExpenses
      .filter((e) => e.sector === 'general')
      .reduce((sum, e) => sum + e.total, 0);

    const totalExpenses = lpgExpenses + expeditionExpenses + generalExpenses;
    const netProfit = totalRevenue - totalExpenses;

    const totalLpgCylinders = filteredLpg.reduce((sum, t) => sum + t.quantity, 0);
    const totalLpgTransactions = filteredLpg.length;
    const totalTrips = filteredExp.length;
    const totalDistanceKm = filteredExp.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
    const totalWeightKg = filteredExp.reduce((sum, t) => sum + (t.weightKg || 0), 0);
    // Hitung tonase secara aman per rit
    const totalTonnage = filteredExp.reduce((sum, t) => sum + (t.weightKg ? t.weightKg / 1000 : (t.tonnage || 0)), 0);

    return {
      totalRevenue,
      lpgRevenue,
      expeditionRevenue,
      totalExpenses,
      lpgExpenses,
      expeditionExpenses,
      generalExpenses,
      netProfit,
      totalLpgCylinders,
      totalLpgTransactions,
      totalTrips,
      totalDistanceKm,
      totalWeightKg,
      totalTonnage,
    };
  }, [appData?.lpgTransactions, appData?.expeditionTrips, appData?.expenses, dateFilter, dateRange]);

  // Dynamic Export Period Resolver
  const getActiveExportPeriod = useCallback(() => {
    if (dateFilter === 'custom' && dateRange.startDate) {
      const parts = dateRange.startDate.split('-');
      const yr = parseInt(parts[0], 10) || new Date().getFullYear();
      const mo = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
      const mName = indonesianMonths[mo - 1] || 'Bulan';
      return { year: yr, month: mo, monthName: mName };
    }
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth() + 1;
    const mName = indonesianMonths[mo - 1] || 'Bulan';
    return { year: yr, month: mo, monthName: mName };
  }, [dateFilter, dateRange]);

  // Export Excel Handlers (Dynamic Year & Month)
  const handleExportExpeditionExcel = async () => {
    if (!appData) return;
    try {
      const filteredExp = appData.expeditionTrips.filter((t) => isDateInFilter(t.date));
      const filteredExpenses = appData.expenses.filter((e) => e.sector === 'expedition' && isDateInFilter(e.date));

      let periodLabel = 'Semua Waktu';
      let fileNameSuffix = 'Semua_Waktu';
      if (dateFilter === 'custom' && dateRange.startDate && dateRange.endDate) {
        periodLabel = `${dateRange.startDate} s/d ${dateRange.endDate}`;
        fileNameSuffix = `${dateRange.startDate}_sd_${dateRange.endDate}`;
      } else if (dateFilter !== 'all') {
        const { year, monthName } = getActiveExportPeriod();
        periodLabel = `${monthName} ${year}`;
        fileNameSuffix = `${monthName}_${year}`;
      }

      const res = await excelExportService.exportExpeditionRecap(appData, filteredExp, filteredExpenses, periodLabel, fileNameSuffix);
      if (res.mode === 'filesystem') {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil otomatis disimpan ke folder: "${res.folderName}"!`);
      } else {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil diunduh!`);
      }
    } catch (error: any) {
      showExportNotif('error', `Gagal mengekspor file Excel: ${error?.message || error}`);
    }
  };

  const handleExportMonthlyExcel = async () => {
    if (!appData) return;
    try {
      const { year, monthName } = getActiveExportPeriod();

      let periodLabel = 'Semua Waktu';
      let fileNameSuffix = 'Semua_Waktu';
      if (dateFilter === 'custom' && dateRange.startDate && dateRange.endDate) {
        periodLabel = `${dateRange.startDate} s/d ${dateRange.endDate}`;
        fileNameSuffix = `${dateRange.startDate}_sd_${dateRange.endDate}`;
      } else if (dateFilter !== 'all') {
        periodLabel = `${monthName} ${year}`;
        fileNameSuffix = `${monthName}_${year}`;
      }

      let res;
      if (divisionMode === 'lpg') {
        const filteredLpg = appData.lpgTransactions.filter((t) => isDateInFilter(t.date));
        const filteredExpenses = appData.expenses.filter((e) => e.sector === 'lpg' && isDateInFilter(e.date));
        res = await excelExportService.exportLpgRecap(appData, filteredLpg, filteredExpenses, periodLabel, fileNameSuffix);
      } else if (divisionMode === 'expedition') {
        const filteredExp = appData.expeditionTrips.filter((t) => isDateInFilter(t.date));
        const filteredExpenses = appData.expenses.filter((e) => e.sector === 'expedition' && isDateInFilter(e.date));
        res = await excelExportService.exportExpeditionRecap(appData, filteredExp, filteredExpenses, periodLabel, fileNameSuffix);
      } else {
        const filteredLpg = appData.lpgTransactions.filter((t) => isDateInFilter(t.date));
        const filteredExp = appData.expeditionTrips.filter((t) => isDateInFilter(t.date));
        const filteredExpenses = appData.expenses.filter((e) => isDateInFilter(e.date));
        res = await excelExportService.exportMonthlyRecap(appData, filteredLpg, filteredExp, filteredExpenses, periodLabel, fileNameSuffix);
      }
      if (res.mode === 'filesystem') {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil otomatis disimpan ke folder: "${res.folderName}"!`);
      } else {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil diunduh!`);
      }
    } catch (error: any) {
      showExportNotif('error', `Gagal mengekspor file Excel: ${error?.message || error}`);
    }
  };

  // Quick Save Data to JSON File
  const handleQuickSave = async () => {
    if (!appData) return;
    try {
      await storageService.exportDataToFile(appData);
      setIsDirty(false);
    } catch (e) {
      // Penyimpanan dibatalkan atau gagal — tidak ada aksi tambahan yang diperlukan.
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  // LPG Transactions
  const handleAddLpgTransaction = (tx: Omit<LpgTransaction, 'id' | 'createdAt'>) => {
    const newTx: LpgTransaction = {
      ...tx,
      id: `LPG-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateAppData((prev) => ({
      ...prev,
      lpgTransactions: [newTx, ...prev.lpgTransactions],
    }));
  };

  const handleDeleteLpgTransaction = (id: string) => {
    updateAppData((prev) => ({
      ...prev,
      lpgTransactions: prev.lpgTransactions.filter((t) => t.id !== id),
    }));
  };

  // Customers
  const handleAddCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: `CUST-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateAppData((prev) => ({
      ...prev,
      customers: [...prev.customers, newCustomer],
    }));
  };

  const handleUpdateCustomer = (id: string, customer: Partial<Customer>) => {
    updateAppData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...customer } : c)),
    }));
  };

  const handleDeleteCustomer = (id: string) => {
    updateAppData((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== id),
    }));
  };

  // Expedition Trips
  const handleAddTrip = (trip: Omit<ExpeditionTrip, 'id' | 'createdAt'>) => {
    const newTrip: ExpeditionTrip = {
      ...trip,
      id: `EXP-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateAppData((prev) => ({
      ...prev,
      expeditionTrips: [newTrip, ...prev.expeditionTrips],
    }));
  };

  const handleDeleteTrip = (id: string) => {
    updateAppData((prev) => ({
      ...prev,
      expeditionTrips: prev.expeditionTrips.filter((t) => t.id !== id),
    }));
  };

  // Vehicles
  const handleAddVehicle = (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const newVehicle: Vehicle = {
      ...vehicle,
      id: `VEH-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateAppData((prev) => ({
      ...prev,
      vehicles: [...prev.vehicles, newVehicle],
    }));
  };

  const handleUpdateVehicle = (id: string, vehicle: Partial<Vehicle>) => {
    updateAppData((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => (v.id === id ? { ...v, ...vehicle } : v)),
    }));
  };

  const handleDeleteVehicle = (id: string) => {
    updateAppData((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((v) => v.id !== id),
    }));
  };

  // Expenses
  const handleAddExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expense,
      id: `COST-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateAppData((prev) => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses],
    }));
  };

  const handleDeleteExpense = (id: string) => {
    updateAppData((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };



  // Settings
  const handleUpdateSettings = (settings: Partial<CompanySettings>) => {
    updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settings,
      },
      metadata: {
        ...prev.metadata,
        companyName: settings.companyName ?? prev.metadata.companyName,
      },
    }));
  };

  // Data Loaded from File
  const handleDataLoaded = (data: AppData) => {
    setAppData(data);
    setIsDirty(false);
  };

  // Restore data from JSON (used on Welcome → "Pulihkan Data").
  const handleRestoreFile = async (file: File) => {
    const restored = await storageService.restoreDataFromFile(file);
    restored.settings.isSetupComplete = true;
    await storageService.saveAppDataAsync(restored);
    setAppData(restored);
    setIsDirty(false);
    setOnboardingStep('done');
  };

  // Reset to Demo Data
  const handleResetData = async () => {
    setIsLoading(true);
    const reset = await storageService.resetToDefault();
    setAppData(reset);
    setIsDirty(false);
    setIsLoading(false);
  };

  // Clear All Data to Clean Slate (0 Balance / Start From Scratch)
  const handleClearAllData = async (keepMasterData: boolean = false) => {
    if (!appData) return;
    setIsLoading(true);
    const emptyData = await storageService.clearAllData(keepMasterData, appData.settings);
    setAppData(emptyData);
    setIsDirty(false);
    setIsLoading(false);
  };

  if (isLoading || !appData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', backgroundColor: '#f9fafb' }}>
        <div style={{
          width: '50px', height: '50px', border: '5px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ color: '#4b5563', fontFamily: 'system-ui, sans-serif' }}>Memuat Database...</h2>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // True jika aplikasi masih kosong (belum ada data transaksi/master) — panduan pengguna baru.
  const isEmptyDatabase =
    !appData ||
    (appData.customers.length === 0 &&
      appData.vehicles.length === 0 &&
      appData.lpgTransactions.length === 0 &&
      appData.expeditionTrips.length === 0 &&
      appData.expenses.length === 0);

  // ---------------------------------------------------------------------------
  // FLOW ONBOARDING — hanya untuk pengguna baru (database kosong & belum setup).
  // Pengguna lama dengan data tertentu langsung masuk dashboard tanpa splash.
  // ---------------------------------------------------------------------------
  const isSetupComplete = !!appData?.settings?.isSetupComplete;

  if (!isSetupComplete && isEmptyDatabase && onboardingStep !== 'done') {
    if (onboardingStep === 'splash') {
      return (
        <SplashScreen onFinish={() => setOnboardingStep('welcome')} />
      );
    }
    if (onboardingStep === 'welcome') {
      return (
        <>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRestoreFile(file).catch(() => {});
              e.target.value = '';
            }}
          />
          <WelcomeScreen
            onStart={() => setOnboardingStep('setup')}
            onRestore={() => restoreInputRef.current?.click()}
          />
        </>
      );
    }
    if (onboardingStep === 'setup') {
      return (
        <SetupProfileScreen
          onComplete={(settings) => {
            handleUpdateSettings({ ...settings, isSetupComplete: true });
            setOnboardingStep('done');
          }}
        />
      );
    }
  }

  return (
    <div className={`app-container ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {exportNotif && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: exportNotif.type === 'success' ? 'var(--color-success-light, #e8f5e9)' : 'var(--color-error-light, #ffebee)',
          border: `1px solid ${exportNotif.type === 'success' ? 'var(--color-success-border, #4caf50)' : 'var(--color-error, #f44336)'}`,
          color: exportNotif.type === 'success' ? 'var(--color-success-text, #2e7d32)' : 'var(--color-error, #d32f2f)',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '500'
        }}>
          {exportNotif.type === 'success' ? '✅' : '⚠️'}
          <span>{exportNotif.message}</span>
        </div>
      )}
      {/* Sidebar Navigation with Division Mode Switcher */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        divisionMode={divisionMode}
        setDivisionMode={setDivisionMode}
        companyName={appData.settings.companyName}
        companyLogo={appData.settings.logo}
        isDirty={isDirty}
        onQuickSave={handleQuickSave}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          activeTab={activeTab}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          dateRange={dateRange}
          setDateRange={setDateRange}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onExportMonthlyExcel={handleExportMonthlyExcel}
          isDirty={isDirty}
          onSaveData={handleQuickSave}
          exportFolderName={exportFolderName}
          onSelectExportFolder={handleSelectExportFolder}
          companyName={appData.settings.companyName}
          companyLogo={appData.settings.logo}
        />

        <main className="page-body">
          {/* =============================================================== */}
          {/* PANDUAN PENGGUNA BARU — hanya tampil saat database masih kosong */}
          {/* =============================================================== */}
          {isEmptyDatabase && (
            <div
              style={{
                border: '1px solid var(--color-primary-border, #bfdbfe)',
                borderLeft: '5px solid var(--color-primary)',
                borderRadius: 'var(--radius-lg, 12px)',
                backgroundColor: 'var(--color-primary-light, #eff6ff)',
                padding: '22px 26px',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                  🎉 Selamat Datang
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Mulai penggunaan <strong>KasPro</strong>.
                </p>
                <ol style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
                  <li>Lengkapi data perusahaan</li>
                  <li>Tambahkan pelanggan atau kendaraan</li>
                  <li>Input transaksi pertama</li>
                  <li>Lihat laporan bisnis</li>
                </ol>
              </div>
              <div className="onboarding-guide-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { setDivisionMode('consolidation'); setActiveTab('settings'); }}
                >
                  Atur Perusahaan
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setDivisionMode('lpg'); setActiveTab('lpg-customers'); }}
                >
                  Tambah Pelanggan
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setDivisionMode('expedition'); setActiveTab('expedition-vehicles'); }}
                >
                  Tambah Kendaraan
                </button>
              </div>
            </div>
          )}

          {activeTab === 'lpg-dashboard' && (
            <LpgDashboardView
              appData={appData}
              setActiveTab={setActiveTab}
              onExportLpgExcel={handleExportMonthlyExcel}
              periodLabel={periodLabel}
              isDateInFilter={isDateInFilter}
            />
          )}

          {(activeTab === 'lpg-sales' ||
            activeTab === 'lpg-customers' ||
            activeTab === 'lpg-expenses' ||
            activeTab === 'lpg-analytics') && (
            <LpgView
              appData={appData}
              activeSubTab={activeTab}
              onSubTabChange={setActiveTab}
              onAddTransaction={handleAddLpgTransaction}
              onDeleteTransaction={handleDeleteLpgTransaction}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateSettings={handleUpdateSettings}
              isDateInFilter={isDateInFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              dateRange={dateRange}
              setDateRange={setDateRange}
              periodLabel={periodLabel}
            />
          )}

          {activeTab === 'lpg-reports' && (
            <LpgReportsView appData={appData} />
          )}

          {/* =============================================================== */}
          {/* 2. SEKSI HALAMAN DIVISI EKSPEDISI & ARMADA                      */}
          {/* =============================================================== */}
          {activeTab === 'expedition-dashboard' && (
            <ExpeditionDashboardView
              appData={appData}
              setActiveTab={setActiveTab}
              onExportExpeditionExcel={handleExportExpeditionExcel}
              periodLabel={periodLabel}
              isDateInFilter={isDateInFilter}
            />
          )}

          {(activeTab === 'expedition-trips' ||
            activeTab === 'expedition-vehicles' ||
            activeTab === 'expedition-expenses' ||
            activeTab === 'expedition-vehicle-recap' ||
            activeTab === 'expedition-analytics') && (
            <ExpeditionView
              appData={appData}
              activeSubTab={activeTab === 'expedition-expenses' ? 'expedition-vehicle-recap' : activeTab}
              onSubTabChange={setActiveTab}
              onAddTrip={handleAddTrip}
              onDeleteTrip={handleDeleteTrip}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicle={handleUpdateVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateSettings={handleUpdateSettings}
              isDateInFilter={isDateInFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              dateRange={dateRange}
              setDateRange={setDateRange}
              periodLabel={periodLabel}
            />
          )}

          {activeTab === 'expedition-reports' && (
            <ExpeditionReportsView appData={appData} />
          )}

          {/* =============================================================== */}
          {/* 3. SEKSI KONSOLIDASI & KEUANGAN PUSAT                           */}
          {/* =============================================================== */}
          {(activeTab === 'consolidation-dashboard' || activeTab === 'dashboard') && (
            <ConsolidationView
              appData={appData}
              financialSummary={financialSummary}
              onExportMonthlyExcel={handleExportMonthlyExcel}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateSettings={handleUpdateSettings}
              periodLabel={periodLabel}
              isDateInFilter={isDateInFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          )}

          {(activeTab === 'expenses' || activeTab === 'expense-categories') && (
            <ExpensesView
              appData={appData}
              activeSubTab={activeTab}
              onSubTabChange={setActiveTab}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateSettings={handleUpdateSettings}
              isDateInFilter={isDateInFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              dateRange={dateRange}
              setDateRange={setDateRange}
              periodLabel={periodLabel}
            />
          )}

          {(activeTab === 'reports' || activeTab === 'monthly-recap' || activeTab === 'consolidation-reports') && (
            <ReportsView
              appData={appData}
              financialSummary={financialSummary}
              activeSubTab={activeTab === 'consolidation-reports' ? 'reports' : activeTab}
              onSubTabChange={setActiveTab}
              periodLabel={periodLabel}
            />
          )}

          {/* =============================================================== */}
          {/* 4. DATA MANAGER & PENGATURAN                                    */}
          {/* =============================================================== */}
          {activeTab === 'data-manager' && (
            <DataManagerView
              appData={appData}
              onDataLoaded={handleDataLoaded}
              isDirty={isDirty}
              setIsDirty={setIsDirty}
              onResetData={handleResetData}
              onClearAllData={handleClearAllData}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              appData={appData}
              onUpdateSettings={handleUpdateSettings}
              onResetData={handleResetData}
              onClearAllData={handleClearAllData}

            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
