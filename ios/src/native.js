// Native bridge for the odo iPhone app. Bundled into www/native.js by build.mjs.
// The web app (index.html) looks for window.OdoNative and falls back to browser APIs when it's missing.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { StatusBar, Style } from '@capacitor/status-bar';

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});


  window.OdoNative = {
    speech: SpeechRecognition,
    haptic(style) {
      const s = { LIGHT: ImpactStyle.Light, MEDIUM: ImpactStyle.Medium, HEAVY: ImpactStyle.Heavy }[style || 'LIGHT'];
      Haptics.impact({ style: s }).catch(() => {});
    },
    async share(blob, filename, title) {
      const data = await blobToBase64(blob);
      const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
      await Share.share({ title: title || 'odo', files: [file.uri] });
    }
  };
}
