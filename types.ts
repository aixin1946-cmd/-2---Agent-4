
export enum FrameType {
  START = 'START',
  MID = 'MID',
  END = 'END'
}

export interface Frame {
  id: string;
  type: FrameType;
  imageUrl?: string;
  videoUrl?: string;
  prompt?: string;
  isGenerating: boolean;
  isAnimating: boolean;
}

export interface Shot {
  id: string;
  index: number;
  description: string;
  visualReference: string;
  keyframes: Frame[];
}

export interface AppState {
  shots: Shot[];
  isGlobalLoading: boolean;
  hasApiKey: boolean;
}
