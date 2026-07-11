const MAX_IMPORT_BYTES = 500 * 1024 * 1024;

export const validateImportFiles = (files: File[]): void => {
    if (files.length === 0) throw new Error('Select at least one file.');
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_IMPORT_BYTES) {
        throw new Error('The selected files exceed the 500 MB browser-memory safety limit. Import a smaller period or split the files.');
    }
    for (const file of files) {
        if (!/\.(csv|csv\.gz|gz)$/i.test(file.name)) {
            throw new Error(`Unsupported file type: ${file.name}. Select CSV or CSV.GZ exports.`);
        }
    }
};
