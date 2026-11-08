import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Eye,
  ContactRound,
  Flame,
  Wallet,
  ChartNoAxesColumnIncreasing,
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  X,
  Calendar,
  ArrowUpDown,
  FileChartColumn
} from 'lucide-react';
import type { AppData, Customer, LpgTransaction, Expense, ActiveTab, DateFilterType, DateRange } from '../types';
import { formatRupiah, formatNumber, formatDate, getTodayDateString, getCurrentMonthString } from '../utils/formatters';
import { excelExportService } from '../services/excelExport';
import { ExpenseCategoryInput } from '../components/ExpenseCategoryInput';
import { DateFilterBar } from '../components/DateFilterBar';

interface LpgViewProps {
  appData: AppData;
  activeSubTab: 'lpg-sales' | 'lpg-customers' | 'lpg-expenses' | 'lpg-analytics';
  onSubTabChange: (tab: ActiveTab) => void;
  onAddTransaction: (tx: Omit<LpgTransaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  onUpdateCustomer: (id: string, customer: Partial<Customer>) => void;
  onDeleteCustomer: (id: string) => void;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateSettings?: (settings: Partial<any>) => void;
  isDateInFilter: (dateStr: string) => boolean;
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  periodLabel: string;
}

export const LpgView: React.FC<LpgViewProps> = ({
  appData,
  activeSubTab,
  onSubTabChange,
  onAddTransaction,
  onDeleteTransaction,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddExpense,
  onDeleteExpense,
  onUpdateSettings,
  isDateInFilter,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
  periodLabel,
}) => {
  // Modal & Form States
  const [showTxModal, setShowTxModal] = useState(false);
  const [showCustModal, setShowCustModal] = useState(false);
  const [showLpgExpModal, setShowLpgExpModal] = useState(false);
  const [selectedCustomerIdForDetail, setSelectedCustomerIdForDetail] = useState<string | null>(null);

  // Form Fields for LPG Transaction
  const [txDate, setTxDate] = useState(getTodayDateString());
  const [txCustomerId, setTxCustomerId] = useState('');
  const [txCustomerSearch, setTxCustomerSearch] = useState('');
  const txQuantityRef = useRef<HTMLInputElement>(null);
  const [txQuantity, setTxQuantity] = useState<number | ''>('');
  const [txCustomPrice, setTxCustomPrice] = useState<number | ''>('');
  
  const savedPaymentMethods = appData?.settings?.lpgPaymentMethods || [];
  const savedProducts = appData?.settings?.lpgProducts || [];

  const [txProductType, setTxProductType] = useState('');
  const [txPaymentStatus, setTxPaymentStatus] = useState('');
  const [newProductInput, setNewProductInput] = useState('');
  const [newPaymentInput, setNewPaymentInput] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Tambah opsi master LPG (produk / pembayaran) langsung dari form transaksi
  const addLpgMasterOption = (
    key: 'lpgProducts' | 'lpgPaymentMethods',
    raw: string,
    select: (v: string) => void
  ) => {
    const value = raw.trim();
    if (!value) return;
    const list = (appData?.settings?.[key] || []) as string[];
    const existing = list.find((x) => x.toLowerCase() === value.toLowerCase());
    if (existing) {
      select(existing);
      return;
    }
    onUpdateSettings?.({ [key]: [...list, value] });
    select(value);
  };

  // Hapus opsi master LPG (tidak menyentuh transaksi lama)
  const deleteLpgMasterOption = (
    key: 'lpgProducts' | 'lpgPaymentMethods',
    value: string,
    currentSelected: string,
    select: (v: string) => void
  ) => {
    if (!value) return;
    if (!window.confirm(`Hapus opsi "${value}"? Transaksi lama tetap menyimpan data ini.`)) return;
    const list = (appData?.settings?.[key] || []) as string[];
    onUpdateSettings?.({ [key]: list.filter((x) => x !== value) });
    if (currentSelected === value) select('');
  };
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState('');

  // Form Fields for Customer
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPrice, setCustPrice] = useState<number | ''>(18000);
  const [custStatus, setCustStatus] = useState<'active' | 'inactive'>('active');
  const [custNotes, setCustNotes] = useState('');
  const [custError, setCustError] = useState('');

  // Form Fields for LPG Expense
  const [expDate, setExpDate] = useState(getTodayDateString());
  const [expCategory, setExpCategory] = useState('Bongkar/Muat Gas');
  const [expDescription, setExpDescription] = useState('');
  const [expQty, setExpQty] = useState<number | ''>(1);
  const [expUnitPrice, setExpUnitPrice] = useState<number | ''>('');
  const [expNotes, setExpNotes] = useState('');
  const [expError, setExpError] = useState('');
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Analytics Filter & Sort States
  const [custTimeFilterMode, setCustTimeFilterMode] = useState<'period' | 'all' | 'today' | 'this-month' | 'this-year' | 'custom'>('period');
  const [custCustomStart, setCustCustomStart] = useState(dateRange.startDate || getTodayDateString());
  const [custCustomEnd, setCustCustomEnd] = useState(dateRange.endDate || getTodayDateString());
  const [custSortBy, setCustSortBy] = useState<'date-desc' | 'date-asc' | 'qty-desc' | 'qty-asc' | 'total-desc' | 'total-asc'>('date-desc');

  const [exportNotif, setExportNotif] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const notifTimeoutRef = useRef<number | null>(null);

  const showExportNotif = useCallback((type: 'success' | 'error', message: string) => {
    setExportNotif({ type, message });
    if (notifTimeoutRef.current) {
      window.clearTimeout(notifTimeoutRef.current);
    }
    notifTimeoutRef.current = window.setTimeout(() => {
      setExportNotif(null);
    }, 7000);
  }, []);

