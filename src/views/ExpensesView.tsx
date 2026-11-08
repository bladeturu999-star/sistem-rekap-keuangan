import { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Trash2,
  Flame,
  Truck,
  Building,
  X,
  ArrowUpDown
} from 'lucide-react';
import type { AppData, Expense, ExpenseSector, ActiveTab, DateFilterType, DateRange, CompanySettings } from '../types';
import { formatRupiah, formatDate, getTodayDateString } from '../utils/formatters';
import { ExpenseCategoryInput } from '../components/ExpenseCategoryInput';
import { DateFilterBar } from '../components/DateFilterBar';

interface ExpensesViewProps {
  appData: AppData;
  activeSubTab: 'expenses' | 'expense-categories';
  onSubTabChange: (tab: ActiveTab) => void;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (id: string) => void;
  isDateInFilter?: (dateStr: string) => boolean;
  dateFilter?: DateFilterType;
  setDateFilter?: (f: DateFilterType) => void;
  dateRange?: DateRange;
  setDateRange?: React.Dispatch<React.SetStateAction<DateRange>>;
  periodLabel?: string;
  onUpdateSettings?: (settings: Partial<CompanySettings>) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  appData,
  activeSubTab,
  onSubTabChange,
  onAddExpense,
  onDeleteExpense,
  isDateInFilter,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
  periodLabel,
  onUpdateSettings
}) => {
  // Modal states
  const [showModal, setShowModal] = useState(false);
  
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedPlateFilter, setSelectedPlateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSectorFilter, selectedCategoryFilter, selectedPlateFilter, sortBy, dateFilter, dateRange]);

  // Form Expense
  const [date, setDate] = useState(getTodayDateString());
  const [sector, setSector] = useState<ExpenseSector>('expedition');
  const [category, setCategory] = useState('');
  const [targetPlate, setTargetPlate] = useState(appData.vehicles[0]?.plateNumber || '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Fuel specific
  const [fuelLiters, setFuelLiters] = useState<number | ''>('');
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number | ''>(6800);
  const [fuelOdometer, setFuelOdometer] = useState<number | ''>('');
  const [fuelLocation, setFuelLocation] = useState('');

  const [formError, setFormError] = useState('');



  const handleSectorChange = (newSector: ExpenseSector) => {
    setSector(newSector);
    setCategory('');
  };

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!category) {
      setFormError('Kategori pengeluaran wajib dipilih.');
      return;
    }

    const finalDesc = sector === 'expedition' && category === 'BBM' && !description.trim()
      ? `Pengisian BBM ${fuelLiters || 0} Liter (${targetPlate})`
      : description.trim();

    if (!finalDesc) {
      setFormError('Deskripsi pengeluaran wajib diisi.');
      return;
    }

    let finalTotal = 0;
    let finalQty = 1;
    let finalUnitPrice = 0;
    let fuelDetails = undefined;

    if (sector === 'expedition' && category === 'BBM') {
      const liters = Number(fuelLiters) || 0;
      const priceL = Number(fuelPricePerLiter) || 0;
      if (liters <= 0 || priceL <= 0) {
        setFormError('Jumlah liter dan harga BBM per liter wajib diisi.');
        return;
      }
      finalQty = liters;
      finalUnitPrice = priceL;
      finalTotal = liters * priceL;
      fuelDetails = {
        fuelType: 'Bio Solar',
        liters,
        pricePerLiter: priceL,
        odometer: fuelOdometer ? Number(fuelOdometer) : undefined,
        location: fuelLocation.trim() || undefined,
      };
    } else {
      finalQty = Number(quantity) || 1;
      finalUnitPrice = Number(unitPrice) || 0;
      if (finalUnitPrice <= 0) {
        setFormError('Nominal harga / biaya wajib diisi.');
        return;
      }
      finalTotal = finalQty * finalUnitPrice;
    }

    onAddExpense({
      date,
      sector,
      category,
      description: finalDesc,
      quantity: finalQty,
      unitPrice: finalUnitPrice,
      total: finalTotal,
      allocationType: sector === 'expedition' ? 'vehicle' : 'general',
      targetPlate: sector === 'expedition' ? targetPlate : undefined,
      fuelDetails,
      notes: notes.trim(),
    });

    setShowModal(false);
    setDescription('');
    setQuantity(1);
    setUnitPrice('');
    setFuelLiters('');
    setNotes('');
  };


  const baseFilteredExpenses = useMemo(() => {
    return appData.expenses.filter((exp) => {
      if (isDateInFilter && !isDateInFilter(exp.date)) return false;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (exp.description || '').toLowerCase().includes(q) ||
        (exp.category || '').toLowerCase().includes(q) ||
        (exp.targetPlate || '').toLowerCase().includes(q) ||
        (exp.date || '').includes(q);

      const matchSector = selectedSectorFilter === 'all' || exp.sector === selectedSectorFilter;
      const matchCat = selectedCategoryFilter === 'all' || exp.category === selectedCategoryFilter;
      const matchPlate = selectedPlateFilter === 'all' || exp.targetPlate === selectedPlateFilter;

      return matchSearch && matchSector && matchCat && matchPlate;
    });
  }, [appData.expenses, isDateInFilter, searchQuery, selectedSectorFilter, selectedCategoryFilter, selectedPlateFilter]);

  const filteredExpenses = useMemo(() => {
    const arr = [...baseFilteredExpenses];
    arr.sort((a, b) => {
      if (sortBy === 'category-asc') {
        const cmp = a.category.localeCompare(b.category);
        if (cmp !== 0) return cmp;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'category-desc') {
        const cmp = b.category.localeCompare(a.category);
        if (cmp !== 0) return cmp;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount-desc') return b.total - a.total;
      if (sortBy === 'amount-asc') return a.total - b.total;
      return 0;
    });
    return arr;
  }, [baseFilteredExpenses, sortBy]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.total, 0);
  }, [filteredExpenses]);

  // Pagination logic
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedExpenses = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredExpenses, safePage]);

  const handleSortToggle = (field: string) => {
    setSortBy(prev => {
      if (prev.startsWith(field)) {
        return prev.endsWith('desc') ? `${field}-asc` : `${field}-desc`;
      }
      return `${field}-desc`;
    });
  };

  const renderSortableHeader = (label: string, field: string, isRightAlign = false) => {
    const isActive = sortBy.startsWith(field);
    const isAsc = isActive && sortBy.endsWith('asc');
    
    return (
      <th 
        style={{ cursor: 'pointer', userSelect: 'none', textAlign: isRightAlign ? 'right' : 'left' }}
        onClick={() => handleSortToggle(field)}
        title={`Urutkan berdasarkan ${label}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRightAlign ? 'flex-end' : 'flex-start', gap: '4px' }}>
          {label}
          {isActive && (
            <ArrowUpDown size={14} style={{ transform: isAsc ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />
          )}
        </div>
      </th>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub Tabs */}
      <div className="tabs-nav">
        <button
          onClick={() => onSubTabChange('expenses')}
          className={`tab-btn ${activeSubTab === 'expenses' ? 'active' : ''}`}
        >
          <Wallet size={16} />
          <span>Daftar Pengeluaran Terpadu</span>
          <span className="badge badge-danger">{filteredExpenses.length}</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      {dateFilter && setDateFilter && dateRange && setDateRange && (
        <DateFilterBar
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          dateRange={dateRange}
          setDateRange={setDateRange}
          periodLabel={periodLabel || ''}
          labelPrefix="Filter Waktu Beban Operasional"
        />
      )}

      {activeSubTab === 'expenses' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title">
                <Wallet size={20} style={{ color: 'var(--color-danger)' }} />
                Catatan Pengeluaran Operasional Perusahaan
              </h3>
              <p className="card-subtitle">
                Total beban tersaring: <span className="font-mono" style={{ fontWeight: '600', color: 'var(--color-danger)' }}>{formatRupiah(totalFilteredAmount)}</span>
                {periodLabel && <span> ({periodLabel})</span>}
              </p>
            </div>
            <div className="card-header__actions">
              <button
                onClick={() => {
                  setFormError('');
                  setCategory('');
                  setShowModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Catat Pengeluaran Baru</span>
              </button>
            </div>
          </div>

          {/* Filter & Sorting Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              padding: '14px 18px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Cari deskripsi, kategori, plat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div>
              <select
                value={selectedSectorFilter}
                onChange={(e) => setSelectedSectorFilter(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="all">🌐 Semua Sektor</option>
                <option value="lpg">🔥 Sektor Gas LPG</option>
                <option value="expedition">🚛 Sektor Ekspedisi (Armada)</option>
                <option value="general">🏢 Umum & Kantor</option>
              </select>
            </div>

            <div>
              <select
                value={selectedPlateFilter}
                onChange={(e) => setSelectedPlateFilter(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="all">🚗 Semua Alokasi / Mobil</option>
                {appData.vehicles.map((v) => (
                  <option key={v.id} value={v.plateNumber}>
                    {v.plateNumber} ({v.vehicleName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="all">🏷️ Semua Kategori</option>
                {Array.from(new Set([
                  ...(appData.settings?.lpgExpCategories || []),
                  ...(appData.settings?.expeditionVehExpCategories || []),
                  ...(appData.settings?.generalExpCategories || [])
                ])).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="date-desc">📅 Tanggal (Terbaru)</option>
                <option value="date-asc">📅 Tanggal (Terlama)</option>
                <option value="category-asc">🏷️ Kategori (A - Z)</option>
                <option value="category-desc">🏷️ Kategori (Z - A)</option>
                <option value="amount-desc">💰 Nominal (Terbesar)</option>
                <option value="amount-asc">💰 Nominal (Terkecil)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  {renderSortableHeader('Tanggal', 'date')}
                  <th>Sektor</th>
                  <th>Alokasi / Plat</th>
                  {renderSortableHeader('Kategori', 'category')}
                  <th>Deskripsi Biaya</th>
                  <th>Rincian Kuantitas</th>
                  {renderSortableHeader('Total Biaya', 'amount')}
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      Tidak ada data pengeluaran yang sesuai
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((exp, idx) => (
                    <tr key={exp.id}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{(safePage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td>{formatDate(exp.date, 'short')}</td>
                      <td>
                        {exp.sector === 'lpg' ? (
                          <span className="badge badge-lpg">
                            <Flame size={10} /> LPG
                          </span>
                        ) : exp.sector === 'expedition' ? (
                          <span className="badge badge-fleet">
                            <Truck size={10} /> Ekspedisi
                          </span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: '#fff' }}>
                            <Building size={10} /> Umum
                          </span>
                        )}
                      </td>
                      <td>
                        {exp.targetPlate ? (
                          <span className="badge badge-warning" style={{ fontWeight: '600' }}>
                            {exp.targetPlate}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Operasional Umum</span>
                        )}
                      </td>
                      <td style={{ fontWeight: '600' }}>{exp.category}</td>
                      <td style={{ fontSize: '0.85rem' }}>{exp.description}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {exp.fuelDetails ? (
                          <div>
                            <div>{exp.fuelDetails.liters} L @ {formatRupiah(exp.fuelDetails.pricePerLiter)}</div>
                            {exp.fuelDetails.odometer && <div style={{ color: 'var(--text-dim)' }}>{exp.fuelDetails.odometer} Km</div>}
                          </div>
                        ) : (
                          <div>{exp.quantity} × {formatRupiah(exp.unitPrice)}</div>
                        )}
                      </td>
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
                {filteredExpenses.length > 0 && (
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: '600', borderTop: '2px solid var(--border-medium)' }}>
                    <td colSpan={7} style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      TOTAL BIAYA PENGELUARAN TERSARING:
                    </td>
                    <td className="font-mono" style={{ color: 'var(--color-danger)', fontSize: '0.95rem', fontWeight: '700' }}>
                      {formatRupiah(totalFilteredAmount)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Menampilkan {(safePage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(safePage * ITEMS_PER_PAGE, filteredExpenses.length)} dari {filteredExpenses.length} pengeluaran
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline btn-sm" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>Sebelumnya</button>
                  <div style={{ padding: '4px 12px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    Hal {safePage} / {totalPages}
                  </div>
                  <button className="btn btn-outline btn-sm" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Selanjutnya</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* MODAL: INPUT PENGELUARAN TERPADU                                          */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={20} style={{ color: 'var(--color-danger)' }} />
                Catat Pengeluaran Operasional
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitExpense}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tanggal Pengeluaran</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Divisi / Sektor Biaya *</label>
                  <select
                    value={sector}
                    onChange={(e) => handleSectorChange(e.target.value as ExpenseSector)}
                    className="form-select"
                  >
                    <option value="expedition">🚚 Armada Ekspedisi (Terkait Mobil/BBM/Supir)</option>
                    <option value="lpg">🔥 Pangkalan Gas LPG (Gudang/Bongkar Muat/Staf)</option>
                    <option value="general">🏢 Operasional Umum Kantor & Administrasi</option>
                  </select>
                </div>
              </div>

              {/* Jika Ekspedisi: Memilih Plat Mobil */}
              {sector === 'expedition' && (
                <div className="form-group">
                  <label className="form-label">Alokasi Plat Kendaraan (Mobil X) *</label>
                  <select
                    value={targetPlate}
                    onChange={(e) => setTargetPlate(e.target.value)}
                    className="form-select"
                    required
                  >
                    {appData.vehicles.map((v) => (
                      <option key={v.id} value={v.plateNumber}>
                        {v.plateNumber} — {v.vehicleName} ({v.defaultDriver})
                      </option>
                    ))}
                  </select>
                  <div className="input-hint">Pengeluaran ini akan langsung masuk ke laporan laba rugi mobil tersebut</div>
                </div>
              )}

              <ExpenseCategoryInput
                sector={sector}
                category={category}
                onCategoryChange={setCategory}
                description={description}
                onDescriptionChange={setDescription}
                options={
                  sector === 'lpg' ? (appData.settings?.lpgExpCategories || []) :
                  sector === 'expedition' ? (appData.settings?.expeditionVehExpCategories || []) :
                  (appData.settings?.generalExpCategories || [])
                }
                onAddOption={(newOption) => {
                  if (onUpdateSettings) {
                    if (sector === 'lpg') {
                      onUpdateSettings({ lpgExpCategories: [...(appData.settings?.lpgExpCategories || []), newOption] });
                    } else if (sector === 'expedition') {
                      onUpdateSettings({ expeditionVehExpCategories: [...(appData.settings?.expeditionVehExpCategories || []), newOption] });
                    } else {
                      onUpdateSettings({ generalExpCategories: [...(appData.settings?.generalExpCategories || []), newOption] });
                    }
                  }
                }}
                onDeleteOption={(option) => {
                  if (onUpdateSettings) {
                    if (sector === 'lpg') {
                      onUpdateSettings({ lpgExpCategories: (appData.settings?.lpgExpCategories || []).filter(c => c !== option) });
                    } else if (sector === 'expedition') {
                      onUpdateSettings({ expeditionVehExpCategories: (appData.settings?.expeditionVehExpCategories || []).filter(c => c !== option) });
                    } else {
                      onUpdateSettings({ generalExpCategories: (appData.settings?.generalExpCategories || []).filter(c => c !== option) });
                    }
                  }
                }}
                isBbmCategory={sector === 'expedition' && category === 'BBM'}
              />

              {/* Form Khusus BBM */}
              {sector === 'expedition' && category === 'BBM' ? (
                <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-warning-text)' }}>
                      ⛽ Rincian Pengisian BBM:
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Liter BBM *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        placeholder="Contoh: 60"
                        value={fuelLiters}
                        onChange={(e) => setFuelLiters(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Harga per Liter (Rp) *</label>
                      <input
                        type="number"
                        min="1"
                        value={fuelPricePerLiter}
                        onChange={(e) => setFuelPricePerLiter(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Odometer (Km Mobil)</label>
                      <input
                        type="number"
                        placeholder="Contoh: 142500"
                        value={fuelOdometer}
                        onChange={(e) => setFuelOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Lokasi / SPBU</label>
                      <input
                        type="text"
                        placeholder="Contoh: SPBU 14.201 Amplas"
                        value={fuelLocation}
                        onChange={(e) => setFuelLocation(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Biaya BBM:</span>
                    <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-warning-text)' }}>
                      {formatRupiah((Number(fuelLiters) || 0) * (Number(fuelPricePerLiter) || 0))}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kuantitas / Jumlah</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Harga Satuan (Rp) *</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Contoh: 250000"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="form-input"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Description handled by ExpenseCategoryInput */}

              {/* Total Summary */}
              {!(sector === 'expedition' && category === 'BBM') && (
                <div
                  style={{
                    backgroundColor: 'var(--color-danger-light)',
                    border: '1px solid var(--color-danger-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-danger-text)' }}>Total Pengeluaran:</span>
                  <span className="font-mono" style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-danger)' }}>
                    {formatRupiah((Number(quantity) || 1) * (Number(unitPrice) || 0))}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="No kwitansi, nama toko / supir..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};
