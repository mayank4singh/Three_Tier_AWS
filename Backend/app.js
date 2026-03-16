const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Allow frontend to call this API
app.use(cors());
app.use(express.json());

// ── In-memory product data (no database yet) ──────────────────
const products = [
  { id: 1, name: 'Wireless Headphones', category: 'Electronics', price: 2999, stock: 45 },
  { id: 2, name: 'Running Shoes',       category: 'Sports',      price: 1499, stock: 120 },
  { id: 3, name: 'Coffee Maker',        category: 'Kitchen',     price: 3499, stock: 30 },
  { id: 4, name: 'Yoga Mat',            category: 'Sports',      price: 799,  stock: 200 },
  { id: 5, name: 'Desk Lamp',           category: 'Home',        price: 599,  stock: 80 },
  { id: 6, name: 'Bluetooth Speaker',   category: 'Electronics', price: 1999, stock: 60 },
];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend', timestamp: new Date().toISOString() });
});

// Get all products
app.get('/api/products', (req, res) => {
  res.json({ success: true, count: products.length, data: products });
});

// Get single product by ID
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// Add a new product
app.post('/api/products', (req, res) => {
  const { name, category, price, stock } = req.body;
  if (!name || !category || !price) {
    return res.status(400).json({ success: false, message: 'name, category and price are required' });
  }
  const newProduct = {
    id: products.length + 1,
    name,
    category,
    price: parseInt(price),
    stock: parseInt(stock) || 0,
  };
  products.push(newProduct);
  res.status(201).json({ success: true, data: newProduct });
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  products.splice(index, 1);
  res.json({ success: true, message: 'Product deleted' });
});

// Start server
app.listen(PORT, () => {
  console.log('Backend API running on http://localhost:' + PORT);
});
