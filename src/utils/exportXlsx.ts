/**
 * Shared Excel export helper. Loads the xlsx library on demand so the
 * (large) SheetJS bundle stays out of the initial page load.
 */
export const exportToXlsx = async (rows: object[], sheetName: string, fileName: string): Promise<void> => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
};
