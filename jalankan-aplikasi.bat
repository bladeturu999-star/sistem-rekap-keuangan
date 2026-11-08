@echo off
title KasPro
echo ==================================================
echo   Menjalankan KasPro (Manajemen Keuangan Usaha Offline)...
echo ==================================================
echo.
cd /d "%~dp0\dist"

REM Membuka browser yang mendukung fitur Pilih Folder (Chrome / Edge)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" http://localhost:3000
) else (
    start "" http://localhost:3000
)

echo Server aktif di: http://localhost:3000
echo (Browser Anda akan terbuka secara otomatis)
echo.
echo INFO FITUR PILIH FOLDER:
echo - Fitur 'Pilih Folder' langsung aktif di Google Chrome atau Microsoft Edge.
echo - Di browser Brave, fitur dinonaktifkan secara bawaan oleh Brave.
echo - Ekspor Excel tetap bisa dilakukan tanpa pilih folder (otomatis ke Downloads).
echo.
echo Biarkan jendela ini tetap terbuka selama menggunakan aplikasi.
echo Tekan tombol silang [X] atau Ctrl+C untuk menutup server.
echo.
python -m http.server 3000