  // Sorting States
  const [txSort, setTxSort] = useState<{ field: 'date' | 'customer' | 'quantity' | 'total', direction: 'asc' | 'desc' }>({ field: 'date', direction: 'desc' });
  const [custSort, setCustSort] = useState<{ field: 'name' | 'txCount' | 'totalPurchase', direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
  const [lpgExpSort, setLpgExpSort] = useState<{ field: 'date' | 'category' | 'total', direction: 'asc' | 'desc' }>({ field: 'date', direction: 'desc' });

  // Pagination States
  const [txPage, setTxPage] = useState(1);
  const [custPage, setCustPage] = useState(1);
  const [lpgExpPage, setLpgExpPage] = useState(1);
  const [custTxPage, setCustTxPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Reset pagination on search or date changes
  useEffect(() => {
    setTxPage(1);
    setCustPage(1);
    setLpgExpPage(1);
  }, [searchQuery, dateFilter, dateRange]);

  useEffect(() => {
    setCustTxPage(1);
  }, [custTimeFilterMode, custCustomStart, custCustomEnd, custSortBy]);





  // Submit LPG Transaction
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');

    if (!txCustomerId) {
      setTxError('Pelanggan wajib dipilih.');
      return;
    }
    const customer = appData.customers.find((c) => c.id === txCustomerId);
    if (!customer) {
      setTxError('Pelanggan tidak valid.');
      return;
    }
    if (!txQuantity || Number(txQuantity) <= 0) {
      setTxError('Jumlah tabung wajib diisi.');
      return;
    }
    const price = typeof txCustomPrice === 'number' ? txCustomPrice : customer.pricePerUnit;
    if (!price || price <= 0) {
      setTxError('Harga pelanggan belum ditentukan.');
      return;
    }

    const qty = Number(txQuantity);
    const total = qty * price;
    // Hanya pakai nilai yang masih ada di master user
    const effectiveProduct = savedProducts.includes(txProductType) ? txProductType : '';
    const effectivePayment = savedPaymentMethods.includes(txPaymentStatus) ? txPaymentStatus : '';

    let finalNotes = txNotes.trim();
    const tagParts = [effectiveProduct, effectivePayment].filter(Boolean);
    if (tagParts.length > 0 && !tagParts.some((p) => finalNotes.includes(p))) {
      const tag = `[${tagParts.join(' | ')}]`;
      finalNotes = finalNotes ? `${tag} ${finalNotes}` : tag;
    }

    onAddTransaction({
      date: txDate,
      customerId: customer.id,
      customerName: customer.name,
      quantity: qty,
      pricePerUnit: price,
      total,
      productType: effectiveProduct || undefined,
      paymentStatus: effectivePayment || undefined,
      notes: finalNotes,
    });

    // Reset Form
    setShowTxModal(false);
    setTxCustomerId('');
    setTxCustomerSearch('');
    setTxQuantity('');
    setTxCustomPrice('');
    setTxProductType('');
    setTxPaymentStatus('');
    setShowAddProduct(false);
    setShowAddPayment(false);
    setNewProductInput('');
    setNewPaymentInput('');
    setTxNotes('');
  };

  // Submit Customer Form
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setCustError('');

    if (!custName.trim()) {
      setCustError('Nama pelanggan wajib diisi.');
      return;
    }
    if (typeof custPrice !== 'number' || custPrice <= 0) {
      setCustError('Harga khusus per tabung wajib ditentukan.');
      return;
    }

    if (editingCustomerId) {
      onUpdateCustomer(editingCustomerId, {
        name: custName.trim(),
        phone: custPhone.trim(),
        address: custAddress.trim(),
        pricePerUnit: custPrice,
        status: custStatus,
        notes: custNotes.trim(),
      });
    } else {
      onAddCustomer({
        name: custName.trim(),
        phone: custPhone.trim(),
        address: custAddress.trim(),
        pricePerUnit: custPrice,
        status: custStatus,
        notes: custNotes.trim(),
      });
    }

    setShowCustModal(false);
    setEditingCustomerId(null);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustPrice(18000);
    setCustNotes('');
  };

  const openEditCustomer = (cust: Customer) => {
    setEditingCustomerId(cust.id);
    setCustName(cust.name);
    setCustPhone(cust.phone);
    setCustAddress(cust.address);
    setCustPrice(cust.pricePerUnit);
    setCustStatus(cust.status);
    setCustNotes(cust.notes);
    setShowCustModal(true);
  };

  // Submit LPG Expense
  const handleSaveLpgExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpError('');

    if (!expDescription.trim()) {
      setExpError('Deskripsi pengeluaran wajib diisi.');
      return;
    }
    if (!expUnitPrice || Number(expUnitPrice) <= 0) {
      setExpError('Harga satuan/nominal biaya wajib diisi.');
      return;
    }

    const qty = Number(expQty) || 1;
    const unitPrice = Number(expUnitPrice);
    const total = qty * unitPrice;

    onAddExpense({
      date: expDate,
      sector: 'lpg',
      category: expCategory,
      description: expDescription.trim(),
      quantity: qty,
      unitPrice,
      total,
      allocationType: 'general',
      notes: expNotes.trim(),
    });

