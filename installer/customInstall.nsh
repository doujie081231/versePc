Var DATA_BACKUP_PATH
Var CONFIG_BACKUP_PATH

; =============================================================================
; 方案 A：把 data 目录和 data-config.json 备份到用户主目录($PROFILE)下
; 旧卸载器执行 RMDir /r $INSTDIR 或 atomicRMDir 时，备份在 $PROFILE 下，不受影响
; 用 $PROFILE 而非 $TEMP：$TEMP 可能被系统磁盘清理工具清掉，$PROFILE 不会，更可靠
; =============================================================================
!macro BackupUserDataToTemp
    ; 备份 data 目录到 $PROFILE\versepc-data-backup
    ; 同盘符用 Rename（瞬间完成，不占额外空间），跨盘符用 xcopy
    StrCpy $DATA_BACKUP_PATH ""
    IfFileExists "$INSTDIR\data\*.*" 0 _no_data_backup
        StrCpy $0 "$PROFILE\versepc-data-backup"
        ; 如果上次安装失败残留了备份目录，先清理
        IfFileExists "$0\*.*" 0 +2
            RMDir /r "$0"

        ; 尝试 Rename（同盘符瞬间完成，跨盘符会失败）
        Rename "$INSTDIR\data" "$0"
        IfFileExists "$0\*.*" 0 _backup_via_xcopy
            StrCpy $DATA_BACKUP_PATH "$0"
            DetailPrint "已移动用户数据目录到临时目录 (同盘符 Rename): $0"
            Goto _data_backup_done
        _backup_via_xcopy:
            ; 跨盘符：用 xcopy 复制
            CreateDirectory "$0"
            nsExec::ExecToLog `xcopy "$INSTDIR\data\*" "$0\" /E /I /Y /Q /C`
            Pop $1
            ${If} $1 == "0"
                StrCpy $DATA_BACKUP_PATH "$0"
                DetailPrint "已备份用户数据目录到临时目录 (跨盘符 xcopy): $0"
            ${Else}
                DetailPrint "警告：用户数据目录备份失败 (xcopy 代码 $1)"
                RMDir /r "$0"
                ; 数据备份失败时必须中止安装：旧卸载器会 RMDir /r $INSTDIR，
                ; 若放行会导致用户数据真实丢失。宁可中止让用户手动备份后重试。
                MessageBox MB_OK|MB_ICONSTOP "用户数据目录备份失败（xcopy 代码 $1）。$\n$\n为防止覆盖安装导致数据丢失，安装已中止。$\n$\n请手动备份安装目录下的 data 文件夹后重新运行安装程序。"
                Abort
            ${EndIf}
    _data_backup_done:
    _no_data_backup:

    ; 备份 data-config.json 到 $PROFILE\versepc-config-backup.json
    StrCpy $CONFIG_BACKUP_PATH ""
    IfFileExists "$INSTDIR\data-config.json" 0 _no_config_backup
        StrCpy $0 "$PROFILE\versepc-config-backup.json"
        ; 如果上次残留了配置备份，先删除
        IfFileExists "$0" 0 +2
            Delete "$0"
        CopyFiles /SILENT "$INSTDIR\data-config.json" "$0"
        IfFileExists "$0" 0 _config_backup_failed
            StrCpy $CONFIG_BACKUP_PATH "$0"
            DetailPrint "已备份数据目录配置到: $0"
            Goto _no_config_backup
        _config_backup_failed:
            DetailPrint "警告：数据目录配置备份失败"
            ; config 备份失败同样中止：放行后若旧卸载器删掉 data-config.json，
            ; 数据目录解析会回退，可能造成"数据回到 C 盘"。宁可中止让用户处理。
            MessageBox MB_OK|MB_ICONSTOP "数据目录配置(data-config.json)备份失败。$\n$\n为防止覆盖安装导致数据目录错乱，安装已中止。$\n$\n请手动备份安装目录下的 data-config.json 后重新运行安装程序。"
            Abort
    _no_config_backup:
!macroend

