const { Sequelize } = require('sequelize');
require('dotenv').config();

// Load from environment
const DB_HOST = process.env.DB_HOST || process.env.PGHOST || 'localhost';
const DB_PORT = process.env.DB_PORT || process.env.PGPORT || 5432;
const DB_NAME = process.env.DB_NAME || process.env.PGDATABASE || 'postgres';
const DB_USER = process.env.DB_USER || process.env.PGUSER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';
const DB_SSL = (process.env.DB_SSL || 'false').toLowerCase() === 'true';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  logging: false,
  dialectOptions: DB_SSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

module.exports = { sequelize };
