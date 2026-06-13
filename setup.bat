@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Lamania TechShop - Setup

echo.
echo  =====================================================
echo    LAMANIA TECHSHOP - SETUP TU DONG
echo    Phien ban 1.0  ^|  PTIT 2025
echo  =====================================================
echo.

:: ─────────────────────────────────────────────
:: 1. Kiem tra Docker
:: ─────────────────────────────────────────────
echo [1/7] Kiem tra Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [LOI] Docker Desktop chua chay hoac chua cai dat.
    echo  Vui long:
    echo    1. Tai va cai Docker Desktop: https://www.docker.com/products/docker-desktop
    echo    2. Khoi dong Docker Desktop
    echo    3. Chay lai file nay
    echo.
    pause
    exit /b 1
)
echo  [OK] Docker dang chay.

docker compose version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [LOI] Docker Compose khong tim thay. Hay cap nhat Docker Desktop.
    pause
    exit /b 1
)
echo  [OK] Docker Compose san sang.

:: ─────────────────────────────────────────────
:: 2. Kiem tra vi tri chay script
:: ─────────────────────────────────────────────
echo.
echo [2/7] Kiem tra thu muc du an...
if not exist "docker-compose.yml" (
    echo  [LOI] Khong tim thay docker-compose.yml
    echo  Hay chay script nay tu thu muc goc du an.
    echo  Vi du: cd C:\techshop ^&^& setup.bat
    pause
    exit /b 1
)
echo  [OK] Dang chay tu: %CD%

:: ─────────────────────────────────────────────
:: 3. Tao file .env
:: ─────────────────────────────────────────────
echo.
echo [3/7] Tao file .env...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [OK] Tao .env tu .env.example
        echo.
        echo  *** LUU Y: Mo file .env de dien cac gia tri thuc te ***
        echo      - GEMINI_API_KEY (de dung AI Chat that, lay tai: https://aistudio.google.com)
        echo      - Firebase credentials (neu can xac thuc)
        echo      - Cac gia tri khac giu mac dinh la duoc
        echo.
    ) else (
        echo  [LOI] Khong tim thay .env.example. Vui long kiem tra lai thu muc du an.
        pause
        exit /b 1
    )
) else (
    echo  [OK] File .env da ton tai, bo qua.
)

:: ─────────────────────────────────────────────
:: 4. Tao JWT keys
:: ─────────────────────────────────────────────
echo.
echo [4/7] Tao JWT RSA Keys...
if not exist "keys" mkdir keys

if not exist "keys\jwt_private.pem" (
    echo  Dang tao RSA 2048-bit key pair...
    docker run --rm -v "%CD%\keys:/keys" alpine/openssl genrsa -out /keys/jwt_private.pem 2048 >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo  [CANH BAO] alpine/openssl that bai, thu voi openssl tren may...
        openssl genrsa -out keys\jwt_private.pem 2048 >nul 2>&1
        if %ERRORLEVEL% neq 0 (
            echo  [CANH BAO] Khong tao duoc key. Se thu tao bang Python...
            python -c "from cryptography.hazmat.primitives.asymmetric import rsa; from cryptography.hazmat.primitives import serialization; key = rsa.generate_private_key(public_exponent=65537, key_size=2048); open('keys/jwt_private.pem','wb').write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))" >nul 2>&1
            if %ERRORLEVEL% neq 0 (
                echo  [INFO] Bo qua tao key - services se dung key mac dinh neu co.
                goto :skip_pubkey
            )
        )
    )
    echo  [OK] jwt_private.pem da tao.
) else (
    echo  [OK] jwt_private.pem da ton tai.
)

if not exist "keys\jwt_public.pem" (
    docker run --rm -v "%CD%\keys:/keys" alpine/openssl rsa -in /keys/jwt_private.pem -pubout -out /keys/jwt_public.pem >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        openssl rsa -in keys\jwt_private.pem -pubout -out keys\jwt_public.pem >nul 2>&1
    )
    if exist "keys\jwt_public.pem" (
        echo  [OK] jwt_public.pem da tao.
    ) else (
        echo  [CANH BAO] Khong tao duoc public key.
    )
) else (
    echo  [OK] jwt_public.pem da ton tai.
)
:skip_pubkey