; =============================================================================
; 方案 A 恢复：从临时目录恢复 data 和 data-config.json
; =============================================================================
!macro RestoreUserDataFromTemp
    ; 恢复 data 目录
    StrCmp "$DATA_BACKUP_PATH" "" _no_data_restore 0
    IfFileExists "$DATA_BACKUP_PATH\*.*" 0 _no_data_restore
        ; 如果 data 目录已存在（旧卸载器 customRemoveFiles 已恢复，或 xcopy 备份未移动），
        ; 保留它，不删除——删除后若恢复失败会导致数据彻底丢失
        IfFileExists "$INSTDIR\data\*.*" 0 _do_restore_data
            DetailPrint "data 目录已存在（旧卸载器已恢复），跳过恢复"
            RMDir /r "$DATA_BACKUP_PATH"
            StrCpy $DATA_BACKUP_PATH ""
            Goto _no_data_restore
        _do_restore_data:
        ; data 目录不存在，从备份恢复
        Rename "$DATA_BACKUP_PATH" "$INSTDIR\data"
        IfFileExists "$INSTDIR\data\*.*" 0 _restore_via_xcopy
            DetailPrint "已从临时目录恢复用户数据 (同盘符 Rename)"
            StrCpy $DATA_BACKUP_PATH ""
            Goto _no_data_restore
        _restore_via_xcopy:
        nsExec::ExecToLog `xcopy "$DATA_BACKUP_PATH\*" "$INSTDIR\data\" /E /I /Y /Q /C`
        Pop $0
        ${If} $0 == "0"
            DetailPrint "已从临时目录恢复用户数据 (跨盘符 xcopy)"
            RMDir /r "$DATA_BACKUP_PATH"
            StrCpy $DATA_BACKUP_PATH ""
        ${Else}
            DetailPrint "警告：用户数据目录恢复失败 (xcopy 代码 $0)，数据仍在 $DATA_BACKUP_PATH"
        ${EndIf}
    _no_data_restore:

    ; 恢复 data-config.json
    StrCmp "$CONFIG_BACKUP_PATH" "" _no_config_restore 0
    IfFileExists "$CONFIG_BACKUP_PATH" 0 _no_config_restore
        ; 如果 data-config.json 已存在（旧卸载器已恢复），跳过
        IfFileExists "$INSTDIR\data-config.json" 0 _do_restore_config
            DetailPrint "data-config.json 已存在，跳过恢复"
            Delete "$CONFIG_BACKUP_PATH"
            StrCpy $CONFIG_BACKUP_PATH ""
            Goto _no_config_restore
        _do_restore_config:
        CopyFiles /SILENT "$CONFIG_BACKUP_PATH" "$INSTDIR\data-config.json"
        IfFileExists "$INSTDIR\data-config.json" 0 _config_restore_failed
            DetailPrint "已恢复数据目录配置"
            Delete "$CONFIG_BACKUP_PATH"
            StrCpy $CONFIG_BACKUP_PATH ""
            Goto _no_config_restore
        _config_restore_failed:
            DetailPrint "警告：数据目录配置恢复失败，文件仍在 $CONFIG_BACKUP_PATH"
    _no_config_restore:
!macroend