    setShowLpgExpModal(false);
    setExpDescription('');
    setExpQty(1);
    setExpUnitPrice('');
    setExpNotes('');
  };

  // Filtered LPG Transactions by date range and search query
  const baseFilteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return appData.lpgTransactions.filter((tx) => {
      if (!isDateInFilter(tx.date)) return false;
      if (!q) return true;
      return (
        (tx.customerName || '').toLowerCase().includes(q) ||
        tx.date.includes(q) ||
        (tx.notes || '').toLowerCase().includes(q)
      );
    });
  }, [appData.lpgTransactions, isDateInFilter, searchQuery]);

  const filteredTransactions = useMemo(() => {
    return [...baseFilteredTransactions].sort((a, b) => {
      let comparison = 0;
      if (txSort.field === 'date') comparison = a.date.localeCompare(b.date);
      else if (txSort.field === 'customer') comparison = (a.customerName || '').localeCompare(b.customerName || '');
      else if (txSort.field === 'quantity') comparison = a.quantity - b.quantity;
      else if (txSort.field === 'total') comparison = a.total - b.total;
      
      return txSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [baseFilteredTransactions, txSort]);

  // Filtered Customers
  const baseFilteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return appData.customers.filter((c) => {
      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
    });
  }, [appData.customers, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const arr = [...baseFilteredCustomers];
    if (custSort.field === 'name') {
      return arr.sort((a, b) => custSort.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    }

    const metricsMap = new Map<string, { txCount: number, total: number }>();
    (appData.lpgTransactions || []).forEach(t => {
      const cur = metricsMap.get(t.customerId) || { txCount: 0, total: 0 };
      metricsMap.set(t.customerId, { txCount: cur.txCount + 1, total: cur.total + t.total });
    });

    return arr.sort((a, b) => {
      const mA = metricsMap.get(a.id) || { txCount: 0, total: 0 };
      const mB = metricsMap.get(b.id) || { txCount: 0, total: 0 };
      let comparison = 0;
      if (custSort.field === 'txCount') comparison = mA.txCount - mB.txCount;
      else if (custSort.field === 'totalPurchase') comparison = mA.total - mB.total;
      
      return custSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [baseFilteredCustomers, custSort, appData.lpgTransactions]);

  // Filtered LPG Expenses by sector 'lpg' and date range
  const baseLpgExpenses = useMemo(() => {
    return appData.expenses.filter((e) => e.sector === 'lpg' && isDateInFilter(e.date));
  }, [appData.expenses, isDateInFilter]);

  const lpgExpenses = useMemo(() => {
    return [...baseLpgExpenses].sort((a, b) => {
      let comparison = 0;
      if (lpgExpSort.field === 'date') comparison = a.date.localeCompare(b.date);
      else if (lpgExpSort.field === 'category') comparison = a.category.localeCompare(b.category);
      else if (lpgExpSort.field === 'total') comparison = a.total - b.total;
      
      return lpgExpSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [baseLpgExpenses, lpgExpSort]);

  const totalFilteredSales = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.total, 0), [filteredTransactions]);
  const totalFilteredCylinders = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.quantity, 0), [filteredTransactions]);
  const totalFilteredLpgExpenses = useMemo(() => lpgExpenses.reduce((sum, e) => sum + e.total, 0), [lpgExpenses]);

  // Customer Analytics selected customer details
  const activeDetailCust = appData.customers.find((c) => c.id === selectedCustomerIdForDetail) || appData.customers[0];
  const allCustTxList = useMemo(() => {
    return activeDetailCust
      ? appData.lpgTransactions.filter((t) => t.customerId === activeDetailCust.id)
      : [];
  }, [activeDetailCust, appData.lpgTransactions]);

  // Filter customer transactions by chosen time mode
  const custTxList = useMemo(() => {
    return allCustTxList.filter((tx) => {
      if (custTimeFilterMode === 'all') return true;
      if (custTimeFilterMode === 'period') return isDateInFilter(tx.date);
      if (custTimeFilterMode === 'today') return tx.date === getTodayDateString();
      if (custTimeFilterMode === 'this-month') return tx.date.startsWith(getCurrentMonthString());
      if (custTimeFilterMode === 'this-year') return tx.date.startsWith(new Date().getFullYear().toString());
      if (custTimeFilterMode === 'custom') {
        if (custCustomStart && tx.date < custCustomStart) return false;
        if (custCustomEnd && tx.date > custCustomEnd) return false;
        return true;
      }
      return true;
    });
  }, [allCustTxList, custTimeFilterMode, isDateInFilter, custCustomStart, custCustomEnd]);

  // Sort customer transactions
  const sortedCustTxList = useMemo(() => {
    return [...custTxList].sort((a, b) => {
      if (custSortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (custSortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (custSortBy === 'qty-desc') {
        return b.quantity - a.quantity;
      }
      if (custSortBy === 'qty-asc') {
        return a.quantity - b.quantity;
      }
      if (custSortBy === 'total-desc') {
        return b.total - a.total;
      }
      if (custSortBy === 'total-asc') {
        return a.total - b.total;
      }
      return 0;
    });
  }, [custTxList, custSortBy]);

  const custTotalCylinders = useMemo(() => custTxList.reduce((sum, t) => sum + t.quantity, 0), [custTxList]);
  const custTotalSpending = useMemo(() => custTxList.reduce((sum, t) => sum + t.total, 0), [custTxList]);
  const custAvgSpending = useMemo(() => custTxList.length > 0 ? custTotalSpending / custTxList.length : 0, [custTxList, custTotalSpending]);
  const custMaxTx = useMemo(() => custTxList.reduce((max, t) => (t.total > max ? t.total : max), 0), [custTxList]);

  // Pagination Slicing
  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const safeTxPage = Math.min(txPage, totalTxPages);
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice((safeTxPage - 1) * ITEMS_PER_PAGE, safeTxPage * ITEMS_PER_PAGE);
  }, [filteredTransactions, safeTxPage]);

  const totalCustPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const safeCustPage = Math.min(custPage, totalCustPages);
  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice((safeCustPage - 1) * ITEMS_PER_PAGE, safeCustPage * ITEMS_PER_PAGE);
  }, [filteredCustomers, safeCustPage]);

  const totalLpgExpPages = Math.max(1, Math.ceil(lpgExpenses.length / ITEMS_PER_PAGE));
  const safeLpgExpPage = Math.min(lpgExpPage, totalLpgExpPages);
  const paginatedLpgExpenses = useMemo(() => {
    return lpgExpenses.slice((safeLpgExpPage - 1) * ITEMS_PER_PAGE, safeLpgExpPage * ITEMS_PER_PAGE);
  }, [lpgExpenses, safeLpgExpPage]);

  const totalCustTxPages = Math.max(1, Math.ceil(sortedCustTxList.length / ITEMS_PER_PAGE));
  const safeCustTxPage = Math.min(custTxPage, totalCustTxPages);
  const paginatedCustTxList = useMemo(() => {
    return sortedCustTxList.slice((safeCustTxPage - 1) * ITEMS_PER_PAGE, safeCustTxPage * ITEMS_PER_PAGE);
  }, [sortedCustTxList, safeCustTxPage]);

  const customerAgg = useMemo(() => {
    const agg = new Map<string, { txCount: number; total: number }>();
    appData.customers.forEach(c => agg.set(c.id, { txCount: 0, total: 0 }));
    appData.lpgTransactions.forEach(t => {
      const c = agg.get(t.customerId);
      if (c) {
        c.txCount++;
        c.total += t.total;
      }
    });
    return agg;
  }, [appData.customers, appData.lpgTransactions]);

  const custPeriodLabel = 
    custTimeFilterMode === 'period' ? periodLabel :
    custTimeFilterMode === 'all' ? 'Semua Riwayat (Sepanjang Waktu)' :
    custTimeFilterMode === 'today' ? 'Hari Ini' :
    custTimeFilterMode === 'this-month' ? 'Bulan Ini' :
    custTimeFilterMode === 'this-year' ? `Tahun ${new Date().getFullYear()}` :
    `Kustom (${formatDate(custCustomStart, 'short')} s/d ${formatDate(custCustomEnd, 'short')})`;

  const handleExportCustHistory = async () => {
    if (!activeDetailCust) return;
    try {
      const res = await excelExportService.exportCustomerTransactions(
        appData,
        activeDetailCust,
        sortedCustTxList,
        custPeriodLabel
      );
      if (res.mode === 'filesystem') {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil otomatis disimpan ke folder: "${res.folderName}"!`);
      } else {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil diunduh ke komputer Anda!`);
      }
    } catch (error: any) {
      showExportNotif('error', `Gagal mengekspor file Excel: ${error?.message || error}`);
    }
  };

  const renderSortableHeader = (label: string, field: string, sortState: any, setSortState: any, isRightAlign = false) => (
    <th 
      style={{ cursor: 'pointer', userSelect: 'none', textAlign: isRightAlign ? 'right' : 'left' }}
      onClick={() => setSortState({ field, direction: sortState.field === field && sortState.direction === 'desc' ? 'asc' : 'desc' })}
      title={`Urutkan berdasarkan ${label}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRightAlign ? 'flex-end' : 'flex-start', gap: '4px' }}>
        {label}
        {sortState.field === field && (
          <ArrowUpDown size={14} style={{ transform: sortState.direction === 'asc' ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />
        )}
      </div>
    </th>
  );

  // Field pilihan master LPG (produk / pembayaran) yang sepenuhnya dari data user
  const renderLpgMasterField = (
    label: string,
    key: 'lpgProducts' | 'lpgPaymentMethods',
    list: string[],
    value: string,
    setValue: (v: string) => void,
    showAdd: boolean,
    setShowAdd: (v: boolean) => void,
    inputValue: string,
    setInputValue: (v: string) => void,
    placeholder: string
  ) => {
    const selected = list.includes(value) ? value : '';
    const submitNew = () => {
      addLpgMasterOption(key, inputValue, setValue);
      setInputValue('');
      setShowAdd(false);
    };
    return (
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>{label}</label>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={12} /> Tambah
          </button>
        </div>

        {list.length === 0 ? (
          <div className="input-hint" style={{ padding: '8px 10px', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
            Belum ada data. Tambahkan melalui tombol + Tambah
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={selected}
              onChange={(e) => setValue(e.target.value)}
              className="form-select"
            >
              <option value="">-- Pilih --</option>
              {list.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--color-danger)' }}
              disabled={!selected}
              title="Hapus opsi terpilih"
              onClick={() => deleteLpgMasterOption(key, selected, value, setValue)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {showAdd && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <input
              type="text"
              className="form-input"
              placeholder={placeholder}
              value={inputValue}
              autoFocus
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitNew();
                }
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={submitNew} disabled={!inputValue.trim()}>
              Simpan
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowAdd(false); setInputValue(''); }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub Tabs Navigation */}
      <div className="tabs-nav">
        <button
          onClick={() => onSubTabChange('lpg-sales')}
          className={`tab-btn ${activeSubTab === 'lpg-sales' ? 'active' : ''}`}
        >
          <Flame size={16} />
          <span>Penjualan LPG</span>
          <span className="badge badge-primary">{filteredTransactions.length}</span>
        </button>

        <button
          onClick={() => onSubTabChange('lpg-customers')}
          className={`tab-btn ${activeSubTab === 'lpg-customers' ? 'active' : ''}`}
        >
          <ContactRound size={16} />
          <span>Master Pelanggan</span>
          <span className="badge badge-primary">{appData.customers.length}</span>
        </button>

        <button
          onClick={() => onSubTabChange('lpg-expenses')}
          className={`tab-btn ${activeSubTab === 'lpg-expenses' ? 'active' : ''}`}
        >
          <Wallet size={16} />
          <span>Biaya Operasional LPG</span>
          <span className="badge badge-lpg">{lpgExpenses.length}</span>
        </button>

        <button
          onClick={() => onSubTabChange('lpg-analytics')}
          className={`tab-btn ${activeSubTab === 'lpg-analytics' ? 'active' : ''}`}
        >
          <ChartNoAxesColumnIncreasing size={16} />
          <span>Analitik Pelanggan</span>
        </button>
      </div>

      {/* Date Range Selection Bar */}
      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        periodLabel={periodLabel}
        labelPrefix="Filter Waktu Divisi LPG"
      />

      {/* Quick Summary Strip for LPG Active Period */}
      {activeSubTab === 'lpg-sales' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div className="stat-card" style={{ '--card-accent': 'var(--color-lpg)', padding: '12px 16px' } as React.CSSProperties}>
            <div className="stat-top" style={{ marginBottom: '4px' }}>
              <span className="stat-label">Penjualan LPG ({periodLabel})</span>
              <Flame size={15} style={{ color: 'var(--color-lpg)' }} />
            </div>
            <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--color-lpg)' }}>{formatRupiah(totalFilteredSales)}</div>
            <div className="stat-footer">{filteredTransactions.length} Transaksi • {formatNumber(totalFilteredCylinders)} Tabung</div>
          </div>

          <div className="stat-card" style={{ '--card-accent': 'var(--color-danger)', padding: '12px 16px' } as React.CSSProperties}>
            <div className="stat-top" style={{ marginBottom: '4px' }}>
              <span className="stat-label">Biaya Pangkalan ({periodLabel})</span>
              <Wallet size={15} style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--color-danger)' }}>{formatRupiah(totalFilteredLpgExpenses)}</div>
            <div className="stat-footer">{lpgExpenses.length} Pengeluaran Tercatat</div>
          </div>

          <div className="stat-card" style={{ '--card-accent': totalFilteredSales >= totalFilteredLpgExpenses ? 'var(--color-success)' : 'var(--color-danger)', padding: '12px 16px' } as React.CSSProperties}>
            <div className="stat-top" style={{ marginBottom: '4px' }}>
              <span className="stat-label">Laba Bersih LPG ({periodLabel})</span>
              <ChartNoAxesColumnIncreasing size={15} style={{ color: totalFilteredSales >= totalFilteredLpgExpenses ? 'var(--color-success)' : 'var(--color-danger)' }} />
            </div>
            <div className="stat-value" style={{ fontSize: '1.25rem', color: totalFilteredSales >= totalFilteredLpgExpenses ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {formatRupiah(totalFilteredSales - totalFilteredLpgExpenses)}
            </div>
            <div className="stat-footer">Hasil Usaha Pangkalan Gas</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAB: PENJUALAN LPG                                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'lpg-sales' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title">
                <Flame size={20} style={{ color: 'var(--color-lpg)' }} />
                Riwayat Transaksi Penjualan LPG 3 Kg
              </h3>
              <p className="card-subtitle">
                Menampilkan transaksi periode: <strong style={{ color: 'var(--text-main)' }}>{periodLabel}</strong> ({filteredTransactions.length} transaksi)
              </p>
            </div>
            <div className="card-header__actions">
              <div className="card-header__search" style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder="Cari transaksi / pelanggan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
              <button
                onClick={() => {
                  setTxError('');
                  setShowTxModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Transaksi Baru</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  {renderSortableHeader('Tanggal', 'date', txSort, setTxSort)}
                  {renderSortableHeader('Pelanggan', 'customer', txSort, setTxSort)}
                  {renderSortableHeader('Jumlah Tabung', 'quantity', txSort, setTxSort)}
                  <th>Harga Satuan (Snapshot)</th>
                  {renderSortableHeader('Total Transaksi', 'total', txSort, setTxSort)}
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      Tidak ada transaksi penjualan LPG yang cocok
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safeTxPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td>{formatDate(tx.date, 'short')}</td>
                      <td style={{ fontWeight: '600' }}>{tx.customerName}</td>
                      <td>
                        <span className="badge badge-lpg">{tx.quantity} Tabung</span>
                      </td>
                      <td className="font-mono">{formatRupiah(tx.pricePerUnit)}</td>
                      <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-lpg-text)' }}>
                        {formatRupiah(tx.total)}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.notes || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus transaksi penjualan ${tx.customerName} (${formatRupiah(tx.total)})?`)) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          title="Hapus Transaksi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {filteredTransactions.length > 0 && (
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: '600', borderTop: '2px solid var(--border-medium)' }}>
                    <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.85rem' }}>TOTAL PENJUALAN ({periodLabel}):</td>
                    <td><span className="badge badge-lpg">{formatNumber(totalFilteredCylinders)} Tabung</span></td>
                    <td></td>
                    <td className="font-mono" style={{ color: 'var(--color-lpg-text)', fontSize: '0.95rem' }}>{formatRupiah(totalFilteredSales)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls Transactions */}
          {filteredTransactions.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', fontSize: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Menampilkan {(safeTxPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeTxPage * ITEMS_PER_PAGE, filteredTransactions.length)} dari {filteredTransactions.length} transaksi
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={safeTxPage <= 1}>Sebelumnya</button>
                <span style={{ fontWeight: '600' }}>{safeTxPage} / {totalTxPages}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))} disabled={safeTxPage >= totalTxPages}>Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: MASTER DATA PELANGGAN                                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'lpg-customers' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title">
                <ContactRound size={20} style={{ color: 'var(--color-lpg)' }} />
                Daftar Pelanggan & Pengaturan Harga Khusus
              </h3>
              <p className="card-subtitle">
                Atur harga jual LPG per tabung untuk masing-masing pelanggan (CA, CB, CC, dst.)
              </p>
            </div>
            <div className="card-header__actions">
              <input
                type="text"
                placeholder="Cari pelanggan / telepon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
              <button
                onClick={() => {
                  setEditingCustomerId(null);
                  setCustName('');
                  setCustPhone('');
                  setCustAddress('');
                  setCustPrice(18000);
                  setCustStatus('active');
                  setCustNotes('');
                  setCustError('');
                  setShowCustModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Tambah Pelanggan</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  {renderSortableHeader('Nama Pelanggan', 'name', custSort, setCustSort)}
                  <th>No. Telepon</th>
                  <th>Alamat Pangkalan / Toko</th>
                  <th>Harga Khusus / Tabung</th>
                  {renderSortableHeader('Total Tx', 'txCount', custSort, setCustSort)}
                  {renderSortableHeader('Total Pembelian', 'totalPurchase', custSort, setCustSort)}
                  {renderSortableHeader('Status', 'status', custSort, setCustSort)}
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      Tidak ada pelanggan ditemukan
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((cust, idx) => {
                    const agg = customerAgg.get(cust.id) || { txCount: 0, total: 0 };
                    return (
                      <tr key={cust.id}>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safeCustPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td style={{ fontWeight: '600' }}>{cust.name}</td>
                        <td style={{ fontSize: '0.85rem' }}>{cust.phone || '-'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{cust.address || '-'}</td>
                        <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-lpg-text)' }}>
                          {formatRupiah(cust.pricePerUnit)}
                        </td>
                        <td>{agg.txCount}</td>
                        <td className="font-mono" style={{ color: 'var(--color-primary)' }}>
                          {formatRupiah(agg.total)}
                        </td>
                        <td>
                          <span className={`badge ${cust.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                            {cust.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cust.notes || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditCustomer(cust)}
                            className="btn btn-outline btn-sm"
                            title="Edit Pelanggan & Harga"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomerIdForDetail(cust.id);
                              onSubTabChange('lpg-analytics');
                            }}
                            className="btn btn-secondary btn-sm"
                            title="Lihat Analitik Pembelian"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus pelanggan ${cust.name}? Transaksi historis tetap terjaga.`)) {
                                onDeleteCustomer(cust.id);
                              }
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--color-danger)' }}
                            title="Hapus Pelanggan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls Customers */}
          {filteredCustomers.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', fontSize: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Menampilkan {(safeCustPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeCustPage * ITEMS_PER_PAGE, filteredCustomers.length)} dari {filteredCustomers.length} pelanggan
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setCustPage(p => Math.max(1, p - 1))} disabled={safeCustPage <= 1}>Sebelumnya</button>
                <span style={{ fontWeight: '600' }}>{safeCustPage} / {totalCustPages}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setCustPage(p => Math.min(totalCustPages, p + 1))} disabled={safeCustPage >= totalCustPages}>Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB: BIAYA OPERASIONAL SEKTOR LPG                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'lpg-expenses' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title">
                <Wallet size={20} style={{ color: 'var(--color-lpg)' }} />
                Biaya Operasional Khusus Sektor Gas LPG 3 Kg
              </h3>
              <p className="card-subtitle">
                Listrik gudang, air, bongkar muat gas, gaji staf pangkalan, sewa tempat, dll.
              </p>
            </div>
            <div className="card-header__actions">
              <button
                onClick={() => {
                  setExpError('');
                  setShowLpgExpModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Catat Biaya LPG</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  {renderSortableHeader('Tanggal', 'date', lpgExpSort, setLpgExpSort)}
                  {renderSortableHeader('Kategori Biaya', 'category', lpgExpSort, setLpgExpSort)}
                  <th>Deskripsi Pengeluaran</th>
                  <th>Kuantitas</th>
                  <th>Harga Satuan</th>
                  {renderSortableHeader('Total Biaya', 'total', lpgExpSort, setLpgExpSort)}
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLpgExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      Belum ada biaya operasional LPG yang dicatat
                    </td>
                  </tr>
                ) : (
                  paginatedLpgExpenses.map((exp, idx) => (
                    <tr key={exp.id}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safeLpgExpPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td>{formatDate(exp.date, 'short')}</td>
                      <td>
                        <span className="badge badge-lpg">{exp.category}</span>
                      </td>
                      <td style={{ fontWeight: '600' }}>{exp.description}</td>
                      <td>{exp.quantity}</td>
                      <td className="font-mono">{formatRupiah(exp.unitPrice)}</td>
                      <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
                        {formatRupiah(exp.total)}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exp.notes || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus pengeluaran ${exp.description}?`)) {
                              onDeleteExpense(exp.id);
                            }
                          }}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {lpgExpenses.length > 0 && (
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: '600', borderTop: '2px solid var(--border-medium)' }}>
                    <td colSpan={5} style={{ textAlign: 'right', fontSize: '0.85rem' }}>TOTAL BIAYA LPG ({periodLabel}):</td>
                    <td className="font-mono" style={{ color: 'var(--color-danger)', fontSize: '0.95rem' }}>{formatRupiah(totalFilteredLpgExpenses)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls LPG Expenses */}
          {lpgExpenses.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', fontSize: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Menampilkan {(safeLpgExpPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeLpgExpPage * ITEMS_PER_PAGE, lpgExpenses.length)} dari {lpgExpenses.length} pengeluaran
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setLpgExpPage(p => Math.max(1, p - 1))} disabled={safeLpgExpPage <= 1}>Sebelumnya</button>
                <span style={{ fontWeight: '600' }}>{safeLpgExpPage} / {totalLpgExpPages}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setLpgExpPage(p => Math.min(totalLpgExpPages, p + 1))} disabled={safeLpgExpPage >= totalLpgExpPages}>Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: ANALITIK PELANGGAN (FILTER WAKTU & SORTING RIWAYAT)              */}
      {/* ========================================================================= */}
      {activeSubTab === 'lpg-analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Control Card: Customer Selection, Time Filter & Sorting */}
          <div
            className="card"
            style={{
              borderLeft: '4px solid var(--color-lpg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-lpg">ANALITIK PROFIL PELANGGAN</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Rentang Waktu: <strong style={{ color: 'var(--text-main)' }}>{custPeriodLabel}</strong>
                  </span>
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '600', color: 'var(--color-lpg-text)', marginTop: '4px' }}>
                  {activeDetailCust ? activeDetailCust.name : 'Pilih Pelanggan'}
                  {activeDetailCust?.phone ? <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '8px' }}>({activeDetailCust.phone})</span> : null}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleExportCustHistory}
                  className="btn btn-success"
                  title="Export riwayat transaksi pelanggan ini ke Excel (.xlsx)"
                  disabled={!activeDetailCust || sortedCustTxList.length === 0}
                >
                  <FileChartColumn size={16} />
                  <span>Export Excel Transaksi</span>
                </button>
              </div>
            </div>

            {/* Filter & Sorting Controls Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {/* 1. Customer Selector */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ContactRound size={13} style={{ color: 'var(--color-lpg)' }} />
                  PILIH PELANGGAN:
                </label>
                <select
                  value={activeDetailCust?.id || ''}
                  onChange={(e) => setSelectedCustomerIdForDetail(e.target.value)}
                  className="form-select"
                  style={{ fontWeight: '600' }}
                >
                  {appData.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatRupiah(c.pricePerUnit)}/tabung)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Rentang Waktu / Time Range Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} style={{ color: 'var(--color-primary)' }} />
                  FILTER RENTANG WAKTU:
                </label>
                <select
                  value={custTimeFilterMode}
                  onChange={(e) => setCustTimeFilterMode(e.target.value as any)}
                  className="form-select"
                >
                  <option value="period">📅 Sesuai Filter Halaman ({periodLabel})</option>
                  <option value="today">⚡ Hari Ini Saja</option>
                  <option value="this-month">🗓️ Bulan Ini</option>
                  <option value="this-year">📆 Tahun Ini</option>
                  <option value="custom">🔍 Rentang Tanggal Kustom...</option>
                  <option value="all">🌐 Semua Riwayat (Sepanjang Waktu)</option>
                </select>
              </div>

              {/* 3. Sorting Mode */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowUpDown size={13} style={{ color: 'var(--color-success)' }} />
                  URUTKAN TRANSAKSI:
                </label>
                <select
                  value={custSortBy}
                  onChange={(e) => setCustSortBy(e.target.value as any)}
                  className="form-select"
                >
                  <option value="date-desc">🕒 Tanggal: Terbaru → Terlama</option>
                  <option value="date-asc">🕒 Tanggal: Terlama → Terbaru</option>
                  <option value="qty-desc">📦 Tabung: Terbanyak → Tersedikit</option>
                  <option value="qty-asc">📦 Tabung: Tersedikit → Terbanyak</option>
                  <option value="total-desc">💰 Total Nilai: Terbesar → Terkecil</option>
                  <option value="total-asc">💰 Total Nilai: Terkecil → Terbesar</option>
                </select>
              </div>
            </div>

            {/* Custom Date Pickers when 'custom' is active */}
            {custTimeFilterMode === 'custom' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-medium)',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                  Pilih Rentang Tanggal:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mulai:</label>
                  <input
                    type="date"
                    value={custCustomStart}
                    onChange={(e) => setCustCustomStart(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sampai:</label>
                  <input
                    type="date"
                    value={custCustomEnd}
                    onChange={(e) => setCustCustomEnd(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {exportNotif && (
            <div style={{
              backgroundColor: exportNotif.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light, #ffebee)',
              border: `1px solid ${exportNotif.type === 'success' ? 'var(--color-success-border)' : 'var(--color-error, #f44336)'}`,
              color: exportNotif.type === 'success' ? 'var(--color-success-text)' : 'var(--color-error, #d32f2f)',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {exportNotif.type === 'success' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
              <span>{exportNotif.message}</span>
            </div>
          )}

          {activeDetailCust && (
            <>
              {/* Analytics Metric Cards for Selected Time Range */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="stat-card" style={{ '--card-accent': 'var(--color-lpg)' } as any}>
                  <div className="stat-top">
                    <span className="stat-label">Total Tabung Dibeli</span>
                    <Flame size={18} style={{ color: 'var(--color-lpg)' }} />
                  </div>
                  <div className="stat-value">{formatNumber(custTotalCylinders)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Tabung</span></div>
                  <div className="stat-footer">{sortedCustTxList.length} transaksi ({custPeriodLabel})</div>
                </div>

                <div className="stat-card" style={{ '--card-accent': 'var(--color-lpg)' } as any}>
                  <div className="stat-top">
                    <span className="stat-label">Total Nilai Pembelian</span>
                    <ChartNoAxesColumnIncreasing size={18} style={{ color: 'var(--color-lpg)' }} />
                  </div>
                  <div className="stat-value">{formatRupiah(custTotalSpending)}</div>
                  <div className="stat-footer">Rata-rata: {formatRupiah(custAvgSpending)} / transaksi</div>
                </div>

                <div className="stat-card" style={{ '--card-accent': 'var(--color-success)' } as any}>
                  <div className="stat-top">
                    <span className="stat-label">Pembelian Terbesar</span>
                    <CircleCheck size={18} style={{ color: 'var(--color-success)' }} />
                  </div>
                  <div className="stat-value">{formatRupiah(custMaxTx)}</div>
                  <div className="stat-footer">Harga snapshot: {formatRupiah(activeDetailCust.pricePerUnit)}/tabung</div>
                </div>

                <div className="stat-card" style={{ '--card-accent': 'var(--color-fleet)' } as any}>
                  <div className="stat-top">
                    <span className="stat-label">Status & Alamat Pelanggan</span>
                    <ContactRound size={18} style={{ color: 'var(--color-fleet)' }} />
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                    <span className={`badge ${activeDetailCust.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {activeDetailCust.status === 'active' ? 'Pelanggan Aktif' : 'Non-Aktif'}
                    </span>
                  </div>
                  <div className="stat-footer" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeDetailCust.address || 'Tanpa alamat'}
                  </div>
                </div>
              </div>

              {/* Purchase History Table */}
              <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 className="card-title">
                      Histori Transaksi: {activeDetailCust.name} ({sortedCustTxList.length} Transaksi)
                    </h3>
                    <p className="card-subtitle">
                      Rentang Waktu: <strong>{custPeriodLabel}</strong> • Urutan: <strong>{
                        custSortBy === 'date-desc' ? 'Tanggal Terbaru' :
                        custSortBy === 'date-asc' ? 'Tanggal Terlama' :
                        custSortBy === 'qty-desc' ? 'Jumlah Tabung Terbanyak' :
                        custSortBy === 'qty-asc' ? 'Jumlah Tabung Tersedikit' :
                        custSortBy === 'total-desc' ? 'Total Nilai Terbesar' : 'Total Nilai Terkecil'
                      }</strong>
                    </p>
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Tanggal</th>
                        <th>Produk LPG</th>
                        <th>Jumlah Tabung</th>
                        <th>Harga Saat Transaksi</th>
                        <th>Total Nilai</th>
                        <th>Status Pembayaran</th>
                        <th>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCustTxList.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                            Tidak ada transaksi untuk pelanggan {activeDetailCust.name} pada rentang waktu ini
                          </td>
                        </tr>
                      ) : (
                        paginatedCustTxList.map((tx, idx) => (
                          <tr key={tx.id}>
                            <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safeCustTxPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                            <td>{formatDate(tx.date, 'long')}</td>
                            <td>
                              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                                {tx.productType || '-'}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-lpg" style={{ fontWeight: '600' }}>
                                {formatNumber(tx.quantity)} Tabung
                              </span>
                            </td>
                            <td className="font-mono">{formatRupiah(tx.pricePerUnit)}</td>
                            <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-lpg-text)' }}>
                              {formatRupiah(tx.total)}
                            </td>
                            <td>
                              <span className={`badge ${tx.paymentStatus?.includes('Bon') ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.72rem' }}>
                                {tx.paymentStatus || '-'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                      {sortedCustTxList.length > 0 && (
                        <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: '600', borderTop: '2px solid var(--border-medium)' }}>
                          <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                            TOTAL TRANSAKSI ({custPeriodLabel}):
                          </td>
                          <td className="font-mono" style={{ color: 'var(--color-lpg-text)', fontWeight: '700' }}>
                            {formatNumber(custTotalCylinders)} Tabung
                          </td>
                          <td>-</td>
                          <td className="font-mono" style={{ color: 'var(--color-lpg-text)', fontSize: '0.95rem', fontWeight: '700' }}>
                            {formatRupiah(custTotalSpending)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Controls Customer Analytics */}
                {sortedCustTxList.length > ITEMS_PER_PAGE && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', fontSize: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Menampilkan {(safeCustTxPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeCustTxPage * ITEMS_PER_PAGE, sortedCustTxList.length)} dari {sortedCustTxList.length} transaksi
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setCustTxPage(p => Math.max(1, p - 1))} disabled={safeCustTxPage <= 1}>Sebelumnya</button>
                      <span style={{ fontWeight: '600' }}>{safeCustTxPage} / {totalCustTxPages}</span>
                      <button className="btn btn-outline btn-sm" onClick={() => setCustTxPage(p => Math.min(totalCustTxPages, p + 1))} disabled={safeCustTxPage >= totalCustTxPages}>Selanjutnya</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT TRANSAKSI PENJUALAN LPG                                      */}
      {/* ========================================================================= */}
      {showTxModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={20} style={{ color: 'var(--color-lpg)' }} />
                Input Transaksi Penjualan LPG 3 Kg
              </h3>
              <button
                onClick={() => setShowTxModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {txError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CircleAlert size={16} />
                <span>{txError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTransaction}>
              <div className="form-group">
                <label className="form-label">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pilih Pelanggan *</label>
                <datalist id="lpg-customers-list">
                  {appData.customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <input
                  type="text"
                  list="lpg-customers-list"
                  placeholder="Ketik nama pelanggan..."
                  value={txCustomerSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTxCustomerSearch(val);
                    const found = appData.customers.find((c) => c.name === val);
                    if (found) {
                      setTxCustomerId(found.id);
                      setTxCustomPrice(found.pricePerUnit);
                      setTimeout(() => txQuantityRef.current?.focus(), 50);
                    } else {
                      setTxCustomerId('');
                      setTxCustomPrice('');
                    }
                  }}
                  className="form-input"
                  required
                />
                <div className="input-hint">Harga per tabung akan otomatis terisi mengikuti tarif pelanggan ini</div>
              </div>

              <div className="form-row">
                {renderLpgMasterField(
                  'Status & Metode Pembayaran',
                  'lpgPaymentMethods',
                  savedPaymentMethods,
                  txPaymentStatus,
                  setTxPaymentStatus,
                  showAddPayment,
                  setShowAddPayment,
                  newPaymentInput,
                  setNewPaymentInput,
                  'Contoh: Tunai'
                )}
                {renderLpgMasterField(
                  'Jenis Produk LPG',
                  'lpgProducts',
                  savedProducts,
                  txProductType,
                  setTxProductType,
                  showAddProduct,
                  setShowAddProduct,
                  newProductInput,
                  setNewProductInput,
                  'Contoh: LPG 3 Kg'
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jumlah Tabung Dibeli *</label>
                  <input
                    ref={txQuantityRef}
                    type="number"
                    min="1"
                    placeholder="Contoh: 100"
                    value={txQuantity}
                    onChange={(e) => setTxQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Harga per Tabung (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    value={txCustomPrice}
                    onChange={(e) => setTxCustomPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                  <div className="input-hint">Snapshot harga saat transaksi</div>
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Nilai Penjualan:</span>
                <span className="font-mono" style={{ fontSize: '1.4rem', fontWeight: '600', color: 'var(--color-lpg-text)' }}>
                  {formatRupiah((Number(txQuantity) || 0) * (Number(txCustomPrice) || 0))}
                </span>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Catatan Transaksi (Opsional)</label>
                </div>
                <input
                  type="text"
                  placeholder="Contoh: Rit pagi / no nota gudang"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT PELANGGAN                                           */}
      {/* ========================================================================= */}
      {showCustModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ContactRound size={20} style={{ color: 'var(--color-lpg)' }} />
                {editingCustomerId ? 'Edit Data Pelanggan & Harga' : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                onClick={() => setShowCustModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {custError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {custError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer}>
              <div className="form-group">
                <label className="form-label">Nama Pelanggan / Toko / Pangkalan *</label>
                <input
                  type="text"
                  placeholder="Contoh: Pangkalan Berkah Bersama (CA)"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Harga Khusus per Tabung (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 18000"
                    value={custPrice}
                    onChange={(e) => setCustPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                  <div className="input-hint">Menjadi tarif default saat transaksi</div>
                </div>

                <div className="form-group">
                  <label className="form-label">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Contoh: 0812-3456-7890"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Pangkalan</label>
                <input
                  type="text"
                  placeholder="Contoh: Jl. Merdeka No. 12, Pematang Siantar"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status Pelanggan</label>
                  <select
                    value={custStatus}
                    onChange={(e) => setCustStatus(e.target.value as 'active' | 'inactive')}
                    className="form-select"
                  >
                    <option value="active">🟢 Pelanggan Aktif (Rutin Membeli)</option>
                    <option value="inactive">⚪ Non-Aktif / Jarang Membeli</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Kategori / Catatan Tambahan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pengecer Warung / Jalur Timur"
                    value={custNotes}
                    onChange={(e) => setCustNotes(e.target.value)}
                    className="form-input"
                  />

                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCustModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomerId ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT BIAYA OPERASIONAL LPG                                        */}
      {/* ========================================================================= */}
      {showLpgExpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={20} style={{ color: 'var(--color-lpg)' }} />
                Catat Biaya Operasional Sektor LPG
              </h3>
              <button
                onClick={() => setShowLpgExpModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {expError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {expError}
              </div>
            )}

            <form onSubmit={handleSaveLpgExpense}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tanggal Pengeluaran</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group" style={{ display: 'none' }}>
                  {/* Empty spacer for grid alignment */}
                </div>
              </div>

              <ExpenseCategoryInput
                sector="lpg"
                category={expCategory}
                onCategoryChange={setExpCategory}
                description={expDescription}
                onDescriptionChange={setExpDescription}
                options={appData.settings?.lpgExpCategories || []}
                onAddOption={(newOption) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({ lpgExpCategories: [...(appData.settings?.lpgExpCategories || []), newOption] });
                  }
                }}
                onDeleteOption={(option) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({ lpgExpCategories: (appData.settings?.lpgExpCategories || []).filter(c => c !== option) });
                  }
                }}
              />

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kuantitas / Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    value={expQty}
                    onChange={(e) => setExpQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Harga Satuan / Tarif (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 500"
                    value={expUnitPrice}
                    onChange={(e) => setExpUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              {/* Total Preview */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Pengeluaran:</span>
                <span className="font-mono" style={{ fontSize: '1.4rem', fontWeight: '600', color: 'var(--color-danger)' }}>
                  {formatRupiah((Number(expQty) || 1) * (Number(expUnitPrice) || 0))}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowLpgExpModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Biaya LPG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
