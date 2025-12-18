import { DataRow, RegressionResult, VariableConfig, ModelCoefficient, RobustnessMetrics } from '../types';

// Basic Matrix Operations for OLS: Beta = (X'X)^-1 X'Y

type Matrix = number[][];

const transpose = (m: Matrix): Matrix => {
  return m[0].map((_, i) => m.map(row => row[i]));
};

const multiply = (m1: Matrix, m2: Matrix): Matrix => {
  const result: Matrix = [];
  for (let i = 0; i < m1.length; i++) {
    result[i] = [];
    for (let j = 0; j < m2[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < m1[0].length; k++) {
        sum += m1[i][k] * m2[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
};

const inverse = (m: Matrix): Matrix => {
  // Gaussian elimination
  const n = m.length;
  const identity = m.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
  const matrix = m.map(row => [...row]); // Copy

  for (let i = 0; i < n; i++) {
    let pivot = matrix[i][i];
    if (Math.abs(pivot) < 1e-10) {
      // Try to swap with a lower row
      let swapped = false;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(matrix[k][i]) > 1e-10) {
           // Swap rows in matrix
           [matrix[i], matrix[k]] = [matrix[k], matrix[i]];
           // Swap rows in identity
           [identity[i], identity[k]] = [identity[k], identity[i]];
           pivot = matrix[i][i];
           swapped = true;
           break;
        }
      }
      if (!swapped) throw new Error("矩阵奇异 (Singular Matrix)");
    }

    // Scale row
    for (let j = 0; j < n; j++) {
      matrix[i][j] /= pivot;
      identity[i][j] /= pivot;
    }

    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = matrix[k][i];
        for (let j = 0; j < n; j++) {
          matrix[k][j] -= factor * matrix[i][j];
          identity[k][j] -= factor * identity[i][j];
        }
      }
    }
  }
  return identity;
};

const mean = (arr: number[]): number => arr.reduce((a, b) => a + b, 0) / arr.length;

// Helper to compute Pearson Correlation Matrix
const computeCorrelationMatrix = (X: number[][]): number[][] => {
  const n = X.length;
  if (n === 0) return [];
  const k = X[0].length;
  
  const means = Array(k).fill(0);
  const stds = Array(k).fill(0);

  // Calc means
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < n; i++) means[j] += X[i][j];
    means[j] /= n;
  }

  // Calc stds
  for (let j = 0; j < k; j++) {
    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += Math.pow(X[i][j] - means[j], 2);
    stds[j] = Math.sqrt(sumSq / (n - 1));
  }

  const R: number[][] = Array(k).fill(0).map(() => Array(k).fill(0));

  for (let r = 0; r < k; r++) {
    for (let c = r; c < k; c++) {
      if (stds[r] < 1e-9 || stds[c] < 1e-9) {
          R[r][c] = NaN; // Constant column
          R[c][r] = NaN;
          continue;
      }
      if (r === c) {
          R[r][c] = 1.0;
          continue;
      }

      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += ((X[i][r] - means[r]) / stds[r]) * ((X[i][c] - means[c]) / stds[c]);
      }
      const val = sum / (n - 1);
      R[r][c] = val;
      R[c][r] = val;
    }
  }
  return R;
}

