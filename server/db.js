import knex from 'knex';
import knexConfig from './knexfile.js';

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const db = knex(knexConfig[environment]);

export async function initDb() {
  try {
    await db.migrate.latest();
    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
}

export function getDb() {
  return db;
}
