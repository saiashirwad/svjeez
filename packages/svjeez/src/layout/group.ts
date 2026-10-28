/** `Map.groupBy`, which Node 20 and earlier lack. */
export const groupBy = <T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);

    if (group) group.push(item);
    else groups.set(k, [item]);
  }

  return groups;
};
