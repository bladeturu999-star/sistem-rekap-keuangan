import type { AppData } from '../types';

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, '0');

const cY = currentYear;
const cM = currentMonth;


export const initialData: AppData = {
  metadata: {
    appName: 'KasPro',
    version: '1.0.0',
    lastSaved: `${cY}-${cM}-01T00:00:00.000Z`,
    companyName: 'Perusahaan Saya',
  },
  settings: {
    companyName: 'Perusahaan Saya',
    ownerName: '',
    phone: '',
    address: '',
    logo: '',
    currency: 'IDR',
    isSetupComplete: false,
    lpgProducts: [],
    lpgPaymentMethods: [],
    expeditionRoutes: [],
    expeditionVehTypes: [],
    expeditionVehExpCategories: [],
    expeditionDrivers: [],
    generalExpCategories: [],
    customCategories: [],
  },
  customers: [],
  vehicles: [],
  lpgTransactions: [],
  expeditionTrips: [],
  expenses: [],
};
