// Import necessary packages
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

// Create the Express application
const app = express();
const PORT = 5000;

// Middleware to enable CORS and parse JSON request bodies
app.use(cors());
app.use(express.json());

// Connect to SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create the customers table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            phone_number TEXT NOT NULL UNIQUE
        )`);

        // Create the addresses table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            address_details TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            pin_code TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
        )`);
    }
});

// Helper function for sending a consistent error response
const sendError = (res, status, message, error = null) => {
    res.status(status).json({
        message,
        error: error ? error.message : 'An unknown error occurred.'
    });
};

// --- Customer Routes ---

// POST /api/customers: Create a new customer
app.post('/api/customers', (req, res) => {
    const { first_name, last_name, phone_number } = req.body;

    if (!first_name || !last_name || !phone_number) {
        return sendError(res, 400, 'All fields are required.');
    }

    const sql = `INSERT INTO customers (first_name, last_name, phone_number) VALUES (?, ?, ?)`;
    db.run(sql, [first_name, last_name, phone_number], function (err) {
        if (err) {
            return sendError(res, 500, 'Error creating customer.', err);
        }
        res.status(201).json({
            message: 'Customer created successfully',
            id: this.lastID
        });
    });
});

// GET /api/customers: Get a list of all customers with search and pagination
app.get('/api/customers', (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT * FROM customers`;
    let countSql = `SELECT COUNT(*) AS count FROM customers`;
    const params = [];

    if (search) {
        sql += ` WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?`;
        countSql += ` WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` LIMIT ? OFFSET ?`;
    const sqlWithPagination = [...params, limit, offset];

    db.get(countSql, params, (err, countRow) => {
        if (err) {
            return sendError(res, 500, 'Error counting customers.', err);
        }
        const totalCustomers = countRow.count;

        db.all(sql, sqlWithPagination, (err, rows) => {
            if (err) {
                return sendError(res, 500, 'Error fetching customers.', err);
            }
            res.status(200).json({
                message: 'Customers fetched successfully',
                data: rows,
                pagination: {
                    total: totalCustomers,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalCustomers / limit)
                }
            });
        });
    });
});

// GET /api/customers/:id: Get a single customer's details
app.get('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const sql = `SELECT * FROM customers WHERE id = ?`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            return sendError(res, 500, 'Error fetching customer.', err);
        }
        if (!row) {
            return sendError(res, 404, 'Customer not found.');
        }
        res.status(200).json({
            message: 'Customer fetched successfully',
            data: row
        });
    });
});

// PUT /api/customers/:id: Update a customer's information
app.put('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone_number } = req.body;

    if (!first_name || !last_name || !phone_number) {
        return sendError(res, 400, 'All fields are required.');
    }

    const sql = `UPDATE customers SET first_name = ?, last_name = ?, phone_number = ? WHERE id = ?`;
    db.run(sql, [first_name, last_name, phone_number, id], function (err) {
        if (err) {
            return sendError(res, 500, 'Error updating customer.', err);
        }
        if (this.changes === 0) {
            return sendError(res, 404, 'Customer not found or no changes made.');
        }
        res.status(200).json({
            message: 'Customer updated successfully'
        });
    });
});

// DELETE /api/customers/:id: Delete a customer
app.delete('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM customers WHERE id = ?`;

    db.run(sql, [id], function (err) {
        if (err) {
            return sendError(res, 500, 'Error deleting customer.', err);
        }
        if (this.changes === 0) {
            return sendError(res, 404, 'Customer not found.');
        }
        res.status(200).json({
            message: 'Customer deleted successfully'
        });
    });
});

// --- Address Routes ---

// POST /api/customers/:id/addresses: Add a new address for a specific customer
app.post('/api/customers/:id/addresses', (req, res) => {
    const customer_id = req.params.id;
    const { address_details, city, state, pin_code } = req.body;

    if (!address_details || !city || !state || !pin_code) {
        return sendError(res, 400, 'All address fields are required.');
    }

    const sql = `INSERT INTO addresses (customer_id, address_details, city, state, pin_code) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [customer_id, address_details, city, state, pin_code], function (err) {
        if (err) {
            return sendError(res, 500, 'Error adding address.', err);
        }
        res.status(201).json({
            message: 'Address added successfully',
            id: this.lastID
        });
    });
});

// GET /api/customers/:id/addresses: Get all addresses for a specific customer
app.get('/api/customers/:id/addresses', (req, res) => {
    const { id } = req.params;
    const sql = `SELECT * FROM addresses WHERE customer_id = ?`;

    db.all(sql, [id], (err, rows) => {
        if (err) {
            return sendError(res, 500, 'Error fetching addresses.', err);
        }
        res.status(200).json({
            message: 'Addresses fetched successfully',
            data: rows
        });
    });
});

// PUT /api/addresses/:addressId: Update a specific address
app.put('/api/addresses/:addressId', (req, res) => {
    const { addressId } = req.params;
    const { address_details, city, state, pin_code } = req.body;

    if (!address_details || !city || !state || !pin_code) {
        return sendError(res, 400, 'All address fields are required.');
    }

    const sql = `UPDATE addresses SET address_details = ?, city = ?, state = ?, pin_code = ? WHERE id = ?`;
    db.run(sql, [address_details, city, state, pin_code, addressId], function (err) {
        if (err) {
            return sendError(res, 500, 'Error updating address.', err);
        }
        if (this.changes === 0) {
            return sendError(res, 404, 'Address not found or no changes made.');
        }
        res.status(200).json({
            message: 'Address updated successfully'
        });
    });
});

// DELETE /api/addresses/:addressId: Delete a specific address
app.delete('/api/addresses/:addressId', (req, res) => {
    const { addressId } = req.params;
    const sql = `DELETE FROM addresses WHERE id = ?`;

    db.run(sql, [addressId], function (err) {
        if (err) {
            return sendError(res, 500, 'Error deleting address.', err);
        }
        if (this.changes === 0) {
            return sendError(res, 404, 'Address not found.');
        }
        res.status(200).json({
            message: 'Address deleted successfully'
        });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

