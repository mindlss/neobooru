/**
 * Простое арифметическое среднее.
 * Возвращает null на пустом массиве — удобно для денормализованных
 * рейтинговых полей (Media.ratingAvg, Comic.ratingAvg) в Prisma:
 * там это nullable Float.
 */
export function computeAvg(values: number[]): number | null {
    if (values.length === 0) return null;
    let sum = 0;
    for (const v of values) sum += v;
    return sum / values.length;
}
