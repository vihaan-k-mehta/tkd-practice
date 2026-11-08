/** One body landmark. x and y are 0..1 across the image (y grows downward); v is visibility 0..1. */
export interface Lm { x: number; y: number; z?: number; v?: number }

/** MediaPipe Pose landmark indexes. Left and right are the person's own sides. */
export const LM = {
  nose: 0, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
  leftHeel: 29, rightHeel: 30, leftFoot: 31, rightFoot: 32,
} as const;

export type Side = 'left' | 'right';
export const LEG = {
  left: { hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle },
  right: { hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle },
} as const;
