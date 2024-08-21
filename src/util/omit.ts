export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
    // Create a new object to store the result
    const result = {} as Omit<T, K>;

    // Iterate over the keys of the input object
    for (const key in obj) {
        // Ensure the key is not in the keys to be omitted
        if (obj.hasOwnProperty(key) && !keys.includes(key as unknown as K)) {
            // Add the key-value pair to the result object
            (result as any)[key] = obj[key];
        }
    }

    // Return the resulting object
    return result;
}
