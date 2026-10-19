// Only the native Mac Store shell advertises this capability. Other platforms
// keep their existing download/native-export behavior.
export async function resolveMacStoreExport(result, nativeWindow = globalThis.window) {
  if (!result?.url || result.native || !nativeWindow?.productionDeskMacStore) return result;
  const bridge = nativeWindow.webkit?.messageHandlers?.storeExport;
  if (!bridge) throw new Error('The native save dialog is unavailable. Please reopen Production Desk.');
  const saved = await bridge.postMessage(result.url);
  if (saved?.native !== true || typeof saved.cancelled !== 'boolean') {
    throw new Error('The native save dialog returned an invalid result.');
  }
  return saved;
}
