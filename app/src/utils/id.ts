import { randomBytes } from 'crypto';

export const generateId = (length: number = 7): string => {
    return randomBytes(4).toString('hex').substring(0, length);
};
