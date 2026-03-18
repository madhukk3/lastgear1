import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { X } from 'lucide-react';

const AddedToCartPopup = () => {
    const { addedItem, clearAddedItem, cartCount } = useCart();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (addedItem) {
            setIsVisible(true);
            // Auto dismiss after 5 seconds
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(clearAddedItem, 300); // Wait for fade out animation
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [addedItem, clearAddedItem]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(clearAddedItem, 300);
    };

    const handleViewCart = () => {
        handleClose();
        navigate('/cart');
    };

    if (!addedItem && !isVisible) return null;

    return (
        <div
            className={`fixed top-24 right-8 z-[100] w-full max-w-sm bg-white shadow-2xl border border-gray-200 transition-all duration-300 transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}
        >
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-gray-900">Added to cart</h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-black transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex gap-4 mb-6">
                    <div className="w-24 h-32 bg-gray-100 flex-shrink-0">
                        <img
                            src={addedItem?.image || (addedItem?.images?.length > 0 ? addedItem.images[0] : null) || '/placeholder-clothing.svg'}
                            alt={addedItem?.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-black mb-1 leading-snug">{addedItem?.name}</h4>
                        {addedItem?.selectedColor && (
                            <p className="text-sm text-gray-600">Color: {addedItem.selectedColor}</p>
                        )}
                        {addedItem?.selectedSize && (
                            <p className="text-sm text-gray-600">Size: {addedItem.selectedSize}</p>
                        )}
                        <p className="font-bold mt-2">₹{addedItem?.price}</p>
                    </div>
                </div>

                <button
                    onClick={handleViewCart}
                    className="w-full bg-[#181818] text-white py-4 font-bold tracking-wider hover:bg-black transition-colors text-sm"
                >
                    VIEW CART ({cartCount}) & CHECKOUT
                </button>
            </div>
        </div>
    );
};

export default AddedToCartPopup;
