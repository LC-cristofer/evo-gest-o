# ============================================================
# ONG Sistema - Script de Backup Automático
# Windows Server - Agendador de Tarefas
# 
# Configuração: Agendar para rodar diariamente às 02:00
# Agendador de Tarefas > Nova Tarefa > Ação: powershell.exe
# Argumentos: -ExecutionPolicy Bypass -File "C:\ong\backup.ps1"
# ============================================================

param(
    [string]$DbName      = $env:DB_NAME -or "ong_sistema",
    [string]$DbUser      = $env:DB_USER -or "postgres",
    [string]$DbHost      = $env:DB_HOST -or "localhost",
    [string]$DbPort      = $env:DB_PORT -or "5432",
    [string]$BackupDir   = "C:\ong\backups",
    [string]$UploadsDir  = "C:\ong\backend\uploads",
    [int]   $KeepDays    = 30   # Mantém backups dos últimos 30 dias
)

# ─── Funções de log ───────────────────────────────────────────

$LogFile = Join-Path $BackupDir "backup-log.txt"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

# ─── Inicialização ────────────────────────────────────────────

$date     = Get-Date -Format "yyyy-MM-dd"
$datetime = Get-Date -Format "yyyy-MM-dd_HH-mm"

# Cria diretório de backup se não existir
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Log "=== INÍCIO DO BACKUP - $datetime ==="

# ─── 1. Backup do banco de dados (pg_dump) ────────────────────

$DbBackupDir  = Join-Path $BackupDir "database"
$DbBackupFile = Join-Path $DbBackupDir "ong_sistema_$datetime.sql"

if (-not (Test-Path $DbBackupDir)) {
    New-Item -ItemType Directory -Path $DbBackupDir -Force | Out-Null
}

Write-Log "Iniciando backup do banco de dados..."

# Configura senha temporariamente via variável de ambiente
$env:PGPASSWORD = $env:DB_PASS

try {
    $pgDumpPath = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
    
    if (-not (Test-Path $pgDumpPath)) {
        # Tenta encontrar em versões alternativas
        $pgDumpPath = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter "pg_dump.exe" -Recurse -ErrorAction SilentlyContinue |
                      Sort-Object LastWriteTime -Descending |
                      Select-Object -First 1 -ExpandProperty FullName
    }

    if ($pgDumpPath) {
        & $pgDumpPath `
            --host=$DbHost `
            --port=$DbPort `
            --username=$DbUser `
            --dbname=$DbName `
            --format=plain `
            --no-password `
            --file=$DbBackupFile 2>&1

        if ($LASTEXITCODE -eq 0) {
            # Comprime o backup
            Compress-Archive -Path $DbBackupFile -DestinationPath "$DbBackupFile.zip" -Force
            Remove-Item $DbBackupFile -Force
            $fileSize = [math]::Round((Get-Item "$DbBackupFile.zip").Length / 1MB, 2)
            Write-Log "Banco de dados: OK ($fileSize MB) -> $DbBackupFile.zip"
        } else {
            Write-Log "ERRO no backup do banco de dados! Exit code: $LASTEXITCODE" "ERROR"
        }
    } else {
        Write-Log "pg_dump não encontrado! Verifique a instalação do PostgreSQL." "ERROR"
    }
} catch {
    Write-Log "Exceção no backup do banco: $_" "ERROR"
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# ─── 2. Backup dos uploads (documentos) ──────────────────────

$UploadsBackupDir  = Join-Path $BackupDir "uploads"
$UploadsBackupFile = Join-Path $UploadsBackupDir "uploads_$datetime.zip"

if (-not (Test-Path $UploadsBackupDir)) {
    New-Item -ItemType Directory -Path $UploadsBackupDir -Force | Out-Null
}

if (Test-Path $UploadsDir) {
    Write-Log "Iniciando backup dos uploads..."
    try {
        Compress-Archive -Path "$UploadsDir\*" -DestinationPath $UploadsBackupFile -Force
        $fileSize = [math]::Round((Get-Item $UploadsBackupFile).Length / 1MB, 2)
        Write-Log "Uploads: OK ($fileSize MB) -> $UploadsBackupFile"
    } catch {
        Write-Log "Erro no backup de uploads: $_" "ERROR"
    }
} else {
    Write-Log "Diretório de uploads não encontrado: $UploadsDir" "WARN"
}

# ─── 3. Rotação: remove backups antigos ──────────────────────

Write-Log "Removendo backups com mais de $KeepDays dias..."

$cutoffDate = (Get-Date).AddDays(-$KeepDays)

foreach ($dir in @($DbBackupDir, $UploadsBackupDir)) {
    if (Test-Path $dir) {
        $removed = 0
        Get-ChildItem $dir -File | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
            Remove-Item $_.FullName -Force
            $removed++
        }
        if ($removed -gt 0) {
            Write-Log "Removidos $removed arquivo(s) antigo(s) de $dir"
        }
    }
}

# ─── 4. Verifica espaço em disco ─────────────────────────────

$drive     = Split-Path -Qualifier $BackupDir
$disk      = Get-PSDrive -Name $drive.TrimEnd(':')
$freeGB    = [math]::Round($disk.Free / 1GB, 1)
$usedGB    = [math]::Round($disk.Used / 1GB, 1)
$totalGB   = [math]::Round(($disk.Free + $disk.Used) / 1GB, 1)
$usedPct   = [math]::Round($disk.Used / ($disk.Free + $disk.Used) * 100, 0)

Write-Log "Espaço em disco ($drive): $freeGB GB livres de $totalGB GB ($usedPct% usado)"

if ($usedPct -gt 85) {
    Write-Log "AVISO: Disco com mais de 85% de uso!" "WARN"
}

# ─── 5. Relatório final ───────────────────────────────────────

$dbFile = Get-ChildItem $DbBackupDir -Filter "*$datetime*" -ErrorAction SilentlyContinue
$success = ($null -ne $dbFile)

Write-Log "=== FIM DO BACKUP - Status: $( if ($success) { 'SUCESSO' } else { 'COM ERROS' } ) ==="
Write-Log ""

# Retorna código de saída para o Agendador de Tarefas
exit $(if ($success) { 0 } else { 1 })
