type Page<T> = { data: T[] | null; error: unknown; count: number | null };

// Exact counts prevent a lower API row cap from silently truncating the summary.
// Abort on partial reads, changing counts or oversized datasets, never report zero.
export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<Page<T>>) {
  const rows: T[] = [];
  const pageSize = 500;
  const maxRows = 25_000;
  let total: number | undefined;
  do {
    const page = await read(rows.length, rows.length + pageSize - 1);
    if (page.error || !page.data || page.count === null || page.count > maxRows
      || (total !== undefined && total !== page.count)) throw new Error("quality_read_incomplete");
    total = page.count;
    if (page.data.length === 0 && rows.length < total) throw new Error("quality_read_incomplete");
    rows.push(...page.data);
    if (rows.length > total) throw new Error("quality_read_incomplete");
  } while (rows.length < total);
  return rows;
}
