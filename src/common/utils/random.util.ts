export const RandomUtil = {
  randomNumber(min: number = 0, max: number): number {
    if (max < min) {
      throw new Error('Max must be greater than min');
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};
