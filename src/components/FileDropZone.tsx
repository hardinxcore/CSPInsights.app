import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileUp, Loader2 } from 'lucide-react';

interface FileDropZoneProps {
    onFileSelect: (files: File[]) => void;
    isLoading?: boolean;
    accept?: string;
    title: string;
    description: string;
    icon?: React.ReactNode;
    multiple?: boolean;
    loadingText?: string;
    onCancel?: () => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
    onFileSelect,
    isLoading = false,
    accept = ".csv",
    title,
    description,
    icon,
    multiple = false,
    loadingText = "Processing...",
    onCancel
}) => {
    const [isDragActive, setIsDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        if (files.length > 0) {
            onFileSelect(files);
        }
    }, [onFileSelect]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(true);
    };

    const onDragLeave = () => {
        setIsDragActive(false);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', maxWidth: '600px', margin: '0 auto' }}>
            <h2 className="section-title" style={{ justifyContent: 'center', marginBottom: '1.5rem', border: 'none' }}>
                {icon || <Upload size={24} style={{ marginRight: '10px', color: 'var(--brand-turquoise)' }} />}
                {title}
            </h2>

            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => !isLoading && fileInputRef.current?.click()}
                onKeyDown={e => { if (!isLoading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
                role="button"
                tabIndex={isLoading ? -1 : 0}
                aria-label={title}
                aria-busy={isLoading}
                className={`dropzone ${isDragActive ? 'active' : ''}`}
                style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '3rem',
                    cursor: isLoading ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    background: isDragActive ? 'rgba(0, 181, 226, 0.05)' : 'transparent',
                    opacity: isLoading ? 0.7 : 1
                }}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onInputChange}
                    accept={accept}
                    multiple={multiple}
                    style={{ display: 'none' }}
                    disabled={isLoading}
                />

                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={48} color="var(--brand-turquoise)" />
                        <p>{loadingText}</p>
                        {onCancel && <button type="button" onClick={onCancel} className="secondary-btn" aria-label="Cancel import">Cancel</button>}
                    </div>
                ) : (
                    <>
                        <div style={{ color: 'var(--text-tertiary)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                            <FileUp size={48} />
                        </div>
                        <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                            {description}
                        </p>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                            or click to browse
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
