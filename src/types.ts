export type StandardData = {
  id: string;
  concentration: string;
  od: string;
};

export type SampleColumn = {
  id: string;
  name: string;
};

export type SampleRow = {
  id: string;
  name: string;
  values: Record<string, string>;
};

export type CurveFitType = 'linear' | 'logarithmic' | 'exponential' | 'power' | 'quadratic' | '4pl';

export type RegressionParams = {
  type: CurveFitType;
  params: number[]; // e.g., [m, c] or [a, b, c]
  equationStr: string;
  equationStrInverse?: string;
  r2: number;
  valid: boolean;
  blankOD: number;
  useBlankOffset: boolean;
  predictY: (x: number) => number;
  predictX: (y: number) => number;
};
