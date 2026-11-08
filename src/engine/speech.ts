/** Spoken prompts for hands-free guidance. Optional: everything is also shown on screen. */
export const speechSupported = (): boolean => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function speak(text: string): void {
  if (!speechSupported()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.volume = 1; u.lang = document.documentElement.lang || 'en';
    speechSynthesis.speak(u);
  } catch { /* speech is a nicety, never a requirement */ }
}
export function stopSpeaking(): void {
  try { if (speechSupported()) speechSynthesis.cancel(); } catch { /* ignore */ }
}
