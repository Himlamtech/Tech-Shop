#Requires -Version 5.1
<#
.SYNOPSIS
    Lamania TechShop - Script cài đặt tự động cho Windows
.DESCRIPTION
    Tự động: kiểm tra môi trường, tạo JWT keys, build Docker, migrate, seed data.
    Chạy: Right-click -> "Run with PowerShell"  HOẶC  powershell -ExecutionPolicy Bypass -File setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ─── Màu sắc ───────────────────────────────────────────────────────────────
function Write-Header($text) {
    Write-Host "`n  $text" -ForegroundColor Cyan
}
function Write-Step($n, $total, $text) {
    Write-Host "`n[$n/$total] " -ForegroundColor DarkGray -NoNewline
    Write-Host $text -ForegroundColor White
}
function Write-Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  [CANH BAO] $text" -ForegroundColor Yellow }
function Write-Fail($text) { Write-Host "  [LOI] $text" -ForegroundColor Red }
function Write-Info($text) { Write-Host "  $text" -ForegroundColor Gray }

# ─── Banner ────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     LAMANIA TECHSHOP — CÀI ĐẶT TỰ ĐỘNG             ║" -ForegroundColor Cyan
Write-Host "  ║     Phiên bản 1.0  |  PTIT 2025                     ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$TOTAL_STEPS = 7

# ─── Step 1: Kiểm tra Docker ────────────────────────────────────────────────
Write-Step 1 $TOTAL_STEPS "Kiểm tra Docker Desktop..."

try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker không phản hồi" }
    Write-Ok "Docker Desktop đang chạy."
} catch {
    Write-Fail "Docker Desktop chưa chạy hoặc chưa cài đặt."
    Write-Host ""
    Write-Host "  Vui lòng:" -ForegroundColor Yellow
    Write-Host "  1. Tải Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Write-Host "  2. Cài đặt và khởi động Docker Desktop" -ForegroundColor Yellow
    Write-Host "  3. Chạy lại script này" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Nhấn Enter để thoát"
    exit 1
}

try {
    $null = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose không tìm thấy" }
    Write-Ok "Docker Compose sẵn sàng."
} catch {
    Write-Fail "Docker Compose không tìm thấy. Hãy cập nhật Docker Desktop."
    Read-Host "Nhấn Enter để thoát"
    exit 1
}

# ─── Step 2: Kiểm tra thư mục ───────────────────────────────────────────────
Write-Step 2 $TOTAL_STEPS "Kiểm tra thư mục dự án..."

if (-not (Test-Path "docker-compose.yml")) {
    Write-Fail "Không tìm thấy docker-compose.yml trong thư mục hiện tại."
    Write-Info "Hãy chạy script từ thư mục gốc dự án."
    Write-Info "Ví dụ: cd C:\techshop  rồi  .\setup.ps1"
    Read-Host "Nhấn Enter để thoát"
    exit 1
}
Write-Ok "Đang chạy từ: $(Get-Location)"

# ─── Step 3: Tạo file .env ─────────────────────────────────────────────────
Write-Step 3 $TOTAL_STEPS "Tạo file .env..."

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Ok "Tạo .env từ .env.example"
        Write-Host ""
        Write-Host "  ┌─────────────────────────────────────────────────────┐" -ForegroundColor Yellow
        Write-Host "  │  LƯU Ý: Mở file .env để cấu hình các giá trị:      │" -ForegroundColor Yellow
        Write-Host "  │  • GEMINI_API_KEY  → AI Chat thực (bắt buộc để AI  │" -ForegroundColor Yellow
        Write-Host "  │    hoạt động thật, lấy tại aistudio.google.com)     │" -ForegroundColor Yellow
        Write-Host "  │  • Firebase keys   → Đăng nhập Google/Phone         │" -ForegroundColor Yellow
        Write-Host "  │  • Các DB password mặc định là 'techshop' (OK dev)  │" -ForegroundColor Yellow
        Write-Host "  └─────────────────────────────────────────────────────┘" -ForegroundColor Yellow
        Write-Host ""

        $editEnv = Read-Host "  Mở file .env ngay bây giờ để chỉnh sửa? (Y/N)"
        if ($editEnv -ieq "Y") {
            Start-Process notepad ".env" -Wait
        }
    } else {
        Write-Fail "Không tìm thấy .env.example. Kiểm tra lại thư mục dự án."
        Read-Host "Nhấn Enter để thoát"
        exit 1
    }
} else {
    Write-Ok "File .env đã tồn tại, bỏ qua."
}

# ─── Step 4: Tạo JWT RSA Keys ───────────────────────────────────────────────
Write-Step 4 $TOTAL_STEPS "Tạo JWT RSA Keys..."

if (-not (Test-Path "keys")) {
    New-Item -ItemType Directory -Path "keys" | Out-Null
}

$privateKey = "keys\jwt_private.pem"
$publicKey  = "keys\jwt_public.pem"

if (-not (Test-Path $privateKey)) {
    Write-Info "Đang tạo RSA 2048-bit private key..."

    # Thử với Docker (không cần openssl cài sẵn)
    $dockerKeyResult = docker run --rm -v "${PWD}\keys:/keys" alpine/openssl genrsa -out /keys/jwt_private.pem 2048 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "jwt_private.pem đã tạo (via Docker)."
    } else {
        # Thử openssl cài sẵn
        try {
            openssl genrsa -out $privateKey 2048 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "jwt_private.pem đã tạo (via openssl)."
            } else { throw "openssl không hoạt động" }
        } catch {
            # Thử Python
            try {
                $pyScript = @"
try:
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with open('keys/jwt_private.pem','wb') as f:
        f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    print('OK')
except ImportError:
    print('NO_CRYPTOGRAPHY')
"@
                $result = python -c $pyScript 2>&1
                if ($result -eq "OK") {
                    Write-Ok "jwt_private.pem đã tạo (via Python)."
                } else {
                    Write-Warn "Không thể tạo JWT key tự động."
                    Write-Info "Services sẽ dùng key mặc định nếu có, hoặc có thể lỗi auth."
                    Write-Info "Cài openssl và chạy lại, hoặc tự tạo key thủ công."
                }
            } catch {
                Write-Warn "Bỏ qua tạo JWT key."
            }
        }
    }
} else {
    Write-Ok "jwt_private.pem đã tồn tại."
}

