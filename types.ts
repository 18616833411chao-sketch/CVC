export interface DataRow {
  [key: string]: string | number | null;
}

export interface VariableConfig {
  name: string;
  type: 'numeric' | 'categorical';
  role: 'target' | 'feature' | 'ignore';
  logTransform?: boolean; // Logarithm transformation
  logPlusOne?: boolean; // If true, perform log(x + 1)
}

export interface ModelCoefficient {
  name: string;
  value: number;
  stdError?: number; // Simplified estimation
  tStat?: number;
  confidenceInterval?: [number, number]; // 95% Confidence Interval
  vif?: number; // Variance Inflation Factor
}

export interface RobustnessMetrics {
  name: string;
  original: number;
  bootstrapMean: number;
  bootstrapMedian: number;
  bootstrapMin: number;
  bootstrapMax: number;
  bootstrapLowCI: number; // 2.5th percentile
  bootstrapHighCI: number; // 97.5th percentile
}

export interface RegressionResult {
  coefficients: ModelCoefficient[];
  r2: number;
  adjustedR2: number;
  rmse: number;
  observations: number;
  predictions: { 
    actual: number; 
    predicted: number; 
    residual: number;
    categories?: Record<string, string>; // Stores values of categorical features for this row
  }[];
  equation: string;
  correlationMatrix?: {
    names: string[];
    matrix: number[][];
  };
  robustness?: RobustnessMetrics[];
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  CONFIG = 'CONFIG',
  RESULTS = 'RESULTS'
}