// Helper to calculate VIFs using Correlation Matrix Inverse
const calculateVIFs = (X: number[][]): number[] => {
  const k = X[0].length;
  if (k <= 1) return Array(k).fill(1.0);

  // We need to handle potential constant columns to avoid singular matrix during VIF calculation
  // Filter columns that have variance > 0
  const n = X.length;
  const variances = Array(k).fill(0);
  const means = Array(k).fill(0);
  
  for(let j=0; j<k; j++) {
      let sum = 0;
      for(let i=0; i<n; i++) sum += X[i][j];
      means[j] = sum / n;
  }
  for(let j=0; j<k; j++) {
      let sumSq = 0;
      for(let i=0; i<n; i++) sumSq += Math.pow(X[i][j] - means[j], 2);
      variances[j] = sumSq / (n - 1);
  }

  const validIndices: number[] = [];
  for (let j = 0; j < k; j++) {
      if (variances[j] > 1e-9) validIndices.push(j);
  }

  const p = validIndices.length;
  if (p < 2) return Array(k).fill(1.0); 

  // Build small matrix for valid columns only
  const X_valid = X.map(row => validIndices.map(idx => row[idx]));
  const R_small = computeCorrelationMatrix(X_valid);

  try {
    const R_inv = inverse(R_small);
    const result = Array(k).fill(NaN); // Default

    for (let i = 0; i < p; i++) {
      result[validIndices[i]] = R_inv[i][i];
    }
    // Fill remaining with Infinity or NaN
    for(let j=0; j<k; j++) {
        if(isNaN(result[j])) result[j] = Infinity; 
    }
    return result;
  } catch (error) {
     return Array(k).fill(Infinity);
  }
};

// Pure math solver: Beta = (X'X)^-1 X'Y
// Returns coefficients array
const solveOLS = (X: Matrix, Y: number[]): number[] | null => {
    try {
        const Y_mat = Y.map(y => [y]);
        const X_T = transpose(X);
        const XTX = multiply(X_T, X);
        const XTX_inv = inverse(XTX);
        const XTY = multiply(X_T, Y_mat);
        const Beta = multiply(XTX_inv, XTY);
        return Beta.map(r => r[0]);
    } catch (e) {
        return null;
    }
};