:: ─────────────────────────────────────────────
:: 5. Build va khoi dong services
:: ─────────────────────────────────────────────
echo.
echo [5/7] Build va khoi dong tat ca services...
echo  (Lan dau co the mat 5-15 phut de build images)
echo.
docker compose up -d --build
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [LOI] docker compose up that bai.
    echo  Xem chi tiet: docker compose logs
    pause
    exit /b 1
)
echo.
echo  [OK] Tat ca containers da khoi dong.

:: ─────────────────────────────────────────────
:: 6. Doi services san sang (healthy)
:: ─────────────────────────────────────────────
echo.
echo [6/7] Doi tat ca services san sang...
echo  (Toi da 3 phut)

set MAX_WAIT=180
set WAITED=0
set READY=0

:wait_loop
timeout /t 5 /nobreak >nul
set /a WAITED+=5

:: Kiem tra catalog-service (service quan trong nhat)
docker inspect --format="{{.State.Health.Status}}" techshop-catalog-service-1 2>nul | findstr "healthy" >nul
if %ERRORLEVEL% equ 0 (
    docker inspect --format="{{.State.Health.Status}}" techshop-identity-service-1 2>nul | findstr "healthy" >nul
    if %ERRORLEVEL% equ 0 (
        set READY=1
        goto :services_ready
    )
)

set /a REMAINING=MAX_WAIT-WAITED
echo  Dang cho... (con lai ~!REMAINING!s)

if !WAITED! geq !MAX_WAIT! (
    echo  [CANH BAO] Timeout - mot so services co the chua san sang.
    echo  Kiem tra trang thai: docker compose ps
    goto :services_ready
)
goto :wait_loop

:services_ready
echo  [OK] Services da san sang sau ~%WAITED% giay.

:: ─────────────────────────────────────────────
:: 7. Chay migrations va seed data
:: ─────────────────────────────────────────────
echo.
echo [7/7] Chay migrations va seed data...
echo.

echo  --- Catalog Service: migration ---
docker compose exec -T catalog-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] catalog migrate) else (echo  [CANH BAO] catalog migrate co loi)

echo  --- Identity Service: migration ---
docker compose exec -T identity-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] identity migrate) else (echo  [CANH BAO] identity migrate co loi)

echo  --- Cart Service: migration ---
docker compose exec -T cart-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] cart migrate) else (echo  [CANH BAO] cart migrate co loi)

echo  --- Order Service: migration ---
docker compose exec -T order-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] order migrate) else (echo  [CANH BAO] order migrate co loi)

echo  --- Payment Service: migration ---
docker compose exec -T payment-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] payment migrate) else (echo  [CANH BAO] payment migrate co loi)

echo  --- Shipping Service: migration ---
docker compose exec -T shipping-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] shipping migrate) else (echo  [CANH BAO] shipping migrate co loi)

echo  --- Review Service: migration ---
docker compose exec -T review-service python manage.py migrate --noinput >nul 2>&1
if %ERRORLEVEL% equ 0 (echo  [OK] review migrate) else (echo  [CANH BAO] review migrate co loi)

echo.
echo  --- Seed 60 san pham vao Catalog ---
docker compose exec -T catalog-service python manage.py seed_products --source showroom
if %ERRORLEVEL% equ 0 (
    echo  [OK] Seed san pham thanh cong!
) else (
    echo  [CANH BAO] Seed that bai. Chay lai bang: seed.bat
)

:: ─────────────────────────────────────────────
:: Hoan thanh
:: ─────────────────────────────────────────────
echo.
echo  =====================================================
echo   SETUP HOAN TAT!
echo  =====================================================
echo.

:: Lay cong tu .env
set PORT=1912
for /f "tokens=2 delims==" %%a in ('findstr "GATEWAY_PORT" .env 2^>nul') do set PORT=%%a
if "%PORT%"=="" set PORT=1912

echo   Truy cap website: http://localhost:%PORT%
echo.
echo   Lenh huu ich:
echo     docker compose ps          - Xem trang thai services
echo     docker compose logs -f     - Xem logs realtime
echo     docker compose down        - Tat tat ca services
echo     seed.bat                   - Seed lai data
echo.
echo   Tai khoan admin mac dinh: xem README.md
echo.

:: Mo trinh duyet tu dong
set /p OPEN_BROWSER=  Mo trinh duyet ngay bay gio? (Y/N):
if /i "%OPEN_BROWSER%"=="Y" (
    start http://localhost:%PORT%
)

echo.
pause
endlocal
