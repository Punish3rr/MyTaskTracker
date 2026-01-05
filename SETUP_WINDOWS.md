# Windows Setup Guide for TaskVault

## Issue: better-sqlite3 requires C++ build tools

`better-sqlite3` is a native module that requires compilation. Your system has Visual Studio 2022 Community installed, but it's missing the C++ build tools workload.

## Solution: Install C++ Build Tools

### Current Status

If you see:
- ✅ `found VC++ toolset: v143` 
- ❌ `missing any Windows SDK`

You need to install the **Windows SDK** component. See "Missing Windows SDK" section below.

### Option 1: Via Visual Studio Installer (Recommended)

1. **Open Visual Studio Installer**
   - Search for "Visual Studio Installer" in Windows Start menu
   - Or go to: `C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe`

2. **Modify Visual Studio 2022 Community**
   - Click "Modify" next to Visual Studio 2022 Community

3. **Select Workload**
   - Check the box for **"Desktop development with C++"**
   - This includes:
     - MSVC v143 - VS 2022 C++ x64/x86 build tools
     - Windows 10/11 SDK
     - CMake tools
     - And other required components

4. **Install**
   - Click "Modify" at the bottom right
   - Wait for installation to complete (may take 10-20 minutes)

5. **Restart Terminal**
   - Close your current PowerShell/terminal window
   - Open a new terminal

6. **Install Dependencies**
   ```powershell
   npm install
   ```

### Option 2: Install Build Tools Only (Smaller Download)

If you prefer a smaller installation:

1. Download **Visual Studio Build Tools 2022** from:
   https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

2. Run the installer and select:
   - **"Desktop development with C++"** workload

3. Install and restart terminal

4. Run `npm install`

### Missing Windows SDK

If you see `found VC++ toolset: v143` but `missing any Windows SDK`:

1. **Open Visual Studio Installer**
2. **Modify Visual Studio 2022 Community**
3. Go to **"Individual components"** tab (not Workloads)
4. Search for **"Windows SDK"**
5. Check **"Windows 10 SDK"** or **"Windows 11 SDK"** (latest version, e.g., 10.0.22621.0 or 11.0.22621.0)
6. Click **"Modify"** to install
7. Restart terminal and run `npm install`

Alternatively, you can install the SDK directly:
- Download Windows SDK from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
- Install the latest Windows 10/11 SDK
- Restart terminal and run `npm install`

### Option 3: Use Prebuilt Binaries (Temporary Workaround)

If you need to proceed immediately without installing build tools, you can try:

```powershell
npm install better-sqlite3 --build-from-source=false
```

However, this may not work for Node.js 22.14.0 as prebuilt binaries may not be available.

## Verify Installation

After installing the build tools, verify they're detected:

```powershell
npm config set msvs_version 2022
npm install
```

## Alternative: Use Different Node.js Version

If you continue having issues, you can use Node.js LTS (20.x) which has better prebuilt binary support:

```powershell
# Using nvm-windows (if installed)
nvm install 20
nvm use 20
npm install
```

## Troubleshooting

### Error: "missing any VC++ toolset"

This means the C++ build tools aren't installed. Follow Option 1 above.

### Error: "EPERM: operation not permitted"

Close any programs that might be locking files (VS Code, terminals, etc.) and try again.

### Still Having Issues?

1. Make sure you're running PowerShell/terminal as Administrator
2. Try: `npm cache clean --force`
3. Delete `node_modules` folder and `package-lock.json`
4. Run `npm install` again