if ((Test-Path $privateKey) -and (-not (Test-Path $publicKey))) {
    $pubResult = docker run --rm -v "${PWD}\keys:/keys" alpine/openssl rsa -in /keys/jwt_private.pem -pubout -out /keys/jwt_public.pem 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "jwt_public.pem đã tạo."
    } else {
        try {
            openssl rsa -in $privateKey -pubout -out $publicKey 2>&1 | Out-Null
            if (Test-Path $publicKey) { Write-Ok "jwt_public.pem đã tạo." }
        } catch {
            Write-Warn "Không tạo được public key."
        }
    }
} elseif (Test-Path $publicKey) {
    Write-Ok "jwt_public.pem đã tồn tại."
}

# ─── Step 5: Build + Khởi động ─────────────────────────────────────────────
Write-Step 5 $TOTAL_STEPS "Build và khởi động tất cả services..."
Write-Info "(Lần đầu có thể mất 10-20 phút để build images)"
Write-Host ""

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up thất bại."
    Write-Info "Xem chi tiết: docker compose logs"
    Read-Host "Nhấn Enter để thoát"
    exit 1
}
Write-Ok "Tất cả containers đã khởi động."

# ─── Step 6: Chờ services healthy ──────────────────────────────────────────
Write-Step 6 $TOTAL_STEPS "Chờ services sẵn sàng (tối đa 3 phút)..."
Write-Host ""

$maxWait = 180
$waited  = 0
$ready   = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 5
    $waited += 5

    $catalogStatus = docker inspect --format="{{.State.Health.Status}}" techshop-catalog-service-1 2>$null
    $identityStatus = docker inspect --format="{{.State.Health.Status}}" techshop-identity-service-1 2>$null

    if ($catalogStatus -eq "healthy" -and $identityStatus -eq "healthy") {
        $ready = $true
        break
    }

    $remaining = $maxWait - $waited
    Write-Host "  Đang chờ... (còn ~${remaining}s | catalog: $catalogStatus | identity: $identityStatus)" -ForegroundColor DarkGray
}

if ($ready) {
    Write-Ok "Services sẵn sàng sau ~${waited} giây."
} else {
    Write-Warn "Timeout - một số service có thể chưa ready. Tiếp tục..."
    docker compose ps
}

# ─── Step 7: Migrations + Seed ─────────────────────────────────────────────
Write-Step 7 $TOTAL_STEPS "Chạy migrations và seed data..."
Write-Host ""

$services = @(
    @{ name = "catalog-service";  container = "catalog-service" },
    @{ name = "identity-service"; container = "identity-service" },
    @{ name = "cart-service";     container = "cart-service" },
    @{ name = "order-service";    container = "order-service" },
    @{ name = "payment-service";  container = "payment-service" },
    @{ name = "shipping-service"; container = "shipping-service" },
    @{ name = "review-service";   container = "review-service" }
)

foreach ($svc in $services) {
    Write-Host "  Migration: $($svc.name)..." -ForegroundColor DarkGray -NoNewline
    docker compose exec -T $svc.container python manage.py migrate --noinput 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " CANH BAO" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  Đang seed 60 sản phẩm vào catalog..." -ForegroundColor DarkGray
docker compose exec -T catalog-service python manage.py seed_products --source showroom
if ($LASTEXITCODE -eq 0) {
    Write-Ok "Seed sản phẩm thành công! (60 sản phẩm, 9 danh mục)"
} else {
    Write-Warn "Seed thất bại. Chạy lại bằng: .\seed.bat"
}

# ─── Hoàn thành ─────────────────────────────────────────────────────────────
# Lấy port từ .env
$port = "1912"
$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
foreach ($line in $envContent) {
    if ($line -match "^GATEWAY_PORT=(.+)$") {
        $port = $Matches[1].Trim()
    }
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║         SETUP HOÀN TẤT THÀNH CÔNG!                  ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 Truy cập website: " -NoNewline -ForegroundColor White
Write-Host "http://localhost:$port" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Lệnh hữu ích:" -ForegroundColor White
Write-Host "    docker compose ps           " -NoNewline -ForegroundColor DarkGray
Write-Host "Xem trạng thái services" -ForegroundColor Gray
Write-Host "    docker compose logs -f      " -NoNewline -ForegroundColor DarkGray
Write-Host "Xem logs realtime" -ForegroundColor Gray
Write-Host "    docker compose down         " -NoNewline -ForegroundColor DarkGray
Write-Host "Tắt tất cả services" -ForegroundColor Gray
Write-Host "    docker compose up -d        " -NoNewline -ForegroundColor DarkGray
Write-Host "Khởi động lại (không build lại)" -ForegroundColor Gray
Write-Host "    .\seed.bat                  " -NoNewline -ForegroundColor DarkGray
Write-Host "Seed lại data" -ForegroundColor Gray
Write-Host ""

$openBrowser = Read-Host "  Mở trình duyệt ngay bây giờ? (Y/N)"
if ($openBrowser -ieq "Y") {
    Start-Process "http://localhost:$port"
}

Write-Host ""
Read-Host "Nhấn Enter để thoát"
