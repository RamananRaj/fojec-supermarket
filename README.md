# Fojec African Supermarket

Beautiful e-commerce website for Fojec African Supermarket - Melbourne, Australia.

🌐 **Live Site:** https://fojec-supermarket.vercel.app

📱 **Mobile-First Design** | 🛒 **Shopping Cart** | 💎 **Loyalty Program** | 🎨 **Modern UI**

---

## 🚀 Tech Stack

- **Frontend:** React 18 + Next.js 14
- **Styling:** Tailwind CSS 3
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Icons:** Lucide React

---

## 📋 Features

- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Product browsing with search & categories
- ✅ Shopping cart with tax calculations
- ✅ Loyalty program registration
- ✅ Beautiful Fojec branding
- ✅ Fast & optimized performance

---

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development

```bash
# Clone the repo
git clone https://github.com/yourusername/fojec-supermarket.git
cd fojec-supermarket

# Install dependencies
npm install

# Create .env.local file with:
NEXT_PUBLIC_SUPABASE_URL=https://whpzgdoyqwutkpxvavtf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## 📦 Project Structure

```
fojec-supermarket/
├── pages/
│   └── index.js          # Main app component
├── public/
│   └── favicon.ico
├── package.json          # Dependencies
├── next.config.js        # Next.js config
├── .env.local           # Environment variables (git ignored)
├── .gitignore
└── README.md
```

---

## 🌐 Deployment (Vercel)

### Automatic Deployment

This repo is configured for Vercel. Every push to main automatically deploys!

1. Connect GitHub repo to Vercel
2. Add environment variables
3. Deploy button!

### Manual Deployment

```bash
npm run build
npm start
```

---

## 📊 Database (Supabase)

### Connection
- **URL:** https://whpzgdoyqwutkpxvavtf.supabase.co
- **Tables:** 14 tables for products, orders, customers, loyalty

### Tables
- `products` - Product catalog
- `categories` - Product categories
- `customers` - Customer profiles
- `orders` - Order history
- `order_items` - Order details
- `points_transactions` - Loyalty points
- `loyalty_settings` - Loyalty config
- `website_settings` - Business settings

---

## 🎨 Branding Colors

```
Primary Green:    #15803d
Secondary Orange: #f97316
Accent Red:       #dc2626
Gold:             #fbbf24
```

---

## 📞 Contact

**Fojec African Supermarket**
- Phone: 0410 265 055
- Email: fojecsupermart@gmail.com
- Hours: Mon-Sun, 9:30am-8:30pm
- Location: Melbourne, VIC, Australia

---

## 📄 License

Private project for Fojec African Supermarket

---

## 🤝 Contributing

This is a private project. Contact Ram Raj for contributions.

---

**Built with ❤️ for Fojec African Supermarket**
