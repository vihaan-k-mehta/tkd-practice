export type CamError = 'denied' | 'none' | 'busy' | 'unsupported' | 'model';

export const cameraSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export async function openCamera(): Promise<MediaStream> {
  if (!cameraSupported()) throw Object.assign(new Error('unsupported'), { kind: 'unsupported' as CamError });
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
  } catch (e) {
    const name = (e as DOMException).name;
    const kind: CamError = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'busy';
    throw Object.assign(new Error(kind), { kind });
  }
}

export const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

export const camMessage: Record<CamError, string> = {
  denied: 'Camera permission was blocked. Allow the camera for this site in your browser settings, then try again.',
  none: 'No camera was found on this device.',
  busy: 'The camera is in use by another app. Close it and try again.',
  unsupported: 'This browser cannot use the camera here. It needs HTTPS and a recent browser.',
  model: 'The body-tracking model could not load. Check your connection and try again.',
};
