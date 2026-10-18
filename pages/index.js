import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Menu, X, Search, Home, User, Heart, ChevronDown, Plus, Minus, Trash2, Check, AlertCircle, Gift } from 'lucide-react';

// Mobile-First Fojec Supermarket Website
export default function FojejMobileWebsite() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState('home'); // home, products, cart, account, loyalty
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Mock data - replace with Supabase later
  useEffect(() => {
    const mockProducts = [
      { id: 1, name: 'Rice (500g)', price: 12.50, category: 'African Foodstuffs', image: '🍚', stock: 45, rating: 4.8, reviews: 24 },
      { id: 2, name: 'Frozen Fish (1kg)', price: 18.99, category: 'Frozen Foods', image: '🐟', stock: 12, rating: 4.6, reviews: 18 },
      { id: 3, name: 'Premium Coffee (250g)', price: 8.50, category: 'Teas & Beverages', image: '☕', stock: 32, rating: 4.9, reviews: 42 },
      { id: 4, name: 'Millet (1kg)', price: 15.99, category: 'African Foodstuffs', image: '🌾', stock: 28, rating: 4.7, reviews: 15 },
      { id: 5, name: 'Frozen Vegetables', price: 9.99, category: 'Frozen Foods', image: '🥬', stock: 50, rating: 4.5, reviews: 22 },
      { id: 6, name: 'Herbal Tea', price: 6.50, category: 'Teas & Beverages', image: '🫖', stock: 38, rating: 4.8, reviews: 19 },
    ];
    setProducts(mockProducts);
  }, []);

  const categories = [
    { id: 1, name: 'African Foodstuffs', emoji: '🍚' },
    { id: 2, name: 'Frozen Foods', emoji: '🥶' },
    { id: 3, name: 'Teas & Beverages', emoji: '☕' },
    { id: 4, name: 'Make-up Services', emoji: '💄' },
  ];

  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
    } else {
      setCart(cart.map(item => item.id === id ? { ...item, quantity } : item));
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const gst = cartTotal * 0.1;
  const shipping = cartTotal > 50 ? 0 : 3;
  const grandTotal = cartTotal + gst + shipping;

  // ============================================================================
  // HOME PAGE
  // ============================================================================
  const HomePage = () => (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header - Responsive */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🛒</div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-white">FOJEC</h1>
                <p className="text-xs md:text-sm text-green-100">African Supermarket</p>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <nav className="hidden md:flex gap-8">
              <button onClick={() => setCurrentPage('home')} className="text-white font-bold hover:text-yellow-300 transition">Home</button>
              <button onClick={() => setCurrentPage('products')} className="text-white font-bold hover:text-yellow-300 transition">Shop</button>
              <button onClick={() => setCurrentPage('loyalty')} className="text-white font-bold hover:text-yellow-300 transition">Loyalty 💎</button>
              <button onClick={() => router.push('/account')} className="text-white font-bold hover:text-yellow-300 transition">Account</button>
            </nav>
          </div>

          {/* Desktop Cart Icon */}
          <button onClick={() => setCurrentPage('cart')} className="hidden md:flex items-center gap-2 text-white font-bold hover:text-yellow-300 transition relative">
            <ShoppingCart size={24} />
            {cart.length > 0 && <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-sm font-bold">({cart.length})</span>}
          </button>

          {/* Mobile Menu Button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-green-800 text-white px-4 py-3 border-t-2 border-green-900">
            <button onClick={() => { setCurrentPage('home'); setMenuOpen(false); }} className="block w-full text-left py-2 text-sm hover:text-yellow-300">Home</button>
            <button onClick={() => { setCurrentPage('products'); setMenuOpen(false); }} className="block w-full text-left py-2 text-sm hover:text-yellow-300">Shop</button>
            <button onClick={() => { setCurrentPage('loyalty'); setMenuOpen(false); }} className="block w-full text-left py-2 text-sm hover:text-yellow-300">Loyalty 💎</button>
            <button onClick={() => { router.push('/account'); setMenuOpen(false); }} className="block w-full text-left py-2 text-sm hover:text-yellow-300">Account</button>
          </div>
        )}
      </div>

      {/* Hero - Premium Design */}
      <div className="relative h-96 md:h-screen max-h-96 md:max-h-screen bg-gradient-to-br from-green-700 via-orange-500 to-red-600 text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        {/* Content */}
        <div className="relative h-full flex flex-col justify-center items-center px-4 text-center">
          <p className="text-sm md:text-lg text-green-100 mb-3">Easy, Fresh & Convenient</p>
          <h2 className="text-4xl md:text-7xl font-bold mb-4 leading-tight">Stock Up On<br/>Everyday<br/>Essentials</h2>
          <p className="text-lg md:text-2xl text-green-100 mb-8">Save Big On Your Favorite Products</p>
          
          <button 
            onClick={() => setCurrentPage('products')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 md:py-6 rounded-xl font-bold text-lg md:text-2xl transition transform hover:scale-105 shadow-xl"
          >
            Shop Now
          </button>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-2xl text-center shadow-lg hover:shadow-xl transition">
          <p className="font-bold text-2xl mb-2">🎁 Special Offer This Week</p>
          <p className="text-xl">African Foodstuffs - 20% OFF</p>
        </div>
      </div>

      {/* Featured Products - Responsive Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h3 className="text-4xl font-bold mb-8 text-gray-900">🔥 Top Sellers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.slice(0, 3).map(product => (
            <div key={product.id} className="bg-white p-6 rounded-2xl shadow-md hover:shadow-2xl transition transform hover:scale-105 border border-gray-100">
              <div className="text-6xl mb-4 text-center">{product.image}</div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h4>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-3">
                ⭐ {product.rating} ({product.reviews} reviews)
              </p>
              <p className="text-3xl font-bold text-orange-600 mb-2">${product.price}</p>
              <p className="text-sm text-gray-600 mb-4">{product.stock > 0 ? `✓ ${product.stock} in stock` : 'Out of stock'}</p>
              <button 
                onClick={() => addToCart(product)}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transition"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Section */}
      <div className="max-w-6xl mx-auto px-4 py-12 bg-gradient-to-b from-gray-50 to-white">
        <h3 className="text-4xl font-bold mb-8 text-gray-900">📍 Visit Fojec African Supermarket</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-8 rounded-2xl border-2 border-green-200 shadow-md hover:shadow-lg transition">
            <p className="font-bold text-2xl mb-2 text-green-700">⏰ Hours</p>
            <p className="text-gray-700 text-lg">Mon-Sun: 9:30am - 8:30pm</p>
          </div>
          <div className="bg-white p-8 rounded-2xl border-2 border-orange-200 shadow-md hover:shadow-lg transition">
            <p className="font-bold text-2xl mb-2 text-orange-600">📞 Phone</p>
            <p className="text-gray-700 text-lg">0410 265 055</p>
          </div>
          <div className="bg-white p-8 rounded-2xl border-2 border-red-200 shadow-md hover:shadow-lg transition">
            <p className="font-bold text-2xl mb-2 text-red-600">📧 Email</p>
            <p className="text-gray-700 text-lg">fojecsupermart@gmail.com</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold hover:shadow-lg transition text-lg">
            📱 WhatsApp Us
          </button>
          <button className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold hover:shadow-lg transition text-lg">
            📍 View Map
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // PRODUCTS PAGE - RESPONSIVE
  // ============================================================================
  const ProductsPage = () => (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => setCurrentPage('home')} className="text-yellow-300 font-bold mb-3 md:mb-0 hover:text-yellow-100">◄ Back</button>
          <h2 className="hidden md:block text-3xl font-bold">🛍️ Shop All Products</h2>
          <div className="flex gap-2 mt-3 md:mt-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-600" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-white text-gray-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Categories - Horizontal scroll on mobile, wrapped on desktop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 overflow-x-auto md:flex-wrap">
          <button 
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition ${!selectedCategory ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition ${selectedCategory === cat.name ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid - Responsive */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-2xl transition transform hover:scale-105">
              <div className="text-6xl mb-4 text-center">{product.image}</div>
              <h4 className="font-bold text-gray-900 mb-2 line-clamp-2">{product.name}</h4>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                ⭐ {product.rating} ({product.reviews})
              </p>
              <p className="text-2xl font-bold text-orange-600 mb-2">${product.price}</p>
              <p className="text-sm text-gray-600 mb-4">{product.stock > 0 ? `✓ ${product.stock} available` : 'Out of stock'}</p>
              <button 
                onClick={() => addToCart(product)}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-2 rounded-xl font-bold hover:shadow-lg transition"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // CART PAGE - RESPONSIVE
  // ============================================================================
  const CartPage = () => (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => setCurrentPage('home')} className="text-yellow-300 font-bold hover:text-yellow-100">◄ Back</button>
          <h2 className="text-3xl font-bold mt-2">🛒 Shopping Cart</h2>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-center p-4">
          <ShoppingCart size={64} className="text-gray-300 mb-4" />
          <p className="text-gray-600 font-bold mb-4">Your cart is empty</p>
          <button 
            onClick={() => setCurrentPage('products')}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="p-4 space-y-4">
            {cart.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex gap-3">
                  <div className="text-3xl">{item.image}</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <p className="text-lg font-bold text-red-600">${item.price}</p>
                    
                    {/* Quantity */}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 border rounded">
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 border rounded">
                        <Plus size={16} />
                      </button>
                      <button onClick={() => removeFromCart(item.id)} className="ml-auto text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-2 font-semibold">
                      Subtotal: ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Promo Code */}
          <div className="p-4 border-t border-gray-200">
            <input
              type="text"
              placeholder="Enter promo code"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm mb-2 focus:border-green-500 outline-none"
            />
            <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-xl font-bold text-sm hover:shadow-lg transition">
              Apply Discount
            </button>
          </div>

          {/* Order Summary */}
          <div className="p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-900">
                <span className="font-semibold">Subtotal:</span>
                <span className="font-semibold">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-900">
                <span className="font-semibold">Shipping:</span>
                <span className="font-semibold">${shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-900">
                <span className="font-semibold">GST (10%):</span>
                <span className="font-semibold">${gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-gray-900 border-t-2 border-gray-300 pt-3">
                <span>Total:</span>
                <span className="text-orange-600">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={() => setCurrentPage('checkout')}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold mb-2 hover:shadow-lg transition text-lg"
            >
              Proceed to Checkout
            </button>
            <button 
              onClick={() => setCurrentPage('products')}
              className="w-full bg-gray-200 text-gray-900 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
            >
              Continue Shopping
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ============================================================================
  // LOYALTY PAGE
  // ============================================================================
  const LoyaltyPage = () => (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => setCurrentPage('home')} className="text-yellow-300 font-bold hover:text-yellow-100">◄ Back</button>
          <h2 className="text-3xl font-bold mt-2">💎 Loyalty Program</h2>
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-gradient-to-br from-orange-400 via-red-500 to-red-600 text-white p-8 rounded-2xl text-center shadow-xl">
            <p className="text-lg mb-2 opacity-90">Join Fojec's Loyalty Program</p>
            <p className="text-4xl font-bold mb-4">Earn Points 🎁</p>
            <p className="text-xl mb-4">Get 1 point for every $1 you spend</p>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Your email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 outline-none"
            />
            <input
              type="phone"
              placeholder="Your phone"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 outline-none"
            />
            <button 
              onClick={() => setIsLoggedIn(true)}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition"
            >
              Register for Loyalty
            </button>
          </div>

          <div className="bg-green-50 border-2 border-green-400 text-green-900 p-6 rounded-2xl text-sm">
            <p className="font-bold mb-3 text-lg">How it works:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><span className="text-xl">✓</span> Earn 1 point per $1 spent</li>
              <li className="flex items-center gap-2"><span className="text-xl">✓</span> Redeem 100 points = $1 discount</li>
              <li className="flex items-center gap-2"><span className="text-xl">✓</span> Check your balance anytime</li>
              <li className="flex items-center gap-2"><span className="text-xl">✓</span> Exclusive member offers</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-gradient-to-br from-orange-400 via-red-500 to-red-600 text-white p-8 rounded-2xl text-center shadow-xl">
            <p className="text-lg mb-2 opacity-90">Your Points Balance</p>
            <p className="text-6xl font-bold mb-2">1,250</p>
            <p className="text-lg">= $12.50 in discounts</p>
          </div>

          <div className="bg-gradient-to-r from-green-400 to-green-500 text-white p-6 rounded-2xl text-center shadow-lg">
            <p className="text-2xl font-bold mb-1">🎉 You're Almost There!</p>
            <p className="text-lg">250 points away from a $15 discount</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
            <p className="font-bold text-2xl text-gray-900 mb-6">📊 Your Stats</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border-l-4 border-green-600">
                <span className="text-gray-600 text-sm">Tier:</span>
                <p className="font-bold text-gray-900 text-xl">Bronze</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border-l-4 border-orange-600">
                <span className="text-gray-600 text-sm">Lifetime Earned:</span>
                <p className="font-bold text-gray-900 text-xl">2,850 pts</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border-l-4 border-red-600">
                <span className="text-gray-600 text-sm">Total Spent:</span>
                <p className="font-bold text-gray-900 text-xl">$2,850</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-l-4 border-blue-600">
                <span className="text-gray-600 text-sm">Purchases:</span>
                <p className="font-bold text-gray-900 text-xl">12</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition">
              Redeem Points
            </button>
            <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transition">
              Share Referral Link
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // BOTTOM NAVIGATION - Mobile Only
  // ============================================================================
  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 flex justify-around md:hidden shadow-2xl">
      <button
        onClick={() => setCurrentPage('home')}
        className={`flex-1 py-3 text-center transition ${currentPage === 'home' ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <Home size={24} className="mx-auto" />
        <p className="text-xs mt-1">Home</p>
      </button>

      <button
        onClick={() => setCurrentPage('products')}
        className={`flex-1 py-3 text-center transition ${currentPage === 'products' ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <Search size={24} className="mx-auto" />
        <p className="text-xs mt-1">Shop</p>
      </button>

      <button
        onClick={() => setCurrentPage('cart')}
        className={`flex-1 py-3 text-center relative transition ${currentPage === 'cart' ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <ShoppingCart size={24} className="mx-auto" />
        {cart.length > 0 && (
          <span className="absolute top-0 right-2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {cart.length}
          </span>
        )}
        <p className="text-xs mt-1">Cart</p>
      </button>

      <button
        onClick={() => setCurrentPage('loyalty')}
        className={`flex-1 py-3 text-center transition ${currentPage === 'loyalty' ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <Gift size={24} className="mx-auto" />
        <p className="text-xs mt-1">Loyalty</p>
      </button>

      <button
        onClick={() => router.push('/account')}
        className={`flex-1 py-3 text-center transition ${currentPage === 'account' ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <User size={24} className="mx-auto" />
        <p className="text-xs mt-1">Account</p>
      </button>
    </div>
  );

  // ============================================================================
  // PAGE ROUTER
  // ============================================================================
  return (
    <div className="bg-white">
      {currentPage === 'home' && <HomePage />}
      {currentPage === 'products' && <ProductsPage />}
      {currentPage === 'cart' && <CartPage />}
      {currentPage === 'loyalty' && <LoyaltyPage />}
      <BottomNav />
    </div>
  );
}
