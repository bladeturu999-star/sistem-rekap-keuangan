import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Edit,
  CarFront,
  Wrench,
  Fuel,
  FileChartColumn,
  ChartNoAxesColumnIncreasing,
  X,
  Gauge,
  ArrowUpRight,
  Wallet,
  CircleCheck,
  TriangleAlert,
  ArrowUpDown
} from 'lucide-react';
import type { AppData, Vehicle, ExpeditionTrip, Expense, ActiveTab, DateFilterType, DateRange, CompanySettings } from '../types';
import {
  formatRupiah,
  formatNumber,
  formatDate,
  getTodayDateString
} from '../utils/formatters';
import { excelExportService } from '../services/excelExport';
import { ExpenseCategoryInput } from '../components/ExpenseCategoryInput';
import { DateFilterBar } from '../components/DateFilterBar';

interface ExpeditionViewProps {
  appData: AppData;
  activeSubTab: 'expedition-trips' | 'expedition-vehicles' | 'expedition-vehicle-recap' | 'expedition-analytics';
  onSubTabChange: (tab: ActiveTab) => void;
  onAddTrip: (trip: Omit<ExpeditionTrip, 'id' | 'createdAt'>) => void;
  onDeleteTrip: (id: string) => void;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  onUpdateVehicle: (id: string, vehicle: Partial<Vehicle>) => void;
  onDeleteVehicle: (id: string) => void;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateSettings?: (settings: Partial<CompanySettings>) => void;
  isDateInFilter: (dateStr: string) => boolean;
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  periodLabel: string;
}