export const performRegression = (
  data: DataRow[],
  targetVar: string,
  featureVars: VariableConfig[],
  targetLogTransform: boolean = false,
  targetLogPlusOne: boolean = false
): RegressionResult => {
  // Helper for Log transform
  const getLogVal = (val: number, plusOne: boolean) => plusOne ? Math.log1p(val) : Math.log(val);
  
  // 1. Preprocess Data: Filter missing, One-Hot Encode, Log Transform validation
  const cleanData = data.filter(row => {
    // Check target
    let yVal = Number(row[targetVar]);
    if (isNaN(yVal)) return false;
    if (targetLogTransform) {
      if (targetLogPlusOne) {
          if (yVal <= -1) return false;
      } else {
          if (yVal <= 0) return false;
      }
    }

    // Check features
    return featureVars.every(f => {
      const val = row[f.name];
      if (val === null || val === undefined || val === '') return false;
      
      if (f.type === 'numeric' && f.logTransform) {
        const numVal = Number(val);
        if (isNaN(numVal)) return false;
        
        if (f.logPlusOne) {
            if (numVal <= -1) return false;
        } else {
            if (numVal <= 0) return false;
        }
      }
      return true;
    });
  });

  if (cleanData.length === 0) throw new Error("过滤缺失值或无效对数变换数据后，没有剩余的有效数据行。请检查是否包含 0 或负数。");

  // --- SAFETY CHECKS: Detect Multicollinearity Triggers BEFORE Matrix Ops ---
  
  // Check A: Constant Variables (Zero Variance)
  // Constant variables are parallel to the Intercept, causing singularity.
  featureVars.forEach(f => {
    if (f.type === 'numeric') {
        const values = cleanData.map(r => Number(r[f.name]));
        const min = Math.min(...values);
        const max = Math.max(...values);
        // Using a small epsilon for floating point comparison
        if (Math.abs(max - min) < 1e-9) {
            throw new Error(`错误：变量 "${f.name}" 是常数（在所有选中行中值都相同）。常数变量与截距项冲突，会导致矩阵不可逆。请取消勾选该变量。`);
        }
    }
  });

  // Check B: Perfectly Identical Variables
  for (let i = 0; i < featureVars.length; i++) {
      for (let j = i + 1; j < featureVars.length; j++) {
          const var1 = featureVars[i];
          const var2 = featureVars[j];
          if (var1.type === 'numeric' && var2.type === 'numeric') {
              const vals1 = cleanData.map(r => Number(r[var1.name]));
              const vals2 = cleanData.map(r => Number(r[var2.name]));
              
              // Quick check: sum and mean, then full comparison
              const isIdentical = vals1.every((val, idx) => Math.abs(val - vals2[idx]) < 1e-9);
              if (isIdentical) {
                  throw new Error(`错误：变量 "${var1.name}" 和 "${var2.name}" 的数据完全相同。完全重复的变量会导致多重共线性。请移除其中一个。`);
              }
          }
      }
  }

  // Apply transformations to Y
  const Y: number[] = cleanData.map(row => {
    const val = Number(row[targetVar]);
    return targetLogTransform ? getLogVal(val, targetLogPlusOne) : val;
  });

  const X_raw: number[][] = [];
  const featureNames: string[] = ["Intercept"];

  // 2. Build X Matrix (Design Matrix)
  // Identify categorical levels first
  const catFeatures = featureVars.filter(f => f.type === 'categorical');
  const catLevels: Record<string, string[]> = {};
  catFeatures.forEach(f => {
    const uniqueValues = Array.from(new Set(cleanData.map(row => String(row[f.name])))).sort();
    // Drop first level to avoid Dummy Variable Trap
    if (uniqueValues.length <= 1) {
        // Warning: Categorical variable has only 1 level. It effectively acts as a constant/intercept.
        // But since we use uniqueValues.slice(1), it generates 0 columns, so it is mathematically safe, just useless.
    }
    catLevels[f.name] = uniqueValues.slice(1);
  });

  // Construct headers
  featureVars.forEach(f => {
    if (f.type === 'numeric') {
      let prefix = "";
      if (f.logTransform) {
          prefix = f.logPlusOne ? "ln1p_" : "ln_";
      }
      featureNames.push(`${prefix}${f.name}`);
    } else {
      catLevels[f.name].forEach(level => {
        featureNames.push(`${f.name}_${level}`);
      });
    }
  });

  // Fill Matrix
  cleanData.forEach(row => {
    const xRow: number[] = [1]; // Intercept
    featureVars.forEach(f => {
      if (f.type === 'numeric') {
        const val = Number(row[f.name]);
        xRow.push(f.logTransform ? getLogVal(val, !!f.logPlusOne) : val);
      } else {
        const val = String(row[f.name]);
        catLevels[f.name].forEach(level => {
          xRow.push(val === level ? 1 : 0);
        });
      }
    });
    X_raw.push(xRow);
  });

  const n = Y.length;
  const k = featureNames.length;

  if (n <= k) {
      throw new Error(`样本量不足。有效数据行数 (${n}) 必须多于模型参数数量 (${k}, 含截距)。请增加数据或减少变量。`);
  }

  // 3. Matrix Math: Beta = (X'X)^-1 X'Y
  const Beta = solveOLS(X_raw, Y);
  if (!Beta) {
      throw new Error("数学计算错误：无法对矩阵求逆。这通常是因为变量之间存在完美的相关性（例如 A=2B，或 A+B=C）。请尝试移除高度相关的变量。");
  }

  // 4. Calculate Statistics (Main Model)
  const predictions = X_raw.map((row, i) => {
    let pred = 0;
    for (let j = 0; j < row.length; j++) {
      pred += row[j] * Beta[j];
    }
    
    // Extract categorical values for visualization
    const categories: Record<string, string> = {};
    catFeatures.forEach(f => {
        categories[f.name] = String(cleanData[i][f.name]);
    });

    return {
      actual: Y[i],
      predicted: pred,
      residual: Y[i] - pred,
      categories
    };
  });

  const yMean = mean(Y);
  const sst = predictions.reduce((sum, p) => sum + Math.pow(p.actual - yMean, 2), 0);
  const sse = predictions.reduce((sum, p) => sum + Math.pow(p.residual, 2), 0);
  const r2 = 1 - (sse / sst);
  const adjustedR2 = 1 - ((1 - r2) * (n - 1) / (n - k));
  const mse = sse / (n - k);
  const rmse = Math.sqrt(mse);

  // Standard Errors
  const Y_mat = Y.map(y => [y]);
  const X_mat = X_raw;
  const X_T = transpose(X_mat);
  const XTX = multiply(X_T, X_mat);
  let XTX_inv;
  try {
     XTX_inv = inverse(XTX);
  } catch(e) {
     throw new Error("Singular Matrix during Standard Error calculation");
  }

  const varBeta = XTX_inv.map(row => row.map(val => val * mse));
  const tCritical = 1.96; 
  
  // VIF & Correlation
  const X_no_intercept = X_raw.map(row => row.slice(1));
  const vifs = calculateVIFs(X_no_intercept);
  const correlationMatrixRaw = computeCorrelationMatrix(X_no_intercept);

  const coefficients: ModelCoefficient[] = Beta.map((val, i) => {
    const se = Math.sqrt(varBeta[i][i]);
    return {
        name: featureNames[i],
        value: val,
        stdError: se,
        tStat: val / se,
        confidenceInterval: [val - tCritical * se, val + tCritical * se],
        vif: i > 0 ? vifs[i - 1] : undefined
    };
  });

  // 5. Robustness Check: Bootstrap
  // Resample with replacement N times
  const BOOTSTRAP_ITERATIONS = n > 2000 ? 20 : 50; // Performance optimization
  const bootstrapBetas: number[][] = Array(k).fill(0).map(() => []);

  for (let iter = 0; iter < BOOTSTRAP_ITERATIONS; iter++) {
      // Resample indices
      const indices = [];
      for (let i = 0; i < n; i++) {
          indices.push(Math.floor(Math.random() * n));
      }
      
      const X_sample = indices.map(idx => X_raw[idx]);
      const Y_sample = indices.map(idx => Y[idx]);
      
      const b_sample = solveOLS(X_sample, Y_sample);
      if (b_sample) {
          for(let j=0; j<k; j++) {
              bootstrapBetas[j].push(b_sample[j]);
          }
      }
  }

  const robustness: RobustnessMetrics[] = coefficients.map((c, i) => {
      const values = bootstrapBetas[i].sort((a, b) => a - b);
      if (values.length === 0) return {
          name: c.name, original: c.value, bootstrapMean: 0, bootstrapMedian: 0, 
          bootstrapMin: 0, bootstrapMax: 0, bootstrapLowCI: 0, bootstrapHighCI: 0
      };

      const bMean = mean(values);
      const bMedian = values[Math.floor(values.length / 2)];
      const bMin = values[0];
      const bMax = values[values.length - 1];
      const bLow = values[Math.floor(values.length * 0.025)] || bMin;
      const bHigh = values[Math.floor(values.length * 0.975)] || bMax;

      return {
          name: c.name,
          original: c.value,
          bootstrapMean: bMean,
          bootstrapMedian: bMedian,
          bootstrapMin: bMin,
          bootstrapMax: bMax,
          bootstrapLowCI: bLow,
          bootstrapHighCI: bHigh
      };
  }).filter(r => r.name !== 'Intercept'); // Usually exclude Intercept from robustness plot to keep scale clean

  const eqParts = coefficients.map((c, i) => {
    if (i === 0) return `${c.value.toFixed(4)}`;
    return `${c.value >= 0 ? '+' : ''} ${c.value.toFixed(4)}*${c.name}`;
  });

  return {
    coefficients,
    r2,
    adjustedR2,
    rmse,
    observations: n,
    predictions,
    equation: `Y = ${eqParts.join(' ')}`,
    correlationMatrix: {
        names: featureNames.slice(1),
        matrix: correlationMatrixRaw
    },
    robustness
  };
};