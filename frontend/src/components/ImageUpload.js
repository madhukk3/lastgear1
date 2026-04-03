import React, { useCallback, useState } from 'react';
import axios from 'axios';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ImageUpload = ({ value, onChange, label = "Product Image" }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const API = `${BACKEND_URL}/api`;

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const uploadFile = async (file) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file (JPEG, PNG, WEBP)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast.error('File size must be less than 5MB');
            return;
        }

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(`${API}/admin/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                withCredentials: true
            });

            // The backend returns a relative path like /uploads/filename.jpg
            // We combine it with the BACKEND_URL to form the full absolute URL for the img src
            const fullUrl = `${BACKEND_URL}${response.data.url}`;
            onChange(fullUrl);
            toast.success('Image uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    }, [BACKEND_URL, API]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    };

    const handleRemove = () => {
        onChange('');
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium mb-2">{label}</label>

            {/* Preview area if value exists */}
            {value ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 group bg-gray-50 flex items-center justify-center">
                    <img
                        src={value}
                        alt="Uploaded preview"
                        className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="bg-white text-red-600 p-2 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                            title="Remove image"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            ) : (
                /* Dropzone if no value */
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
            w-full py-12 px-4 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer
            ${isDragging
                            ? 'border-black bg-gray-50'
                            : 'border-gray-300 hover:border-gray-400 bg-white'
                        }
          `}
                    onClick={() => !isUploading && document.getElementById(`file-upload-${label}`).click()}
                >
                    <input
                        id={`file-upload-${label}`}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handleFileInput}
                        disabled={isUploading}
                    />

                    <div className="flex flex-col items-center justify-center text-gray-500">
                        {isUploading ? (
                            <>
                                <Loader2 className="animate-spin mb-3 text-black" size={32} />
                                <p className="text-sm font-medium text-black">Uploading...</p>
                            </>
                        ) : (
                            <>
                                <UploadCloud size={32} className={`mb-3 ${isDragging ? 'text-black' : 'text-gray-400'}`} />
                                <p className="text-sm font-medium mb-1 text-black">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs">
                                    SVG, PNG, JPG or WEBP (max. 5MB)
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageUpload;
