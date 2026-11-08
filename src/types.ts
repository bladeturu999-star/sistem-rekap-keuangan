export type DivisionMode = 'lpg' | 'expedition' | 'consolidation';

export type ActiveTab = 
  // Global / Legacy
  | 'dashboard'
  | 'monthly-recap'
  | 'reports'
  | 'expenses'
  | 'expense-categories'
  | 'data-manager'
  | 'settings'
  // Divisi LPG 3 Kg (Halaman Khusus)
  | 'lpg-dashboard'
  | 'lpg-sales'
  | 'lpg-customers'
  | 'lpg-expenses'
  | 'lpg-analytics'
  | 'lpg-reports'
  // Divisi Ekspedisi (Halaman Khusus)
  | 'expedition-dashboard'
  | 'expedition-trips'
  | 'expedition-vehicles'
  | 'expedition-expenses'
  | 'expedition-vehicle-recap'
  | 'expedition-analytics'
  | 'expedition-reports'
  // Konsolidasi Pusat
  | 'consolidation-dashboard'
  | 'consolidation-reports';


export type DateFilterType = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  pricePerUnit: number; // Harga khusus per tabung LPG
  status: 'active' | 'inactive';
  notes: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string; // Truk Colt Diesel, Tronton, Fuso, Pickup, dll.
  vehicleName: string;
  defaultDriver: string;
  ratePerKg: number;   // Tarif dasar per Kg (Rp/Kg)
  ratePerKm?: number;  // Kompatibilitas legacy
  status: 'active' | 'maintenance' | 'inactive';
  notes: string;
  createdAt: string;
}

export interface LpgTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  customerName: string; // Snapshot nama pelanggan
  quantity: number;     // Jumlah tabung
  pricePerUnit: number; // Snapshot harga per tabung saat transaksi
  total: number;        // quantity * pricePerUnit
  productType?: string; // LPG 3 Kg, Bright Gas 5.5 Kg, 12 Kg, 50 Kg, atau custom
  paymentStatus?: string; // Tunai (Cash), Transfer Bank / QRIS, Bon / Tempo
  notes: string;
  createdAt: string;
}

export interface ExpeditionTrip {
  id: string;
  date: string; // YYYY-MM-DD
  vehicleId: string;
  plateNumber: string;  // Snapshot nomor plat
  driver: string;
  destination: string;
  weightKg: number;     // Berat muatan dalam Kg
  ratePerKg: number;    // Biaya / tarif per Kg (Rp/Kg)
  travelAllowance?: number; // Uang jalan (Rp) yang mengurangi pendapatan rit
  distanceKm?: number;  // Jarak tempuh dalam Km (opsional / info rute)
  ratePerKm?: number;   // Kompatibilitas legacy
  tonnage?: number;     // Kompatibilitas legacy
  totalRevenue: number; // (weightKg * ratePerKg) - (travelAllowance || 0)
  cargoNotes: string;   // Catatan muatan (jenis kargo, no PO/SPB)
  createdAt: string;
}

export type ExpenseSector = 'lpg' | 'expedition' | 'general';

export interface FuelDetails {
  fuelType: string;     // Solar, Dexlite, Pertalite, dll.
  liters: number;
  pricePerLiter: number;
  odometer?: number;    // Km saat isi BBM
  location?: string;    // SPBU
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  sector: ExpenseSector;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;        // quantity * unitPrice
  allocationType: 'vehicle' | 'general';
  targetPlate?: string; // Plat kendaraan jika terkait armada
  fuelDetails?: FuelDetails;
  notes: string;
  createdAt: string;
}

export interface CustomCategory {
  id: string;
  sector: ExpenseSector;
  name: string;
}

export interface CompanySettings {
  companyName: string;
  ownerName?: string;
  phone: string;
  address: string;
  logo?: string;
  currency: string;
  isSetupComplete?: boolean;
  customCategories: CustomCategory[];
  lpgProducts?: string[];
  lpgPaymentMethods?: string[];
  expeditionRoutes?: string[];
  expeditionVehTypes?: string[];
  expeditionVehExpCategories?: string[];
  expeditionDrivers?: string[];
  generalExpCategories?: string[];
  lpgExpCategories?: string[];
}

export interface AppMetadata {
  appName: string;
  version: string;
  lastSaved: string;
  companyName: string;
}

export interface AppData {
  metadata: AppMetadata;
  settings: CompanySettings;
  customers: Customer[];
  vehicles: Vehicle[];
  lpgTransactions: LpgTransaction[];
  expeditionTrips: ExpeditionTrip[];
  expenses: Expense[];
}

// Financial Summary Struct
export interface FinancialSummary {
  totalRevenue: number;
  lpgRevenue: number;
  expeditionRevenue: number;
  totalExpenses: number;
  lpgExpenses: number;
  expeditionExpenses: number;
  generalExpenses: number;
  netProfit: number;
  totalLpgCylinders: number;
  totalLpgTransactions: number;
  totalTrips: number;
  totalDistanceKm: number;
  totalWeightKg: number;
  totalTonnage?: number;
}