!macro customInit
    SetAutoClose false
    ; 使用 taskkill 替代 nsProcess 插件（nsProcess 不在 electron-builder 默认 NSIS 中）
    nsExec::ExecToStack 'taskkill /F /IM VersePC.exe /T'
    Sleep 500
    nsExec::ExecToStack 'taskkill /F /IM VersePC.exe /T'
    Sleep 300
    nsExec::ExecToStack 'taskkill /F /IM VersePC.exe /T'
    Sleep 300

    ; --- 数据目录配置（含迁移）---
    ; 必须在 BackupUserDataToTemp 之前执行：
    ; 迁移后的数据需要被备份保护，否则旧卸载器 RMDir /r 会删掉刚迁移的数据
    IfFileExists "$INSTDIR\data-config.json" _data_dir_done 0
    IfFileExists "$PROFILE\.versepc\*.*" 0 _setup_new_data_dir
        ; 老用户，C盘有数据
        MessageBox MB_YESNO|MB_ICONQUESTION "检测到 C 盘已有 VersePC 数据。$\n$\n是否将数据迁移到安装目录？$\n$\n选「是」：迁移数据到安装目录（推荐，数据跟软件走）$\n选「否」：继续使用 C 盘数据（保持现状）" IDYES _migrate_data IDNO _data_dir_done
    _migrate_data:
        DetailPrint "正在迁移数据到安装目录，请耐心等待..."
        CreateDirectory "$INSTDIR\data"
        nsExec::ExecToLog `xcopy "$PROFILE\.versepc\*" "$INSTDIR\data\" /E /I /Y /Q /C`
        Pop $0
        ${If} $0 == "0"
            DetailPrint "数据迁移成功，正在清理 C 盘旧数据..."
            RMDir /r "$PROFILE\.versepc"
            nsExec::ExecToLog `powershell -NoProfile -Command "[IO.File]::WriteAllText('$INSTDIR\data-config.json', (@{dataDir='$INSTDIR\data'} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $$false))"`
            DetailPrint "数据目录已设置为 $INSTDIR\data"
        ${Else}
            MessageBox MB_OK|MB_ICONEXCLAMATION "数据迁移失败（代码 $0），将继续使用 C 盘数据。$\n$\n你可以稍后在软件设置中手动修改数据目录。"
            RMDir /r "$INSTDIR\data"
        ${EndIf}
        Goto _data_dir_done
    _setup_new_data_dir:
        ; 新用户，数据放安装目录
        ; [P0 FIX - 2026-07-26] 跨目录覆盖安装保护：
        ; 若用户换了安装目录且旧目录下有 data，提示迁移以避免数据丢失
        ; 从注册表读取旧安装路径（electron-builder 卸载条目）
        StrCpy $3 ""
        ClearErrors
        ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.versepc.launcher" "InstallLocation"
        ${IfNot} ${Errors}
          StrCpy $3 "$1"
        ${Else}
          ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.versepc.launcher" "InstallLocation"
          ${IfNot} ${Errors}
            StrCpy $3 "$2"
          ${EndIf}
        ${EndIf}
        StrCmp $3 "" _create_new_data 0
        StrCmp $3 "$INSTDIR" _create_new_data 0
        IfFileExists "$3\data\*.*" 0 _create_new_data
            MessageBox MB_YESNO|MB_ICONEXCLAMATION "检测到旧安装目录「$3」中存有用户数据。$\n$\n您选择了不同的安装目录「$INSTDIR」，旧数据不会被自动迁移。$\n$\n选「是」返回重选目录，选「否」丢弃旧数据继续安装。" IDYES _abort_for_olddata IDNO _create_new_data
        _abort_for_olddata:
            Abort "用户取消安装以保留旧数据"
        _create_new_data:
        CreateDirectory "$INSTDIR\data"
        nsExec::ExecToLog `powershell -NoProfile -Command "[IO.File]::WriteAllText('$INSTDIR\data-config.json', (@{dataDir='$INSTDIR\data'} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $$false))"`
        DetailPrint "数据目录设置为 $INSTDIR\data"
    _data_dir_done:

    ; --- 覆盖安装数据保护（方案A：备份到安装目录外的临时目录）---
    ; 旧卸载器会执行 RMDir /r $INSTDIR，把整个安装目录连同 data 一起删掉。
    ; 把 data 和 data-config.json 备份到 $PROFILE 下，旧卸载器碰不到。
    ; 注意：此处在数据迁移之后执行，确保迁移后的数据也被备份保护。
    !insertmacro BackupUserDataToTemp

    ; --- VC++ 运行库自动检测与安装 ---
    IfFileExists "$SYSDIR\vcruntime140.dll" _vcpp_found _vcpp_missing
    _vcpp_missing:
        MessageBox MB_YESNO|MB_ICONQUESTION "检测到系统缺少 VC++ 运行库（Microsoft Visual C++ Redistributable）。$\n$\n这是运行 VersePC 的必要组件，是否现在自动安装？" IDYES _vcpp_install IDNO _vcpp_found
    _vcpp_install:
        DetailPrint "正在下载 VC++ 运行库..."
        NSISdl::download "https://aka.ms/vs/17/release/vc_redist.x64.exe" "$TEMP\vc_redist.x64.exe"
        Pop $0
        StrCmp $0 "success" _vcpp_download_ok _vcpp_download_fail
    _vcpp_download_fail:
        MessageBox MB_OK|MB_ICONEXCLAMATION "VC++ 运行库下载失败。$\n$\n请手动安装：https://aka.ms/vs/17/release/vc_redist.x64.exe$\n$\n安装将继续，但启动器可能无法正常运行。"
        Goto _vcpp_found
    _vcpp_download_ok:
        DetailPrint "正在安装 VC++ 运行库（静默安装，请稍候）..."
        nsExec::ExecToLog '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
        Pop $1
        ${If} $1 != "0"
            MessageBox MB_OK|MB_ICONEXCLAMATION "VC++ 运行库安装未成功（代码 $1）。$\n$\n请手动安装：https://aka.ms/vs/17/release/vc_redist.x64.exe"
        ${Else}
            DetailPrint "VC++ 运行库安装成功"
        ${EndIf}
        Delete "$TEMP\vc_redist.x64.exe"
    _vcpp_found:
!macroend

