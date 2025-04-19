const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const app = express();

// View setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/layout');

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(expressLayouts);

// Set default title in the response locals
app.use((req, res, next) => {
    res.locals.title = 'Finance Manager'; // Default title
    next();
});

// Dummy data for transactions and users (Replace with a database in production)
let transactions = [
    { type: 'income', amount: 1500, description: 'Salary', category: 'Salary' },
    { type: 'expense', amount: 300, description: 'Groceries', category: 'Food' },
    { type: 'expense', amount: 100, description: 'Transport', category: 'Transport' },
];
let users = [
    { username: 'user1', password: '$2a$10$M1Y0Ff6A0qbpmIuqEd/8NeO5Zq5Eni87t7P9r0SKyEdnk9jj2RuJe' } // password: 'password123'
];

// Available categories
const categories = ['Salary', 'Food', 'Transport', 'Shopping', 'Utilities', 'Health', 'Miscellaneous'];

// Set up session and passport
app.use(session({
    secret: 'finance-manager-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport strategy for login
passport.use(new LocalStrategy((username, password, done) => {
    const user = users.find(u => u.username === username);
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    
    bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return done(err);
        if (isMatch) return done(null, user);
        return done(null, false, { message: 'Incorrect password.' });
    });
}));

// Serialize and deserialize user for session
passport.serializeUser((user, done) => {
    done(null, user.username);
});

passport.deserializeUser((username, done) => {
    const user = users.find(u => u.username === username);
    done(null, user);
});

// Helper function to calculate income, expenses, and balance
const calculateFinances = () => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expenses;
    return { income, expenses, balance };
};

// Routes

// Home Page
app.get('/', (req, res) => {
    const { income, expenses, balance } = calculateFinances();
    res.render('index', { title: 'Home', transactions, income, expenses, balance });
});

// Add Transaction Page
app.get('/add', (req, res) => {
    res.render('addTransaction', { title: 'Add Transaction', categories });
});

// Add Transaction (POST)
app.post('/add', (req, res) => {
    const { type, amount, description, category } = req.body;
    transactions.push({ type, amount: parseFloat(amount), description, category });
    res.redirect('/');
});

// Summary Page
app.get('/summary', (req, res) => {
    const { income, expenses, balance } = calculateFinances();

    const categoriesMap = {};
    transactions.forEach(transaction => {
        categoriesMap[transaction.category] = (categoriesMap[transaction.category] || 0) + transaction.amount;
    });

    const categoryTotals = Object.keys(categoriesMap).map(key => ({
        name: key,
        total: categoriesMap[key],
    }));

    res.render('summary', { title: 'Summary', income, expenses, balance, categories: categoryTotals });
});

// About Page
app.get('/about', (req, res) => {
    res.render('about', { title: 'About' });
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Login POST Route
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
}));

// Sign Up Page
app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Sign Up' });
});

// Sign Up (POST)
app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) throw err;
        users.push({ username, password: hashedPassword });
        res.redirect('/login');
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        res.redirect('/');
    });
});

// Start Server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
