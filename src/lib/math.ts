import { CurveFitType } from '../types';
import { levenbergMarquardt as LM } from 'ml-levenberg-marquardt';
import { AppSettings, formatValue } from '../settings';

export function calculateCurveFit(data: { x: number; y: number }[], type: CurveFitType, settings?: AppSettings) {
  const fmt = (val: number) => settings ? formatValue(val, settings) : val.toExponential(3);

  const validData = data.filter(d => {
    if (type === 'logarithmic' && d.x <= 0) return false;
    if (type === 'exponential' && d.y <= 0) return false;
    if (type === 'power' && (d.x <= 0 || d.y <= 0)) return false;
    return true;
  });

  const n = validData.length;
  if (n < 2) return { type, params: [], equationStr: '', r2: 0, valid: false, predictY: (x: number)=>0, predictX: (y: number)=>0 };

  const getPoints = () => {
    switch (type) {
      case 'logarithmic': return validData.map(d => ({ x: Math.log(d.x), y: d.y }));
      case 'exponential': return validData.map(d => ({ x: d.x, y: Math.log(d.y) }));
      case 'power': return validData.map(d => ({ x: Math.log(d.x), y: Math.log(d.y) }));
      case 'linear': default: return validData.map(d => ({ x: d.x, y: d.y }));
    }
  };

  let m = 0, c = 0, a = 0, b = 0, c_quad = 0;
  let predictY: (x: number) => number;
  let predictX: (y: number) => number;
  let equationStr = '';
  let equationStrInverse = '';
  let params: number[] = [];

  if (type === 'quadratic') {
    if (n < 3) return { type, params: [], equationStr: '', equationStrInverse: '', r2: 0, valid: false, predictY: (x: number)=>0, predictX: (y: number)=>0 };
    // Quadratic regression y = a*x^2 + b*x + c
    let sX = 0, sY = 0, sX2 = 0, sX3 = 0, sX4 = 0, sXY = 0, sX2Y = 0;
    for (const p of validData) {
      sX += p.x; sY += p.y;
      const x2 = p.x * p.x;
      sX2 += x2; sX3 += x2 * p.x; sX4 += x2 * x2;
      sXY += p.x * p.y; sX2Y += x2 * p.y;
    }
    const det = n * (sX2 * sX4 - sX3 * sX3) - sX * (sX * sX4 - sX2 * sX3) + sX2 * (sX * sX3 - sX2 * sX2);
    if (det === 0) return { type, params: [], equationStr: '', equationStrInverse: '', r2: 0, valid: false, predictY: (x: number)=>0, predictX: (y: number)=>0 };
    
    c_quad = (sY * (sX2 * sX4 - sX3 * sX3) - sX * (sXY * sX4 - sX2Y * sX3) + sX2 * (sXY * sX3 - sX2Y * sX2)) / det;
    b = (n * (sXY * sX4 - sX2Y * sX3) - sY * (sX * sX4 - sX2 * sX3) + sX2 * (sX * sX2Y - sX2 * sXY)) / det;
    a = (n * (sX2 * sX2Y - sX3 * sXY) - sX * (sX * sX2Y - sX2 * sXY) + sY * (sX * sX3 - sX2 * sX2)) / det;
    
    params = [a, b, c_quad];
    predictY = (x) => a * x * x + b * x + c_quad;
    predictX = (y) => {
      if (a === 0) return b !== 0 ? (y - c_quad) / b : 0;
      const discriminant = b * b - 4 * a * (c_quad - y);
      if (discriminant < 0) return 0;
      // return positive root for typical ELISA (increasing curve)
      return (-b + Math.sqrt(discriminant)) / (2 * a);
    };
    equationStr = `y = ${fmt(a)}x² + ${fmt(b)}x + ${fmt(c_quad)}`;
    equationStrInverse = `x = (-${fmt(b)} + √( ${fmt(b * b)} - ${fmt(4 * a)}(${fmt(c_quad)} - y) )) / ${fmt(2 * a)}`;

  } else if (type === '4pl') {
    if (n < 4) return { type, params: [], equationStr: '', equationStrInverse: '', r2: 0, valid: false, predictY: (x: number)=>0, predictX: (y: number)=>0 };
    
    // y = d + (a - d) / (1 + (x / c)^b)
    // a = min asymptote
    // b = slope factor
    // c = inflection point
    // d = max asymptote
    
    const xArray = validData.map(d => d.x);
    const yArray = validData.map(d => d.y);
    const minOD = Math.min(...yArray);
    const maxOD = Math.max(...yArray);
    
    // Initial guess
    // c is roughly the x value where y is halfway between min and max
    const halfY = (minOD + maxOD) / 2;
    let closestC = xArray[0];
    let diff = Math.abs(yArray[0] - halfY);
    for (let i = 1; i < n; i++) {
      const d = Math.abs(yArray[i] - halfY);
      if (d < diff) {
        diff = d;
        closestC = xArray[i];
      }
    }
    
    // If closestC is 0, give it a small positive value
    const initialC = closestC > 0 ? closestC : (Math.max(...xArray) / 2);

    const initialValues = [
      minOD, // a
      1,     // b
      initialC, // c
      maxOD  // d
    ];
    
    const fourPLFunc = (p: number[]) => (t: number[]) => {
       const [a, b, c, d] = p;
       return t.map(x => d + (a - d) / (1 + Math.pow(x / c, b)));
    };

    try {
      const fitted = LM({ x: xArray, y: yArray }, fourPLFunc, {
         initialValues,
         damping: 1.5,
         maxIterations: 100,
         errorTolerance: 10e-5
      });
      
      const [a, b, c, d] = fitted.parameterValues;
      params = [a, b, c, d];
      
      predictY = (x) => d + (a - d) / (1 + Math.pow(x / c, b));
      // Inverse of 4PL (Solve for x): x = c * (((a - d) / (y - d)) - 1)^(1/b)
      predictX = (y) => {
        const ratio = (a - d) / (y - d);
        if (ratio - 1 < 0) return 0; // Return 0 or undefined for extrapolated beyond asymptote
        return c * Math.pow(ratio - 1, 1 / b);
      };
      
      equationStr = `y = ${fmt(d)} + (${fmt(a)} - ${fmt(d)}) / (1 + (x / ${fmt(c)})^${fmt(b)})`;
      equationStrInverse = `x = ${fmt(c)}(((${fmt(a)} - ${fmt(d)}) / (y - ${fmt(d)})) - 1)^(1/${fmt(b)})`;
    } catch (e) {
      return { type, params: [], equationStr: 'Fitting failed', equationStrInverse: '', r2: 0, valid: false, predictY: (x: number)=>0, predictX: (y: number)=>0 };
    }
  } else {
    // Linear based models
    const pts = getPoints();
    const sumX = pts.reduce((acc, val) => acc + val.x, 0);
    const sumY = pts.reduce((acc, val) => acc + val.y, 0);
    const sumXY = pts.reduce((acc, val) => acc + val.x * val.y, 0);
    const sumXX = pts.reduce((acc, val) => acc + val.x * val.x, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return { type, params: [], equationStr: '', equationStrInverse: '', r2: 0, valid: false, predictY: (x: number)=>0, predictX: (y: number)=>0 };

    m = (n * sumXY - sumX * sumY) / denominator;
    c = (sumY - m * sumX) / n;

    if (type === 'linear') {
      params = [m, c];
      predictY = (x) => m * x + c;
      predictX = (y) => m !== 0 ? (y - c) / m : 0;
      equationStr = `y = ${fmt(m)}x + ${fmt(c)}`;
      if (m !== 0) {
        const invM = 1 / m;
        const invC = -c / m;
        equationStrInverse = `x = ${fmt(invM)}y ${invC >= 0 ? '+' : '-'} ${fmt(Math.abs(invC))}`;
      } else {
        equationStrInverse = `x = undefined`;
      }
    } else if (type === 'logarithmic') {
      params = [m, c];
      predictY = (x) => x > 0 ? m * Math.log(x) + c : 0;
      predictX = (y) => m !== 0 ? Math.exp((y - c) / m) : 0;
      equationStr = `y = ${fmt(m)} ln(x) + ${fmt(c)}`;
      equationStrInverse = `x = e^((y - ${fmt(c)}) / ${fmt(m)})`;
    } else if (type === 'exponential') {
      const cExp = Math.exp(c);
      params = [m, cExp];
      predictY = (x) => cExp * Math.exp(m * x);
      predictX = (y) => (y > 0 && m !== 0) ? Math.log(y / cExp) / m : 0;
      equationStr = `y = ${fmt(cExp)} e^(${fmt(m)}x)`;
      equationStrInverse = `x = ln(y / ${fmt(cExp)}) / ${fmt(m)}`;
    } else if (type === 'power') {
      const cExp = Math.exp(c);
      params = [m, cExp];
      predictY = (x) => x > 0 ? cExp * Math.pow(x, m) : 0;
      predictX = (y) => (y > 0 && m !== 0) ? Math.pow(y / cExp, 1 / m) : 0;
      equationStr = `y = ${fmt(cExp)} x^${fmt(m)}`;
      equationStrInverse = `x = (y / ${fmt(cExp)})^(1/${fmt(m)})`;
    } else {
      predictY = () => 0; predictX = () => 0;
    }
  }

  // Calculate R-squared in linear space
  const yMean = validData.reduce((acc, val) => acc + val.y, 0) / n;
  const ssTot = validData.reduce((acc, val) => acc + Math.pow(val.y - yMean, 2), 0);
  const ssRes = validData.reduce((acc, val) => acc + Math.pow(val.y - predictY(val.x), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

  // We return both. In calculateCurveFitWrapper, we add blankOD etc.
  // Wait, calculateCurveFit currently doesn't return RegressionParams directly (it lacks blankOD).
  // Yes, they are added later.
  return { type, params, equationStr, equationStrInverse, r2, valid: true, predictY, predictX } as any;
}

export function calculateMeanAndSD(values: number[]) {
  if (values.length === 0) return { mean: 0, sd: 0, sem: 0, cv: 0, valid: false };
  
  const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
  
  if (values.length === 1) return { mean, sd: 0, sem: 0, cv: 0, valid: true };
  
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
  const sd = Math.sqrt(variance);
  const sem = sd / Math.sqrt(values.length);
  const cv = mean === 0 ? 0 : (sd / mean) * 100;
  
  return { mean, sd, sem, cv, valid: true };
}