!macro customInstall
    ; 安装完成后恢复用户数据（方案A 恢复）
    !insertmacro RestoreUserDataFromTemp
    ; [P0 FIX - 2026-07-26] 恢复后强制重写 data-config.json 的 dataDir
    ; 原因：备份恢复的 data-config.json 内路径可能是旧安装目录，
    ;       换目录安装或路径变化时会导致 resolveDataDir() 解析到错误位置
    ; 修复：始终写入当前 $INSTDIR\data，确保数据目录指向正确路径
    nsExec::ExecToLog `powershell -NoProfile -Command "[IO.File]::WriteAllText('$INSTDIR\data-config.json', (@{dataDir='$INSTDIR\data'} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $$false))"`
    DetailPrint "data-config.json 已更新: dataDir=$INSTDIR\data"
!macroend

; =============================================================================
; 方案 B：用 customRemoveFiles 替换默认的 RMDir /r $INSTDIR
; 只删除程序文件，保留 data 目录和 data-config.json
; 注意：此宏在卸载器中执行，只能保护未来版本的覆盖安装（当前升级的用户
;   运行的是旧版卸载器，仍会用 RMDir /r，由方案 A 兜底）
; =============================================================================
!macro customRemoveFiles
    ; 把 data 目录和 data-config.json 移到 $PROFILE 下，删完程序文件后再移回来
    ; 用 xcopy 而非 Rename，因为 $PROFILE(C盘) 和 $INSTDIR 可能不在同一盘符

    StrCpy $0 "$PROFILE\versepc-data-protect"
    IfFileExists "$0\*.*" 0 +2
        RMDir /r "$0"
    CreateDirectory "$0"

    ; 复制 data 目录到临时目录
    StrCpy $1 "0"  ; 标记是否成功保护了 data
    IfFileExists "$INSTDIR\data\*.*" 0 _protect_config
        nsExec::ExecToLog `xcopy "$INSTDIR\data\*" "$0\data\" /E /I /Y /Q /C`
        Pop $2
        ${If} $2 == "0"
            StrCpy $1 "1"
            DetailPrint "已保护 data 目录免受卸载删除"
        ${EndIf}

    _protect_config:
    ; 复制 data-config.json 到临时目录
    StrCpy $2 "0"  ; 标记是否成功保护了 config
    IfFileExists "$INSTDIR\data-config.json" 0 _delete_program_files
        CopyFiles /SILENT "$INSTDIR\data-config.json" "$0\data-config.json"
        IfFileExists "$0\data-config.json" 0 +2
            StrCpy $2 "1"

    _delete_program_files:
    ; 删除安装目录下所有内容（程序文件 + data + config）
    SetOutPath $TEMP
    RMDir /r "$INSTDIR"
    CreateDirectory "$INSTDIR"

    ; 恢复受保护的文件到安装目录
    StrCmp $2 "1" 0 _restore_data
        CopyFiles /SILENT "$0\data-config.json" "$INSTDIR\data-config.json"
    _restore_data:
    StrCmp $1 "1" 0 _cleanup_protect
        nsExec::ExecToLog `xcopy "$0\data\*" "$INSTDIR\data\" /E /I /Y /Q /C`
        Pop $3
    _cleanup_protect:
    ; 清理临时保护目录
    RMDir /r "$0"
!macroend

!macro customUnInit
    SetAutoClose false
    ; 使用 taskkill 替代 nsProcess 插件（nsProcess 不在 electron-builder 默认 NSIS 中）
    nsExec::ExecToStack 'taskkill /F /IM VersePC.exe /T'
    Sleep 500
    nsExec::ExecToStack 'taskkill /F /IM VersePC.exe /T'
    Sleep 300

    ; 静默卸载时（如覆盖安装调用旧卸载器）不弹窗，默认保留用户数据
    IfSilent _keep_versions _ask_keep_versions
    _ask_keep_versions:
        MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否保留游戏版本和存档数据？$\n$\n版本文件夹包含已安装的游戏版本和存档，保留后可重新安装 VersePC 继续使用。" IDYES _keep_versions IDNO _remove_versions
    _keep_versions:
        DetailPrint "保留版本文件夹"
        Goto _versions_done
    _remove_versions:
        DetailPrint "删除版本文件夹"
        ; 删除 C 盘旧数据目录
        IfFileExists "$PROFILE\.versepc\versions\*.*" 0 +2
        RMDir /r "$PROFILE\.versepc\versions"
        ; 删除安装目录下的数据目录
        IfFileExists "$INSTDIR\data\versions\*.*" 0 +2
        RMDir /r "$INSTDIR\data\versions"
    _versions_done:
!macroend


