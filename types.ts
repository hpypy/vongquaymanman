
export type RaceStatus = 'idle' | 'spinning' | 'finished';

export interface Prize {
  id: string;
  name: string;
  image: string;
  color: string;
  type: 'food' | 'tech' | 'money';
  description: string;
  // Added optional fields for compatibility with Horse3D component and other racing logic
  rank?: number;
  amount?: string;
}

export interface Participant {
  id: string;
  name: string;
  color: string;
  avatar: string;
  // Added position for components that track movement/progress
  position?: number;
}

// Define Horse interface for components using horse racing logic
export interface Horse {
  id: number;
  position: number;
  rank?: number;
  finished: boolean;
  isBoosting: boolean;
}
