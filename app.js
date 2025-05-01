const express = require('express');
const db = require('./db'); // Your MySQL connection
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
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

// Session setup
app.use(session({
    secret: 'finance-manager-secret',
    resave: false,
    saveUninitialized: false
}));

// Flash setup
app.use(flash());

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.title = 'Finance Manager'; // Default title
    next();
});

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Set up session and passport
app.use(session({
    secret: 'finance-manager-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport strategy for login
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return done(null, false, { message: 'Incorrect email.' });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            return done(null, user);
        } else {
            return done(null, false, { message: 'Incorrect password.' });
        }
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0) {
            return done(null, false);
        }
        return done(null, rows[0]);
    } catch (err) {
        return done(err);
    }
});

// Helper function to calculate income, expenses, and balance


// Home Page (Protected)
// Home Page (Dashboard) Route
app.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const [transactions] = await db.query('SELECT * FROM transactions WHERE user_id = ?', [req.user.id]);
        console.log(transactions); 

        // Check if transactions is an empty array or undefined
        if (!transactions || !Array.isArray(transactions)) {
            return res.render('index', { title: 'Dashboard', transactions: [], income: 0, expenses: 0, balance: 0 });
        }

        // Use the helper function to calculate income, expenses, and balance
        const { income, expenses, balance } = calculateFinances(transactions);

        // Render dashboard with income, expenses, balance, and transactions
        res.render('index', { title: 'Dashboard', transactions, income, expenses, balance });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
});
// Helper function to calculate income, expenses, and balance
const calculateFinances = (transactions) => {
    if (!Array.isArray(transactions)) {
        return { income: 0, expenses: 0, balance: 0 };  // Default values if transactions is not an array
    }

    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const balance = income - expenses;
    return { income, expenses, balance };
};




// Add Transaction Page (Protected)
app.get('/add', ensureAuthenticated, (req, res) => {
    // Define the categories array
    const categories = ['Food', 'Transport', 'Entertainment', 'Bills'];

    // Render the addTransaction page with categories
    res.render('addTransaction', { title: 'Add Transaction', categories });
});


// Add Transaction (POST) (Protected)
app.post('/add', ensureAuthenticated, async (req, res) => {
    const { type, amount, description, category } = req.body;
    try {
        await db.query('INSERT INTO transactions (type, amount, description, category, user_id) VALUES (?, ?, ?, ?, ?)', 
        [type, amount, description, category, req.user.id]);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/add');
    }
});
function getCategoriesSummary(transactions) {
    const categorySummary = {};

    transactions.forEach(t => {
        const category = t.category;
        const amount = parseFloat(t.amount);

        if (category) {
            if (!categorySummary[category]) {
                categorySummary[category] = 0;
            }
            categorySummary[category] += amount;
        }
    });

    return Object.keys(categorySummary).map(category => ({
        name: category,
        total: categorySummary[category]
    }));
}

// Summary Page (Protected)
// Summary Page Route
app.get('/summary', ensureAuthenticated, async (req, res) => {
    try {
        const [transactions] = await db.query('SELECT * FROM transactions WHERE user_id = ?', [req.user.id]);

        // If transactions are not available or empty, handle gracefully
        if (!transactions || transactions.length === 0) {
            return res.render('summary', { title: 'Summary - Personal Finance', transactions: [], income: 0, expenses: 0, balance: 0, categories: [] });
        }

        // Calculate income, expenses, balance
        const { income, expenses, balance } = calculateFinances(transactions);

        // Get categories summary
        const categories = getCategoriesSummary(transactions);

        // Render the summary page with the data
        res.render('summary', { 
            title: 'Summary - Personal Finance', 
            transactions, 
            income, 
            expenses, 
            balance, 
            categories 
        });

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// About Page (Protected)
app.get('/about', ensureAuthenticated, (req, res) => {
    res.render('about', { title: 'About' });
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Login POST Route
app.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true // Enable flash messages on failure
    })(req, res, next);
});

// Sign Up Page
app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Sign Up' });
});

// Sign Up (POST)
app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) throw err;
        const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        db.query(query, [name, email, hashedPassword], (err, result) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Error during registration');
                return res.redirect('/signup');
            }
            req.flash('success_msg', 'Registration successful! Please login.');
            res.redirect('/login');
        });
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
