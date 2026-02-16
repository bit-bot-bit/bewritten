/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const hasTier = await knex.schema.hasColumn('users', 'tier');
  if (!hasTier) {
    await knex.schema.alterTable('users', (table) => {
      table.string('tier').notNullable().defaultTo('byok');
    });
  }

  if (!(await knex.schema.hasTable('user_credits'))) {
    await knex.schema.createTable('user_credits', (table) => {
      table.string('user_email').primary().references('email').inTable('users').onDelete('CASCADE');
      table.integer('balance').notNullable().defaultTo(0);
      table.string('last_refill_day').notNullable();
      table.string('created_at').notNullable();
      table.string('updated_at').notNullable();
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_credits');

  const hasTier = await knex.schema.hasColumn('users', 'tier');
  if (hasTier) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('tier');
    });
  }
}
