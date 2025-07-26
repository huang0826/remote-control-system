@echo off
echo 开始编译Android项目...
echo.

REM 检查Gradle Wrapper是否存在
if not exist "gradlew.bat" (
    echo 错误: gradlew.bat 不存在，请确保在Android项目根目录下运行此脚本
    pause
    exit /b 1
)

echo 清理项目...
call gradlew.bat clean

echo.
echo 编译Debug版本...
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 编译成功！
    echo APK文件位置: app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo 编译失败，请检查错误信息
)

echo.
pause