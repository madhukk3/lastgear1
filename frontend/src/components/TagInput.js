import React, { useState } from 'react';
import { X } from 'lucide-react';

const TagInput = ({ tags = [], setTags, placeholder, suggestions = [] }) => {
    const [input, setInput] = useState('');

    const addTag = (tag) => {
        const trimmed = tag.trim().toUpperCase();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
        }
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                {tags.length === 0 && <span className="text-gray-400 text-sm italic py-1">No options added</span>}
                {tags.map(tag => (
                    <span key={tag} className="bg-gray-100 text-black px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-gray-200 font-medium">
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                {suggestions.length > 0 && (
                    <select
                        className="px-3 py-2 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black text-sm max-w-[120px]"
                        onChange={(e) => {
                            if (e.target.value) {
                                addTag(e.target.value);
                                e.target.value = '';
                            }
                        }}
                    >
                        <option value="">Select...</option>
                        {suggestions.filter(s => !tags.includes(s.toUpperCase())).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                )}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black uppercase text-sm"
                />
                <button
                    type="button"
                    onClick={() => addTag(input)}
                    className="shrink-0 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors uppercase tracking-widest"
                >
                    Add
                </button>
            </div>
        </div>
    );
};

export default TagInput;
