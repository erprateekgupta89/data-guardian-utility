// Helper functions for data masking operations
export const randomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const randomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const getUniqueValues = (data: Record<string, string>[], columnName: string): string[] => {
  const values = new Set<string>();
  data.forEach(row => {
    if (row[columnName]) {
      values.add(row[columnName]);
    }
  });
  return Array.from(values);
};

export const getRandomSample = (data: Record<string, string>[], sampleSize: number): Record<string, string>[] => {
  const shuffled = [...data].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(sampleSize, data.length));
};

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const results: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}