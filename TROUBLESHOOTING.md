# Troubleshooting: window.electronAPI is undefined

## Issue
When running the app, you see errors like:
```
Cannot read properties of undefined (reading 'getTasks')
```

This means `window.electronAPI` is not available in the renderer process.

## Common Causes

### 1. Preload Script Not Loading
The preload script must be loaded before the renderer content. Check:

- **Electron DevTools Console**: Look for "Preload script: electronAPI exposed successfully"
- **Main Process Console**: Check for preload path errors
- **Preload Path**: Should be `dist-electron/electron/preload.js` in production

### 2. Context Isolation
Make sure in `electron/main.ts`:
```typescript
webPreferences: {
  preload: preloadPath,
  contextIsolation: true,  // Must be true
  nodeIntegration: false,  // Must be false
}
```

### 3. Development vs Production
- **Development**: Preload loads from `dist-electron/electron/preload.js`
- **Production**: Same path, but make sure files are bundled

## Quick Fix

1. **Rebuild Electron files**:
   ```powershell
   npm run build:electron
   ```

2. **Restart the app**:
   ```powershell
   npm run electron:dev
   ```

3. **Check DevTools Console**:
   - Open DevTools (F12 or Ctrl+Shift+I)
   - Look for preload errors
   - Check if `window.electronAPI` exists: type `window.electronAPI` in console

4. **Check Main Process Console**:
   - Look at the terminal where you ran `npm run electron:dev`
   - Check for "Preload path:" and "Preload exists:" messages

## Verification

In the renderer DevTools console, run:
```javascript
console.log(window.electronAPI);
```

Should output the API object, not `undefined`.

## If Still Not Working

1. **Clear build cache**:
   ```powershell
   Remove-Item -Recurse -Force dist-electron
   npm run build:electron
   ```

2. **Check file paths**:
   - Verify `dist-electron/electron/preload.js` exists
   - Verify `dist-electron/electron/main.js` exists

3. **Check Electron version compatibility**:
   - Electron 28+ requires contextIsolation: true
   - Preload scripts must use contextBridge

