# Panduan Menghasilkan File .APK (Sistem Rekap Keuangan Offline)

Folder ini (`android/`) berisi proyek native Android lengkap yang membungkus aplikasi **Sistem Rekap Keuangan** secara 100% offline menggunakan **Android WebView + WebViewAssetLoader**.

---

## 🚀 3 Cara Menghasilkan File .APK:

### CARA 1: Build Otomatis di Cloud via GitHub Actions (Sangat Mudah & Gratis)
*Anda tidak perlu menginstal Android Studio atau Java di laptop Anda!*

Workflow CI (`.github/workflows/build-android.yml`) sudah tersedia di proyek. Alur automatis:
build web (Vite) → sinkronisasi `dist` ke aset Android → build release APK.

1. Buat repositori baru di akun [GitHub](https://github.com) Anda (bisa disetel ke **Private**).
2. Upload semua file dari folder proyek ini ke repositori tersebut.
3. Di halaman repositori GitHub Anda, klik tab **Actions**.
4. Workflow **Build Android APK** akan berjalan otomatis (atau Anda bisa klik **Run workflow**).
5. Tunggu sekitar 2–3 menit sampai selesai (muncul centang hijau ✅).
6. Klik pada hasil build tersebut, dan di bagian bawah (**Artifacts**) Anda bisa langsung mengunduh file **`Sistem-Rekap-Keuangan-APK.zip`** yang berisi file `.apk` siap pasang di HP Android!

---

### CARA 2: Build Menggunakan Android Studio di Komputer
Jika Anda atau rekan Anda memiliki **Android Studio**:

1. Buka aplikasi **Android Studio**.
2. Klik **File** > **Open...**
3. Arahkan dan pilih folder:
   `c:\Users\ASUS\Downloads\Sistem Rekap Keuangan-20260928T104914Z-1-001\Sistem Rekap Keuangan\android`
4. Tunggu proses *Gradle Sync* selesai (sekitar 1-2 menit saat pertama kali dibuka).
5. Pada menu atas, klik:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
6. Saat muncul notifikasi *APK(s) generated successfully*, klik **locate**.
7. File APK Anda berada di:
   `android/app/build/outputs/apk/debug/app-debug.apk`
8. Kirim file `.apk` tersebut ke HP Android Anda (bisa lewat WhatsApp, Bluetooth, atau kabel data), lalu install!

---

### CARA 3: Generate APK via PWABuilder (Online 1-Klik)
Aplikasi ini sudah dilengkapi dengan `manifest.json` dan `sw.js` (PWA Offline):

1. Upload folder `dist` ke hosting web gratis (misalnya Vercel, Netlify, atau GitHub Pages).
2. Buka situs [https://www.pwabuilder.com](https://www.pwabuilder.com).
3. Masukkan URL website Anda, lalu klik **Start**.
4. Klik **Package for Android** > **Download Package / APK**.
5. File APK siap digunakan!

---

## 📱 Fitur Khusus pada Aplikasi Android Ini:
- **100% Offline**: Semua aset HTML/CSS/JS dibundle di dalam APK (`android_asset`). Aplikasi berjalan tanpa koneksi internet sama sekali.
- **Ekspor Excel Langsung ke Folder Download HP**: Saat Anda klik ekspor laporan, aplikasi native Android akan otomatis menyimpan file `.xlsx` ke folder **Download** HP dan langsung memunculkan menu berbagi (*Share*) ke WhatsApp / Drive.
- **Tombol Back Alami**: Menekan tombol kembali di HP akan menavigasi halaman dengan mulus.