export const ExpeditionView: React.FC<ExpeditionViewProps> = ({
  appData,
  activeSubTab,
  onSubTabChange,
  onAddTrip,
  onDeleteTrip,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
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
  // Pagination States
  const ITEMS_PER_PAGE = 50;
  const [tripPage, setTripPage] = useState(1);
  const [vehiclePage, setVehiclePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);

  // Modal states
  const [showTripModal, setShowTripModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showVehExpModal, setShowVehExpModal] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [tripSort, setTripSort] = useState<{ field: 'date' | 'vehicle' | 'driver' | 'revenue' | 'allowance', direction: 'asc' | 'desc' }>({ field: 'date', direction: 'desc' });

  // Trip Form States (Formula: (Total Berat x Harga/Kg) - Uang Jalan)
  const [tripDate, setTripDate] = useState(getTodayDateString());
  const [tripVehicleId, setTripVehicleId] = useState('');
  const [tripVehSearch, setTripVehSearch] = useState('');
  const tripDestinationRef = useRef<HTMLInputElement>(null);
  const [tripDriver, setTripDriver] = useState('');

  const [tripDestination, setTripDestination] = useState('');
  const [tripWeightKg, setTripWeightKg] = useState<number | ''>('');
  const [tripRatePerKg, setTripRatePerKg] = useState<number | ''>('');
  const [tripTravelAllowance, setTripTravelAllowance] = useState<number | ''>('');
  const [tripDistanceKm, setTripDistanceKm] = useState<number | ''>('');
  const [tripCargoNotes, setTripCargoNotes] = useState('');
  const [tripError, setTripError] = useState('');

  // Master Data States
  const [newRouteInput, setNewRouteInput] = useState('');
  const [showAddRouteInline, setShowAddRouteInline] = useState(false);

  const [newVehTypeInput, setNewVehTypeInput] = useState('');
  const [showAddVehTypeInline, setShowAddVehTypeInline] = useState(false);

  const [newDriverInput, setNewDriverInput] = useState('');
  const [showAddDriverInline, setShowAddDriverInline] = useState(false);

  // Master Data Methods
  const addExpeditionMasterOption = (
    key: 'expeditionRoutes' | 'expeditionVehTypes' | 'expeditionDrivers',
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
    if (onUpdateSettings) {
      onUpdateSettings({ [key]: [...list, value] });
    }
    select(value);
  };

  const deleteExpeditionMasterOption = (
    key: 'expeditionRoutes' | 'expeditionVehTypes' | 'expeditionDrivers',
    value: string,
    currentSelected: string,
    select: (v: string) => void
  ) => {
    if (!value) return;
    if (!window.confirm(`Hapus opsi "${value}" dari daftar? Data transaksi lama tetap aman.`)) return;
    const list = (appData?.settings?.[key] || []) as string[];
    if (onUpdateSettings) {
      onUpdateSettings({ [key]: list.filter((x) => x !== value) });
    }
    if (currentSelected === value) select('');
  };

  // Field pilihan master Ekspedisi yang sepenuhnya dari data user
  const renderExpeditionMasterField = (
    label: string,
    key: 'expeditionRoutes' | 'expeditionVehTypes' | 'expeditionDrivers',
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
      addExpeditionMasterOption(key, inputValue, setValue);
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
              onClick={() => deleteExpeditionMasterOption(key, selected, value, setValue)}
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
  };  // Vehicle Form States
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehPlate, setVehPlate] = useState('');
  const [vehType, setVehType] = useState('');
  const [vehName, setVehName] = useState('');
  const [vehDriver, setVehDriver] = useState('');
  const [vehRatePerKg, setVehRatePerKg] = useState<number | ''>(350);
  const [vehStatus, setVehStatus] = useState<'active' | 'maintenance' | 'inactive'>('active');
  const [vehNotes, setVehNotes] = useState('');
  const [vehError, setVehError] = useState('');

  // Fleet Operational Expenses per Vehicle States
  const [selectedPlateForRecap, setSelectedPlateForRecap] = useState<string>('all'); // 'all' or plate number
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [expenseSortBy, setExpenseSortBy] = useState<'category-asc' | 'category-desc' | 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('category-asc');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState<string>('');

  useEffect(() => {
    setTripPage(1);
    setVehiclePage(1);
    setExpensePage(1);
  }, [searchQuery, dateRange, dateFilter, selectedPlateForRecap, selectedCategoryFilter, expenseSearchQuery]);


  // Vehicle Expense Modal Form States
  const [vehExpDate, setVehExpDate] = useState(getTodayDateString());
  const [vehExpCategory, setVehExpCategory] = useState('BBM');
  const [vehExpPlate, setVehExpPlate] = useState(appData.vehicles[0]?.plateNumber || '');
  const [vehExpDesc, setVehExpDesc] = useState('');
  const [vehExpAmount, setVehExpAmount] = useState<number | ''>('');
  const [vehExpLiters, setVehExpLiters] = useState<number | ''>('');
  const [vehExpPricePerLiter, setVehExpPricePerLiter] = useState<number | ''>(6800);
  const [vehExpOdometer, setVehExpOdometer] = useState<number | ''>('');
  const [vehExpLocation, setVehExpLocation] = useState('');
  const [vehExpNotes, setVehExpNotes] = useState('');
  const [vehExpError, setVehExpError] = useState('');



  // Submit Trip (Rumus Hasil Perjalanan: Total Berat x Harga/Kg - Uang Jalan)
  const handleSaveTrip = (e: React.FormEvent) => {
    e.preventDefault();
    setTripError('');

    if (!tripVehicleId) {
      setTripError('Armada / Kendaraan wajib dipilih.');
      return;
    }
    const vehicle = appData.vehicles.find((v) => v.id === tripVehicleId);
    if (!vehicle) {
      setTripError('Kendaraan tidak valid.');
      return;
    }
    if (!tripWeightKg || Number(tripWeightKg) <= 0) {
      setTripError('Berat muatan (Kg) wajib diisi dan harus lebih dari 0.');
      return;
    }
    const rate = typeof tripRatePerKg === 'number' ? tripRatePerKg : (vehicle.ratePerKg || 350);
    if (!rate || rate <= 0) {
      setTripError('Biaya / tarif per Kg wajib diisi dan harus lebih dari 0.');
      return;
    }

    const weight = Number(tripWeightKg);
    const allowance = Number(tripTravelAllowance) || 0;
    const totalRev = (weight * rate) - allowance;

    onAddTrip({
      date: tripDate,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      driver: tripDriver.trim() || vehicle.defaultDriver,
      destination: tripDestination.trim() || 'Rute Perjalanan',
      weightKg: weight,
      ratePerKg: rate,
      travelAllowance: allowance,
      distanceKm: Number(tripDistanceKm) || 0,
      tonnage: weight / 1000,
      totalRevenue: totalRev,
      cargoNotes: tripCargoNotes.trim(),
    });

    // Otomatis simpan rute baru ke daftar opsi
    if (tripDestination.trim() && !(appData.settings?.expeditionRoutes || []).includes(tripDestination.trim())) {
      const updated = [tripDestination.trim(), ...(appData.settings?.expeditionRoutes || [])];
      if (onUpdateSettings) {
        onUpdateSettings({ expeditionRoutes: updated });
      }
      try {
        localStorage.setItem('sistem_rekap_custom_routes', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
    }

    setShowTripModal(false);
    setTripVehicleId('');
    setTripVehSearch('');
    setTripDriver('');
    setTripDestination('');
    setTripWeightKg('');
    setTripRatePerKg('');
    setTripTravelAllowance('');
    setTripDistanceKm('');
    setTripCargoNotes('');
  };

  // Submit Vehicle
  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    setVehError('');

    if (!vehPlate.trim()) {
      setVehError('Nomor plat kendaraan wajib diisi.');
      return;
    }
    if (typeof vehRatePerKg !== 'number' || vehRatePerKg <= 0) {
      setVehError('Tarif dasar muatan per Kg wajib diisi.');
      return;
    }

    const finalType = vehType.trim();
    if (!finalType) {
      setVehError('Jenis kendaraan wajib dipilih.');
      return;
    }
    const rateKg = vehRatePerKg;

    if (editingVehicleId) {
      onUpdateVehicle(editingVehicleId, {
        plateNumber: vehPlate.trim().toUpperCase(),
        vehicleType: finalType,
        vehicleName: vehName.trim() || `Armada ${vehPlate.trim().toUpperCase()}`,
        defaultDriver: vehDriver.trim(),
        ratePerKg: rateKg,
        ratePerKm: 12000,
        status: vehStatus,
        notes: vehNotes.trim(),
      });
    } else {
      onAddVehicle({
        plateNumber: vehPlate.trim().toUpperCase(),
        vehicleType: finalType,
        vehicleName: vehName.trim() || `Armada ${vehPlate.trim().toUpperCase()}`,
        defaultDriver: vehDriver.trim(),
        ratePerKg: rateKg,
        ratePerKm: 12000,
        status: vehStatus,
        notes: vehNotes.trim(),
      });
    }

    setShowVehicleModal(false);
    setEditingVehicleId(null);
    setVehPlate('');
    setVehType('');
    setVehName('');
    setVehDriver('');
    setVehRatePerKg(350);
    setVehNotes('');
  };

  const openEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id);
    setVehPlate(v.plateNumber);
    setVehType(v.vehicleType);
    setVehName(v.vehicleName);
    setVehDriver(v.defaultDriver);
    setVehRatePerKg(v.ratePerKg || 350);
    setVehStatus(v.status);
    setVehNotes(v.notes);
    setShowVehicleModal(true);
  };

  // Submit Vehicle Expense from Mobil X view
  const handleSaveVehExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setVehExpError('');

    if (!vehExpPlate) {
      setVehExpError('Plat kendaraan wajib dipilih.');
      return;
    }
    if (vehExpCategory !== 'BBM' && !vehExpDesc.trim()) {
      setVehExpError('Deskripsi pengeluaran wajib diisi.');
      return;
    }

    let total = 0;
    let qty = 1;
    let unitPrice = 0;
    let fuelDetails = undefined;

    if (vehExpCategory === 'BBM') {
      const liters = Number(vehExpLiters) || 0;
      const pricePerL = Number(vehExpPricePerLiter) || 0;
      if (liters <= 0 || pricePerL <= 0) {
        setVehExpError('Liter dan harga per liter BBM wajib diisi.');
        return;
      }
      qty = liters;
      unitPrice = pricePerL;
      total = liters * pricePerL;
      fuelDetails = {
        fuelType: 'Bio Solar',
        liters,
        pricePerLiter: pricePerL,
        odometer: vehExpOdometer ? Number(vehExpOdometer) : undefined,
        location: vehExpLocation.trim() || undefined,
      };
    } else {
      total = Number(vehExpAmount) || 0;
      if (total <= 0) {
        setVehExpError('Nominal biaya wajib diisi.');
        return;
      }
      qty = 1;
      unitPrice = total;
    }

    const finalDesc = vehExpCategory === 'BBM' && !vehExpDesc.trim()
      ? `Pengisian BBM ${vehExpLiters} Liter (${vehExpPlate})`
      : vehExpDesc.trim();

    onAddExpense({
      date: vehExpDate,
      sector: 'expedition',
      category: vehExpCategory,
      description: finalDesc,
      quantity: qty,
      unitPrice,
      total,
      allocationType: 'vehicle',
      targetPlate: vehExpPlate,
      fuelDetails,
      notes: vehExpNotes.trim(),
    });

    setShowVehExpModal(false);
    setVehExpDesc('');
    setVehExpAmount('');
    setVehExpLiters('');
    setVehExpNotes('');
  };

  // Filtered trips by date range & search
  const baseFilteredTrips = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return appData.expeditionTrips.filter((t) => {
      if (!isDateInFilter(t.date)) return false;
      return (
        (t.plateNumber || '').toLowerCase().includes(q) ||
        (t.driver || '').toLowerCase().includes(q) ||
        (t.destination || '').toLowerCase().includes(q) ||
        (t.date || '').includes(q)
      );
    });
  }, [appData.expeditionTrips, isDateInFilter, searchQuery]);

  const filteredTrips = useMemo(() => {
    return [...baseFilteredTrips].sort((a, b) => {
      let comparison = 0;
      if (tripSort.field === 'date') comparison = a.date.localeCompare(b.date);
      else if (tripSort.field === 'vehicle') comparison = a.plateNumber.localeCompare(b.plateNumber);
      else if (tripSort.field === 'driver') comparison = a.driver.localeCompare(b.driver);
      else if (tripSort.field === 'revenue') comparison = a.totalRevenue - b.totalRevenue;
      else if (tripSort.field === 'allowance') comparison = (a.travelAllowance || 0) - (b.travelAllowance || 0);
      
      return tripSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [baseFilteredTrips, tripSort]);

  const { totalFilteredTripsRevenue, totalFilteredTripsWeight, totalFilteredTripsAllowance } = useMemo(() => ({
    totalFilteredTripsRevenue: filteredTrips.reduce((s, t) => s + t.totalRevenue, 0),
    totalFilteredTripsWeight: filteredTrips.reduce((s, t) => s + (t.weightKg || 0), 0),
    totalFilteredTripsAllowance: filteredTrips.reduce((s, t) => s + (t.travelAllowance || 0), 0),
  }), [filteredTrips]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return appData.vehicles.filter((v) => {
      return (
        (v.plateNumber || '').toLowerCase().includes(q) ||
        (v.vehicleName || '').toLowerCase().includes(q) ||
        (v.defaultDriver || '').toLowerCase().includes(q)
      );
    });
  }, [appData.vehicles, searchQuery]);

  const safeTripPage = Math.max(1, Math.min(tripPage, Math.ceil(filteredTrips.length / ITEMS_PER_PAGE) || 1));
  const paginatedTrips = useMemo(() => filteredTrips.slice((safeTripPage - 1) * ITEMS_PER_PAGE, safeTripPage * ITEMS_PER_PAGE), [filteredTrips, safeTripPage]);
  const totalTripPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE) || 1;

  const safeVehPage = Math.max(1, Math.min(vehiclePage, Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE) || 1));
  const paginatedVehicles = useMemo(() => filteredVehicles.slice((safeVehPage - 1) * ITEMS_PER_PAGE, safeVehPage * ITEMS_PER_PAGE), [filteredVehicles, safeVehPage]);
  const totalVehPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE) || 1;

  // =========================================================================
  // REKAP OPERASIONAL & BIAYA ARMADA PER MOBIL (FITUR UTAMA)
  // =========================================================================
  const isAllVehicles = selectedPlateForRecap === 'all';
  const currentRecapVehicle = isAllVehicles
    ? null
    : (appData.vehicles.find((v) => v.plateNumber === selectedPlateForRecap) || appData.vehicles[0]);
  const activePlate = currentRecapVehicle ? currentRecapVehicle.plateNumber : 'all';

  // Base data in active period
  const periodTrips = appData.expeditionTrips.filter((t) => isDateInFilter(t.date));
  const periodFleetExpenses = appData.expenses.filter(
    (e) => e.sector === 'expedition' && isDateInFilter(e.date)
  );

  // Scoped to selected vehicle (or all)
  const { targetVehicleTrips, targetVehicleExpenses, targetRevenue, targetWeightKg, targetDistanceKm, targetTotalCost, targetNetProfit, isTargetProfit } = useMemo(() => {
    const trips = isAllVehicles ? periodTrips : periodTrips.filter((t) => t.plateNumber === activePlate);
    const expenses = isAllVehicles ? periodFleetExpenses : periodFleetExpenses.filter((e) => e.targetPlate === activePlate);

    const revenue = trips.reduce((sum, t) => sum + t.totalRevenue, 0);
    const weight = trips.reduce((sum, t) => sum + (t.weightKg || 0), 0);
    const distance = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
    const cost = expenses.reduce((sum, e) => sum + e.total, 0);
    const profit = revenue - cost;

    return {
      targetVehicleTrips: trips,
      targetVehicleExpenses: expenses,
      targetRevenue: revenue,
      targetWeightKg: weight,
      targetDistanceKm: distance,
      targetTotalCost: cost,
      targetNetProfit: profit,
      isTargetProfit: profit >= 0
    };
  }, [periodTrips, periodFleetExpenses, isAllVehicles, activePlate]);

  const { categoryTotals, presentCategoryList } = useMemo(() => {
    const totals: Record<string, { total: number; count: number; liters: number }> = {};
    targetVehicleExpenses.forEach((e) => {
      const cat = e.category || 'Lain-lain';
      if (!totals[cat]) {
        totals[cat] = { total: 0, count: 0, liters: 0 };
      }
      totals[cat].total += e.total;
      totals[cat].count += 1;
      if (e.fuelDetails?.liters) {
        totals[cat].liters += e.fuelDetails.liters;
      }
    });
    return {
      categoryTotals: totals,
      presentCategoryList: Object.keys(totals)
    };
  }, [targetVehicleExpenses]);

  const baseDisplayedVehicleExpenses = useMemo(() => {
    let list = [...targetVehicleExpenses];
    if (selectedCategoryFilter !== 'all') {
      list = list.filter((e) => e.category === selectedCategoryFilter);
    }
    if (expenseSearchQuery.trim()) {
      const q = expenseSearchQuery.toLowerCase();
      list = list.filter((e) =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q) ||
        (e.targetPlate || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [targetVehicleExpenses, selectedCategoryFilter, expenseSearchQuery]);

  const displayedVehicleExpenses = useMemo(() => {
    const list = [...baseDisplayedVehicleExpenses];
    list.sort((a, b) => {
      if (expenseSortBy === 'category-asc') {
        const cmp = a.category.localeCompare(b.category);
        if (cmp !== 0) return cmp;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (expenseSortBy === 'category-desc') {
        const cmp = b.category.localeCompare(a.category);
        if (cmp !== 0) return cmp;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (expenseSortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (expenseSortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (expenseSortBy === 'amount-desc') {
        return b.total - a.total;
      }
      if (expenseSortBy === 'amount-asc') {
        return a.total - b.total;
      }
      return 0;
    });
    return list;
  }, [baseDisplayedVehicleExpenses, expenseSortBy]);

  const displayedCostTotal = useMemo(() => displayedVehicleExpenses.reduce((sum, e) => sum + e.total, 0), [displayedVehicleExpenses]);

  const safeExpPage = Math.max(1, Math.min(expensePage, Math.ceil(displayedVehicleExpenses.length / ITEMS_PER_PAGE) || 1));
  const paginatedExpenses = useMemo(() => displayedVehicleExpenses.slice((safeExpPage - 1) * ITEMS_PER_PAGE, safeExpPage * ITEMS_PER_PAGE), [displayedVehicleExpenses, safeExpPage]);
  const totalExpPages = Math.ceil(displayedVehicleExpenses.length / ITEMS_PER_PAGE) || 1;

  const vehicleAnalyticsAgg = useMemo(() => {
    const agg = new Map<string, { tripCount: number; totalRevenue: number; distanceKm: number; weightKg: number; expenseCount: number; totalCost: number }>();
    
    appData.vehicles.forEach(v => {
      agg.set(v.plateNumber, { tripCount: 0, totalRevenue: 0, distanceKm: 0, weightKg: 0, expenseCount: 0, totalCost: 0 });
    });

    appData.expeditionTrips.forEach(t => {
      if (isDateInFilter(t.date)) {
        const v = agg.get(t.plateNumber);
        if (v) {
          v.tripCount++;
          v.totalRevenue += (t.totalRevenue || 0);
          v.distanceKm += (t.distanceKm || 0);
          v.weightKg += (t.weightKg || 0);
        }
      }
    });

    appData.expenses.forEach(e => {
      if (e.sector === 'expedition' && isDateInFilter(e.date)) {
        const v = agg.get(e.targetPlate || '');
        if (v) {
          v.expenseCount++;
          v.totalCost += (e.total || 0);
        }
      }
    });

    return agg;
  }, [appData.vehicles, appData.expeditionTrips, appData.expenses, isDateInFilter]);

  // Excel Export Handler for Selected Vehicle / All Vehicles
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
  const handleExportMobilExcel = async () => {
    try {
      const fileNameSuffix = periodLabel.replace(/\s+/g, '_');
      let res;
      if (isAllVehicles) {
        res = await excelExportService.exportExpeditionRecap(appData, periodTrips, periodFleetExpenses, periodLabel, fileNameSuffix);
      } else {
        res = await excelExportService.exportSingleVehicleRecap(appData, activePlate, targetVehicleTrips, targetVehicleExpenses, periodLabel, fileNameSuffix);
      }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub Tabs Navigation */}
      <div className="tabs-nav">
        <button
          onClick={() => onSubTabChange('expedition-trips')}
          className={`tab-btn ${activeSubTab === 'expedition-trips' ? 'active' : ''}`}
        >
          <Truck size={16} />
          <span>Perjalanan Ekspedisi</span>
          <span className="badge badge-fleet">{filteredTrips.length}</span>
        </button>

        <button
          onClick={() => onSubTabChange('expedition-vehicles')}
          className={`tab-btn ${activeSubTab === 'expedition-vehicles' ? 'active' : ''}`}
        >
          <CarFront size={16} />
          <span>Data Armada Mobil</span>
          <span className="badge badge-fleet">{appData.vehicles.length}</span>
        </button>

        <button
          onClick={() => onSubTabChange('expedition-vehicle-recap')}
          className={`tab-btn highlight ${activeSubTab === 'expedition-vehicle-recap' ? 'active' : ''}`}
          style={{ fontWeight: '600' }}
        >
          <Wrench size={16} />
          <span>Pengeluaran Armada per Mobil</span>
          <span className="badge badge-warning">Fitur Utama</span>
        </button>

        <button
          onClick={() => onSubTabChange('expedition-analytics')}
          className={`tab-btn ${activeSubTab === 'expedition-analytics' ? 'active' : ''}`}
        >
          <ChartNoAxesColumnIncreasing size={16} />
          <span>Analitik Armada</span>
        </button>
      </div>

      {/* Date Range Selection Bar */}
      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        periodLabel={periodLabel}
        labelPrefix="Filter Waktu Divisi Ekspedisi"
      />

      {/* ========================================================================= */}
      {/* 1. TAB: PENGELUARAN ARMADA PER MOBIL & SORTING KATEGORI                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'expedition-vehicle-recap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Control Card: Vehicle, Category Filter & Sorting */}
          <div
            className="card"
            style={{
              borderLeft: '4px solid var(--color-fleet)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-fleet">OPERASIONAL TIAP MOBIL</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Periode: <strong style={{ color: 'var(--text-main)' }}>{periodLabel}</strong>
                  </span>
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '600', color: 'var(--text-main)', marginTop: '4px' }}>
                  {isAllVehicles
                    ? 'Seluruh Armada (Gabungan Semua Truk)'
                    : `${currentRecapVehicle?.plateNumber} — ${currentRecapVehicle?.vehicleName} (${currentRecapVehicle?.defaultDriver})`}
                </h2>
              </div>

              <div className="card-header__actions">
                <button
                  onClick={handleExportMobilExcel}
                  className="btn btn-success"
                  title="Export rincian biaya ini ke Excel (.xlsx)"
                >
                  <FileChartColumn size={16} />
                  <span>{isAllVehicles ? 'Export Excel Semua Armada' : `Export Excel ${activePlate}`}</span>
                </button>
                <button
                  onClick={() => {
                    setVehExpPlate(isAllVehicles ? (appData.vehicles[0]?.plateNumber || '') : activePlate);
                    setShowVehExpModal(true);
                  }}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  <span>Catat Biaya Armada</span>
                </button>
              </div>
            </div>

            {/* Filter & Sort Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {/* Select Vehicle */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CarFront size={13} style={{ color: 'var(--color-fleet)' }} />
                  PILIH ARMADA MOBIL:
                </label>
                <select
                  value={selectedPlateForRecap}
                  onChange={(e) => setSelectedPlateForRecap(e.target.value)}
                  className="form-select"
                  style={{ fontWeight: '600' }}
                >
                  <option value="all">🚛 SEMUA MOBIL (Gabungan Armada)</option>
                  {appData.vehicles.map((v) => (
                    <option key={v.id} value={v.plateNumber}>
                      {v.plateNumber} — {v.vehicleName} ({v.defaultDriver})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Category */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Wrench size={13} style={{ color: 'var(--color-warning)' }} />
                  FILTER KATEGORI BIAYA:
                </label>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="all">Semua Kategori Biaya ({targetVehicleExpenses.length} transaksi)</option>
                  {(appData.settings.expeditionVehExpCategories || []).map((c, idx) => (
                      <option key={idx} value={c}>
                        ✨ {c}
                      </option>
                    ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Wallet size={13} style={{ color: 'var(--color-primary)' }} />
                  URUTKAN BIAYA BERDASARKAN:
                </label>
                <select
                  value={expenseSortBy}
                  onChange={(e) => setExpenseSortBy(e.target.value as any)}
                  className="form-select"
                  style={{ fontWeight: '500' }}
                >
                  <option value="category-asc">🏷️ Kategori (A ke Z)</option>
                  <option value="category-desc">🏷️ Kategori (Z ke A)</option>
                  <option value="date-desc">📅 Tanggal (Terbaru ke Terlama)</option>
                  <option value="date-asc">📅 Tanggal (Terlama ke Terbaru)</option>
                  <option value="amount-desc">💰 Nominal (Terbesar ke Terkecil)</option>
                  <option value="amount-asc">💰 Nominal (Terkecil ke Terbesar)</option>
                </select>
              </div>

              {/* Search query */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  CARI DESKRIPSI / NOTA:
                </label>
                <input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={expenseSearchQuery}
                  onChange={(e) => setExpenseSearchQuery(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Metric Cards for Selected Target */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Pendapatan */}
            <div className="stat-card" style={{ '--card-accent': 'var(--color-success)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Pendapatan ({periodLabel})</span>
                <ChartNoAxesColumnIncreasing size={18} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="stat-value">{formatRupiah(targetRevenue)}</div>
              <div className="stat-footer">
                <span>{targetVehicleTrips.length} Rit</span>
                <span>•</span>
                <span>{formatNumber(targetWeightKg)} Kg ({formatNumber(targetWeightKg / 1000)} Ton)</span>
              </div>
            </div>

            {/* Total Biaya */}
            <div className="stat-card" style={{ '--card-accent': 'var(--color-danger)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Total Pengeluaran Armada</span>
                <Wallet size={18} style={{ color: 'var(--color-danger)' }} />
              </div>
              <div className="stat-value">{formatRupiah(targetTotalCost)}</div>
              <div className="stat-footer">{targetVehicleExpenses.length} Total Pengeluaran</div>
            </div>

            {/* Laba Bersih */}
            <div className="stat-card" style={{ '--card-accent': isTargetProfit ? 'var(--color-success)' : 'var(--color-danger)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Laba Bersih Operasional</span>
                <ArrowUpRight size={18} style={{ color: isTargetProfit ? 'var(--color-success)' : 'var(--color-danger)' }} />
              </div>
              <div className="stat-value" style={{ color: isTargetProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatRupiah(targetNetProfit)}
              </div>
              <div className="stat-footer">
                <span className={`badge ${isTargetProfit ? 'badge-success' : 'badge-danger'}`}>
                  {isTargetProfit ? 'Unit Profitabel' : 'Unit Defisit'}
                </span>
              </div>
            </div>

            {/* Jarak Tempuh */}
            <div className="stat-card" style={{ '--card-accent': 'var(--color-fleet)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Jarak Tempuh Total</span>
                <Gauge size={18} style={{ color: 'var(--color-fleet)' }} />
              </div>
              <div className="stat-value">
                {formatNumber(targetDistanceKm)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Km</span>
              </div>
              <div className="stat-footer">
                {isAllVehicles ? `${appData.vehicles.length} Armada Aktif` : `Driver: ${currentRecapVehicle?.defaultDriver || '-'}`}
              </div>
            </div>
          </div>

          {/* Interactive Breakdown per Kategori Cards */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '1rem' }}>
                  <Wrench size={18} style={{ color: 'var(--color-warning)' }} />
                  Rincian Pengeluaran per Kategori — {isAllVehicles ? 'Semua Armada' : activePlate}
                </h3>
                <p className="card-subtitle">Klik salah satu kategori di bawah ini untuk memfilter tabel langsung</p>
              </div>
              {selectedCategoryFilter !== 'all' && (
                <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.75rem' }}
                >
                  ✕ Reset Filter Kategori (Lihat Semua)
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              {/* All categories chip */}
              <div
                onClick={() => setSelectedCategoryFilter('all')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: selectedCategoryFilter === 'all' ? 'var(--color-primary-light)' : 'var(--bg-app)',
                  border: selectedCategoryFilter === 'all' ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                  📋 Semua Kategori
                </div>
                <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)', marginTop: '4px' }}>
                  {formatRupiah(targetTotalCost)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {targetVehicleExpenses.length} pengeluaran
                </div>
              </div>

              {/* Each category present */}
              {presentCategoryList.length === 0 ? (
                <div style={{ gridColumn: 'span 3', padding: '16px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Belum ada pengeluaran pada periode ini.
                </div>
              ) : (
                presentCategoryList.map((catName) => {
                  const data = categoryTotals[catName];
                  const isSelected = selectedCategoryFilter === catName;
                  return (
                    <div
                      key={catName}
                      onClick={() => setSelectedCategoryFilter(catName)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--color-warning-light)' : 'var(--bg-app)',
                        border: isSelected ? '2px solid var(--color-warning)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{catName}</span>
                        {catName === 'BBM' && <Fuel size={13} style={{ color: 'var(--color-warning)' }} />}
                      </div>
                      <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)', marginTop: '4px' }}>
                        {formatRupiah(data.total)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {catName === 'BBM' && data.liters > 0 ? `${formatNumber(data.liters)} Liter • ` : ''}
                        {data.count} transaksi
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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

          {/* Tables: Expenses & Trips */}
          <div style={{ display: 'grid', gridTemplateColumns: isAllVehicles ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Table Expenses Mobil */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1rem' }}>
                    <Wallet size={16} style={{ color: 'var(--color-danger)' }} />
                    Daftar Pengeluaran {isAllVehicles ? 'Seluruh Armada' : activePlate} ({displayedVehicleExpenses.length} Transaksi)
                  </h3>
                  <p className="card-subtitle">
                    Urutan: <strong>{expenseSortBy.includes('category') ? 'Kategori' : expenseSortBy.includes('date') ? 'Tanggal' : 'Nominal'}</strong>
                    {selectedCategoryFilter !== 'all' ? ` • Filter: ${selectedCategoryFilter}` : ''}
                  </p>
                </div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      {isAllVehicles && <th>Plat Mobil</th>}
                      <th>Kategori</th>
                      <th>Deskripsi & Rincian</th>
                      <th>Nominal Biaya</th>
                      <th>Catatan</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={isAllVehicles ? 8 : 7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)' }}>
                          Tidak ada transaksi pengeluaran yang cocok dengan kriteria
                        </td>
                      </tr>
                    ) : (
                      paginatedExpenses.map((e, idx) => (
                        <tr key={e.id}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{(safeExpPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                          <td style={{ fontSize: '0.8rem' }}>{formatDate(e.date, 'short')}</td>
                          {isAllVehicles && (
                            <td>
                              <span className="badge badge-fleet" style={{ fontWeight: '600' }}>
                                {e.targetPlate || 'Umum'}
                              </span>
                            </td>
                          )}
                          <td>
                            <span className="badge badge-neutral" style={{ fontWeight: '600' }}>
                              {e.category}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: '500' }}>{e.description}</div>
                            {e.fuelDetails && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                                ⛽ {e.fuelDetails.liters} L • {formatRupiah(e.fuelDetails.pricePerLiter)}/L • {e.fuelDetails.location || 'SPBU'}
                              </div>
                            )}
                          </td>
                          <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
                            {formatRupiah(e.total)}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.notes || '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                if (window.confirm(`Hapus biaya ${e.description}?`)) {
                                  onDeleteExpense(e.id);
                                }
                              }}
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--color-danger)', padding: '4px 6px' }}
                              title="Hapus Pengeluaran"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                    {displayedVehicleExpenses.length > 0 && (
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: '600', borderTop: '2px solid var(--border-medium)' }}>
                        <td colSpan={isAllVehicles ? 5 : 4} style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          TOTAL PENGELUARAN:
                        </td>
                        <td className="font-mono" style={{ color: 'var(--color-danger)', fontSize: '0.95rem' }}>
                          {formatRupiah(displayedCostTotal)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {totalExpPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Menampilkan {(safeExpPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeExpPage * ITEMS_PER_PAGE, displayedVehicleExpenses.length)} dari {displayedVehicleExpenses.length} transaksi
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline btn-sm" disabled={safeExpPage === 1} onClick={() => setExpensePage(p => p - 1)}>Sebelumnya</button>
                      <div style={{ padding: '4px 12px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                        Hal {safeExpPage} / {totalExpPages}
                      </div>
                      <button className="btn btn-outline btn-sm" disabled={safeExpPage === totalExpPages} onClick={() => setExpensePage(p => p + 1)}>Selanjutnya</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Table Trips Mobil (when single vehicle selected or side-by-side) */}
            {!isAllVehicles && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title" style={{ fontSize: '1rem' }}>
                    <Truck size={16} style={{ color: 'var(--color-fleet)' }} />
                    Riwayat Perjalanan {activePlate} ({targetVehicleTrips.length} Rit)
                  </h3>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Rute / Tujuan</th>
                        <th>Muatan (Kg)</th>
                        <th>Tarif/Kg</th>
                        <th>Uang Jalan</th>
                        <th>Hasil Perjalanan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetVehicleTrips.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                            Tidak ada perjalanan pada periode ini
                          </td>
                        </tr>
                      ) : (
                        targetVehicleTrips.map((t) => (
                          <tr key={t.id}>
                            <td style={{ fontSize: '0.8rem' }}>{formatDate(t.date, 'short')}</td>
                            <td style={{ fontSize: '0.85rem', fontWeight: '600' }}>{t.destination}</td>
                            <td>{formatNumber(t.weightKg || 0)} Kg</td>
                            <td className="font-mono" style={{ fontSize: '0.8rem' }}>{formatRupiah(t.ratePerKg || 0)}</td>
                            <td className="font-mono" style={{ fontSize: '0.8rem', color: t.travelAllowance ? 'var(--color-danger)' : 'var(--text-dim)' }}>
                              {t.travelAllowance ? formatRupiah(t.travelAllowance) : 'Rp 0'}
                            </td>
                            <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                              {formatRupiah(t.totalRevenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: PERJALANAN EKSPEDISI (LOG)                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'expedition-trips' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title">
                <Truck size={20} style={{ color: 'var(--color-fleet)' }} />
                Log Transaksi Perjalanan Ekspedisi Armada
              </h3>
              <p className="card-subtitle">
                Rumus Hasil Perjalanan: (Total Berat Muatan × Biaya Tarif/Kg) - Uang Jalan
              </p>
            </div>
            <div className="card-header__actions">
              <input
                type="text"
                placeholder="Cari plat, driver, rute..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
              <button
                onClick={() => {
                  setTripError('');
                  setTripDate(getTodayDateString());
                  setTripVehicleId('');
                  setTripVehSearch('');
                  setTripDriver('');
                  setTripDestination('');
                  setTripWeightKg('');
                  setTripRatePerKg('');
                  setTripTravelAllowance('');
                  setTripDistanceKm('');
                  setTripCargoNotes('');
                  setShowTripModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Catat Perjalanan Baru</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  {renderSortableHeader('Tanggal', 'date', tripSort, setTripSort)}
                  {renderSortableHeader('Plat Mobil', 'vehicle', tripSort, setTripSort)}
                  {renderSortableHeader('Driver', 'driver', tripSort, setTripSort)}
                  <th>Tujuan / Rute</th>
                  <th>Muatan (Kg)</th>
                  <th>Biaya / Tarif/Kg</th>
                  {renderSortableHeader('Uang Jalan (Rp)', 'allowance', tripSort, setTripSort)}
                  {renderSortableHeader('Hasil Perjalanan (Rp)', 'revenue', tripSort, setTripSort)}
                  <th>Keterangan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrips.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      Tidak ada perjalanan ekspedisi yang cocok pada periode ini
                    </td>
                  </tr>
                ) : (
                  paginatedTrips.map((trip, idx) => (
                    <tr key={trip.id}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safeTripPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td>{formatDate(trip.date, 'short')}</td>
                      <td>
                        <span className="badge badge-fleet" style={{ fontWeight: '600' }}>
                          {trip.plateNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600' }}>{trip.driver}</td>
                      <td style={{ fontSize: '0.85rem' }}>{trip.destination}</td>
                      <td className="font-mono" style={{ fontWeight: '600' }}>
                        {formatNumber(trip.weightKg || 0)} Kg
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                        {formatRupiah(trip.ratePerKg || 0)} / Kg
                      </td>
                      <td className="font-mono" style={{ color: trip.travelAllowance ? 'var(--color-danger)' : 'var(--text-dim)', fontWeight: trip.travelAllowance ? '600' : 'normal' }}>
                        {trip.travelAllowance ? formatRupiah(trip.travelAllowance) : 'Rp 0'}
                      </td>
                      <td className="font-mono" style={{ fontWeight: '700', color: 'var(--color-success)' }}>
                        {formatRupiah(trip.totalRevenue)}
                        {trip.travelAllowance ? (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            Bruto: {formatRupiah((trip.weightKg || 0) * (trip.ratePerKg || 0))}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{trip.cargoNotes || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus perjalanan ${trip.plateNumber} rute ${trip.destination}?`)) {
                              onDeleteTrip(trip.id);
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
                {filteredTrips.length > 0 && (
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: '600', borderTop: '2px solid var(--border-medium)' }}>
                    <td colSpan={5} style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      TOTAL RIT: {filteredTrips.length} Perjalanan
                    </td>
                    <td className="font-mono" style={{ color: 'var(--color-fleet)', fontWeight: '700' }}>
                      {formatNumber(totalFilteredTripsWeight)} Kg
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ({(totalFilteredTripsWeight / 1000).toFixed(2)} Ton)
                      </div>
                    </td>
                    <td>-</td>
                    <td className="font-mono" style={{ color: 'var(--color-danger)', fontSize: '0.95rem', fontWeight: '700' }}>
                      {formatRupiah(totalFilteredTripsAllowance)}
                    </td>
                    <td className="font-mono" style={{ color: 'var(--color-success)', fontSize: '0.95rem', fontWeight: '700' }}>
                      {formatRupiah(totalFilteredTripsRevenue)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalTripPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Menampilkan {(safeTripPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeTripPage * ITEMS_PER_PAGE, filteredTrips.length)} dari {filteredTrips.length} perjalanan
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline btn-sm" disabled={safeTripPage === 1} onClick={() => setTripPage(p => p - 1)}>Sebelumnya</button>
                  <div style={{ padding: '4px 12px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    Hal {safeTripPage} / {totalTripPages}
                  </div>
                  <button className="btn btn-outline btn-sm" disabled={safeTripPage === totalTripPages} onClick={() => setTripPage(p => p + 1)}>Selanjutnya</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB: MASTER DATA ARMADA MOBIL                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'expedition-vehicles' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title">
                <CarFront size={20} style={{ color: 'var(--color-fleet)' }} />
                Daftar Master Armada & Tarif Dasar per Kg
              </h3>
              <p className="card-subtitle">
                Atur armada mobil, supir default, dan tarif muatan per kilogram (Rp/Kg)
              </p>
            </div>
            <div className="card-header__actions">
              <input
                type="text"
                placeholder="Cari plat / nama armada..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
              <button
                onClick={() => {
                  setEditingVehicleId(null);
                  setVehPlate('');
                  setVehType('Truk Colt Diesel Double / Canter HD (6 Roda)');
                  setVehName('');
                  setVehDriver('');
                  setVehRatePerKg(350);
                  setVehStatus('active');
                  setVehNotes('');
                  setVehError('');
                  setShowVehicleModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Tambah Armada</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Plat Nomor</th>
                  <th>Nama Armada</th>
                  <th>Jenis Kendaraan</th>
                  <th>Driver Default</th>
                  <th>Tarif Dasar per Kg</th>
                  <th>Status</th>
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      Tidak ada data armada kendaraan
                    </td>
                  </tr>
                ) : (
                  paginatedVehicles.map((v, idx) => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safeVehPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{v.plateNumber}</td>
                      <td style={{ fontWeight: '600' }}>{v.vehicleName}</td>
                      <td>{v.vehicleType}</td>
                      <td>{v.defaultDriver || '-'}</td>
                      <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-fleet)' }}>
                        {formatRupiah(v.ratePerKg || 350)} / Kg
                      </td>
                      <td>
                        <span className={`badge ${v.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {v.status === 'active' ? 'Beroperasi' : v.status === 'maintenance' ? 'Servis Bengkel' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.notes || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditVehicle(v)}
                            className="btn btn-outline btn-sm"
                            title="Edit Data Kendaraan"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPlateForRecap(v.plateNumber);
                              onSubTabChange('expedition-vehicle-recap');
                            }}
                            className="btn btn-secondary btn-sm"
                            title="Buka Rekap Biaya Mobil Ini"
                          >
                            <Wrench size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus armada ${v.plateNumber}? Data perjalanan lama tetap aman.`)) {
                                onDeleteVehicle(v.id);
                              }
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {totalVehPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Menampilkan {(safeVehPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safeVehPage * ITEMS_PER_PAGE, filteredVehicles.length)} dari {filteredVehicles.length} armada
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline btn-sm" disabled={safeVehPage === 1} onClick={() => setVehiclePage(p => p - 1)}>Sebelumnya</button>
                  <div style={{ padding: '4px 12px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    Hal {safeVehPage} / {totalVehPages}
                  </div>
                  <button className="btn btn-outline btn-sm" disabled={safeVehPage === totalVehPages} onClick={() => setVehiclePage(p => p + 1)}>Selanjutnya</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: ANALITIK ARMADA                                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'expedition-analytics' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <ChartNoAxesColumnIncreasing size={20} style={{ color: 'var(--color-fleet)' }} />
                Tabel Perbandingan Kinerja & Efisiensi Seluruh Armada
              </h3>
              <p className="card-subtitle">
                Melihat armada yang paling produktif, tonase kargo, biaya operasional, dan laba riil (Periode: {periodLabel})
              </p>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Plat Nomor</th>
                  <th>Nama Armada</th>
                  <th>Total Rit</th>
                  <th>Total Muatan (Kg / Ton)</th>
                  <th>Total Jarak</th>
                  <th>Total Pendapatan</th>
                  <th>Total Biaya</th>
                  <th>Laba Operasional Mobil</th>
                </tr>
              </thead>
              <tbody>
                {appData.vehicles.map((v, idx) => {
                  const agg = vehicleAnalyticsAgg.get(v.plateNumber) || { tripCount: 0, totalRevenue: 0, distanceKm: 0, weightKg: 0, expenseCount: 0, totalCost: 0 };
                  const rev = agg.totalRevenue;
                  const km = agg.distanceKm;
                  const weight = agg.weightKg;
                  const cost = agg.totalCost;
                  const tripsLength = agg.tripCount;
                  
                  const profit = rev - cost;
                  const isProf = profit >= 0;

                  return (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{v.plateNumber}</td>
                      <td>{v.vehicleName}</td>
                      <td>{tripsLength} Rit</td>
                      <td className="font-mono">
                        {formatNumber(weight)} Kg
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                          ({(weight / 1000).toFixed(2)} Ton)
                        </span>
                      </td>
                      <td className="font-mono">{formatNumber(km)} Km</td>
                      <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                        {formatRupiah(rev)}
                      </td>
                      <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
                        {formatRupiah(cost)}
                      </td>
                      <td className="font-mono" style={{ fontWeight: '600', color: isProf ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatRupiah(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT PERJALANAN EKSPEDISI                                         */}
      {/* ========================================================================= */}
      {showTripModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} style={{ color: 'var(--color-fleet)' }} />
                Catat Perjalanan Ekspedisi Armada
              </h3>
              <button
                onClick={() => setShowTripModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {tripError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {tripError}
              </div>
            )}

            <form onSubmit={handleSaveTrip}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tanggal Perjalanan *</label>
                  <input
                    type="date"
                    value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pilih Kendaraan / Plat *</label>
                  <datalist id="exp-vehicles-list">
                    {appData.vehicles.map((v) => (
                      <option key={v.id} value={v.plateNumber}>
                        {v.vehicleName} (Tarif: {formatRupiah(v.ratePerKg || 350)}/Kg)
                      </option>
                    ))}
                  </datalist>
                  <input
                    type="text"
                    list="exp-vehicles-list"
                    placeholder="Ketik plat nomor..."
                    value={tripVehSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTripVehSearch(val);
                      const found = appData.vehicles.find((v) => v.plateNumber === val);
                      if (found) {
                        setTripVehicleId(found.id);
                        setTripDriver(found.defaultDriver);
                        setTripRatePerKg(found.ratePerKg || 350);
                        setTimeout(() => tripDestinationRef.current?.focus(), 50);
                      } else {
                        setTripVehicleId('');
                      }
                    }}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                {renderExpeditionMasterField(
                  'Nama Driver / Supir *',
                  'expeditionDrivers',
                  appData?.settings?.expeditionDrivers || [],
                  tripDriver,
                  setTripDriver,
                  showAddDriverInline,
                  setShowAddDriverInline,
                  newDriverInput,
                  setNewDriverInput,
                  'Contoh: Budi Santoso'
                )}

                {renderExpeditionMasterField(
                  'Tujuan / Rute Perjalanan *',
                  'expeditionRoutes',
                  appData?.settings?.expeditionRoutes || [],
                  tripDestination,
                  setTripDestination,
                  showAddRouteInline,
                  setShowAddRouteInline,
                  newRouteInput,
                  setNewRouteInput,
                  'Contoh: Medan - Pematang Siantar'
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Berat Muatan (Kg) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 8500"
                    value={tripWeightKg}
                    onChange={(e) => setTripWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                  <div className="input-hint">
                    {tripWeightKg ? `Setara ${(Number(tripWeightKg) / 1000).toFixed(2)} Ton` : 'Masukkan total kilogram muatan'}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Biaya / Tarif per Kg (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 350"
                    value={tripRatePerKg}
                    onChange={(e) => setTripRatePerKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                  <div className="input-hint">Biaya kirim per Kg muatan</div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Uang Jalan (Rp) (Opsional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 450000"
                    value={tripTravelAllowance}
                    onChange={(e) => setTripTravelAllowance(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                  />
                  <div className="input-hint">Uang jalan supir / operasional rit (mengurangi hasil perjalanan)</div>
                </div>
              </div>

              {/* Perhitungan Hasil Perjalanan Ekspedisi Preview: Total Berat x Biaya/Kg - Uang Jalan */}
              {(() => {
                const w = Number(tripWeightKg) || 0;
                const r = Number(tripRatePerKg) || 0;
                const a = Number(tripTravelAllowance) || 0;
                const gross = w * r;
                const net = gross - a;
                return (
                  <div
                    style={{
                      backgroundColor: 'var(--color-fleet-light)',
                      border: '1px solid var(--color-fleet-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 18px',
                      marginBottom: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Rumus: <strong>(Total Berat × Tarif/Kg) - Uang Jalan</strong>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600', marginTop: '2px' }}>
                        Bruto: {formatNumber(w)} Kg × {formatRupiah(r)}/Kg = {formatRupiah(gross)}
                      </div>
                      {a > 0 && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-danger)', fontWeight: '600', marginTop: '2px' }}>
                          Uang Jalan: - {formatRupiah(a)}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hasil Perjalanan (Pendapatan):</div>
                      <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-success)' }}>
                        {formatRupiah(net)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="form-group">
                <div style={{ marginBottom: '4px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Keterangan / Jenis Muatan (Opsional)</label>
                </div>
                <input
                  type="text"
                  placeholder="Contoh: Semen sak 160 bks / No. SPB 4521"
                  value={tripCargoNotes}
                  onChange={(e) => setTripCargoNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Perjalanan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT ARMADA                                              */}
      {/* ========================================================================= */}
      {showVehicleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CarFront size={20} style={{ color: 'var(--color-fleet)' }} />
                {editingVehicleId ? 'Edit Data Armada Kendaraan' : 'Tambah Armada Baru'}
              </h3>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {vehError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {vehError}
              </div>
            )}

            <form onSubmit={handleSaveVehicle}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nomor Plat Kendaraan *</label>
                  <input
                    type="text"
                    placeholder="Contoh: BK 1234 XX"
                    value={vehPlate}
                    onChange={(e) => setVehPlate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  {renderExpeditionMasterField(
                    'Jenis Kendaraan *',
                    'expeditionVehTypes',
                    appData?.settings?.expeditionVehTypes || [],
                    vehType,
                    setVehType,
                    showAddVehTypeInline,
                    setShowAddVehTypeInline,
                    newVehTypeInput,
                    setNewVehTypeInput,
                    'Contoh: Truk Tronton'
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nama Panggilan Armada</label>
                  <input
                    type="text"
                    placeholder="Contoh: Armada Siantar Express (01)"
                    value={vehName}
                    onChange={(e) => setVehName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  {renderExpeditionMasterField(
                    'Driver / Supir Utama (Opsional)',
                    'expeditionDrivers',
                    appData?.settings?.expeditionDrivers || [],
                    vehDriver,
                    setVehDriver,
                    showAddDriverInline,
                    setShowAddDriverInline,
                    newDriverInput,
                    setNewDriverInput,
                    'Contoh: Budi Santoso'
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tarif Dasar Muatan per Kg (Rp/Kg) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 350"
                    value={vehRatePerKg}
                    onChange={(e) => setVehRatePerKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                  <div className="input-hint">Tarif dasar per kilogram saat mencatat perjalanan</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status Operasional Kendaraan</label>
                  <select
                    value={vehStatus}
                    onChange={(e) => setVehStatus(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="active">🟢 Siap Beroperasi (Jalan)</option>
                    <option value="maintenance">🟡 Dalam Servis / Perbaikan Bengkel</option>
                    <option value="inactive">⚪ Non-Aktif / Parkir Cadangan</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Kapasitas max, catatan servis, dll."
                  value={vehNotes}
                  onChange={(e) => setVehNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVehicleId ? 'Simpan Perubahan' : 'Tambah Armada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT BIAYA MOBIL X                                               */}
      {/* ========================================================================= */}
      {showVehExpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={20} style={{ color: 'var(--color-warning)' }} />
                Catat Biaya Khusus Armada: {vehExpPlate}
              </h3>
              <button
                onClick={() => setShowVehExpModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {vehExpError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {vehExpError}
              </div>
            )}

            <form onSubmit={handleSaveVehExpense}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    value={vehExpDate}
                    onChange={(e) => setVehExpDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group" style={{ display: 'none' }}>
                  {/* Spacer */}
                </div>
              </div>

              <ExpenseCategoryInput
                sector="expedition"
                category={vehExpCategory}
                onCategoryChange={setVehExpCategory}
                description={vehExpDesc}
                onDescriptionChange={setVehExpDesc}
                options={appData.settings?.expeditionVehExpCategories || []}
                onAddOption={(newOption) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({ expeditionVehExpCategories: [...(appData.settings?.expeditionVehExpCategories || []), newOption] });
                  }
                }}
                onDeleteOption={(option) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({ expeditionVehExpCategories: (appData.settings?.expeditionVehExpCategories || []).filter(c => c !== option) });
                  }
                }}
                isBbmCategory={vehExpCategory === 'BBM'}
              />

              {/* Form Khusus BBM */}
              {vehExpCategory === 'BBM' ? (
                <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-warning)' }}>
                      ⛽ Rincian Pengisian BBM:
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Klik jenis BBM cepat:</span>
                  </div>

                  {/* Fuel presets */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {[
                      { label: 'Bio Solar (Rp 6.800)', price: 6800, desc: 'Isi Bio Solar Subsidi' },
                      { label: 'Dexlite (Rp 14.500)', price: 14500, desc: 'Isi Dexlite' },
                      { label: 'Pertamina Dex (Rp 15.100)', price: 15100, desc: 'Isi Pertamina Dex' },
                      { label: 'Pertalite (Rp 10.000)', price: 10000, desc: 'Isi Pertalite' },
                      { label: 'Pertamax (Rp 12.950)', price: 12950, desc: 'Isi Pertamax' },
                    ].map((f) => (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => {
                          setVehExpPricePerLiter(f.price);
                          if (!vehExpDesc) setVehExpDesc(f.desc);
                        }}
                        className="btn btn-outline btn-sm"
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '12px',
                          backgroundColor: vehExpPricePerLiter === f.price ? 'var(--color-warning)' : 'var(--bg-card)',
                          color: vehExpPricePerLiter === f.price ? '#fff' : 'var(--text-main)',
                          borderColor: 'var(--color-warning-border)',
                        }}
                      >
                        ⛽ {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Jumlah Liter BBM *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        placeholder="Contoh: 50"
                        value={vehExpLiters}
                        onChange={(e) => setVehExpLiters(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Harga per Liter (Rp) *</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Contoh: 6800"
                        value={vehExpPricePerLiter}
                        onChange={(e) => setVehExpPricePerLiter(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Kilometer (Odometer saat isi)</label>
                      <input
                        type="number"
                        placeholder="Contoh: 142500"
                        value={vehExpOdometer}
                        onChange={(e) => setVehExpOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Lokasi / SPBU</label>
                      <input
                        type="text"
                        placeholder="Contoh: SPBU 14.201 Amplas"
                        value={vehExpLocation}
                        onChange={(e) => setVehExpLocation(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Biaya BBM:</span>
                    <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-warning)' }}>
                      {formatRupiah((Number(vehExpLiters) || 0) * (Number(vehExpPricePerLiter) || 0))}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Total Biaya (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 850000"
                    value={vehExpAmount}
                    onChange={(e) => setVehExpAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Bengkel / nama teknisi / toko sparepart..."
                  value={vehExpNotes}
                  onChange={(e) => setVehExpNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowVehExpModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Biaya Armada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
