import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Lm } from './types';

const BASE = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
let loading: Promise<{ landmarker: PoseLandmarker; delegate: 'GPU' | 'CPU' }> | null = null;

/** Loads MediaPipe Pose Landmarker (lite) from this app's own files. GPU first, CPU if the GPU path fails. */
export function loadPose() {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, PoseLandmarker: PL } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}models/wasm`);
      const make = (delegate: 'GPU' | 'CPU') => PL.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}models/pose_landmarker_lite.task`, delegate },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try { return { landmarker: await make('GPU'), delegate: 'GPU' as const }; }
      catch { return { landmarker: await make('CPU'), delegate: 'CPU' as const }; }
    })();
    loading.catch(() => { loading = null; }); // allow a retry after a failure
  }
  return loading;
}

export function toLandmarks(result: { landmarks?: { x: number; y: number; z: number; visibility?: number }[][] }): Lm[] | null {
  const p = result.landmarks?.[0];
  return p ? p.map((q) => ({ x: q.x, y: q.y, z: q.z, v: q.visibility })) : null;
}
