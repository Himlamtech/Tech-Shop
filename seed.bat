@echo off
setlocal
chcp 65001 >nul 2>&1
title Lamania TechShop - Seed Data

echo.
echo  =====================================================
echo    LAMANIA TECHSHOP - SEED DATA
echo  =====================================================
echo.

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [LOI] Docker chua chay.
    pause
    exit /b 1
)

if not exist "docker-compose.yml" (
    echo  [LOI] Chay script nay tu thu muc goc du an.
    pause
    exit /b 1
)

echo  Dang seed 60 san pham vao catalog...
docker compose exec -T catalog-service python manage.py seed_products --source showroom
if %ERRORLEVEL% equ 0 (
    echo.
    echo  [OK] Seed thanh cong!
) else (
    echo.
    echo  [LOI] Seed that bai. Kiem tra container: docker compose ps
)

echo.
pause
endlocal
