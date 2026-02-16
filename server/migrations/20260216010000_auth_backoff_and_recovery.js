/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const hasFailedCount = await knex.schema.hasColumn('users', 'failed_login_count');
  if (!hasFailedCount) {
    await knex.schema.alterTable('users', (table) => {
      table.integer('failed_login_count').notNullable().defaultTo(0);
    });
  }

  const hasBackoffUntil = await knex.schema.hasColumn('users', 'login_backoff_until');
  if (!hasBackoffUntil) {
    await knex.schema.alterTable('users', (table) => {
      table.string('login_backoff_until');
    });
  }

  const hasLastFailed = await knex.schema.hasColumn('users', 'last_failed_login_at');
  if (!hasLastFailed) {
    await knex.schema.alterTable('users', (table) => {
      table.string('last_failed_login_at');
    });
  }

  if (!(await knex.schema.hasTable('password_reset_tokens'))) {
    await knex.schema.createTable('password_reset_tokens', (table) => {
      table.string('token_hash').primary();
      table.string('user_email').notNullable().references('email').inTable('users').onDelete('CASCADE');
      table.string('created_at').notNullable();
      table.string('expires_at').notNullable();
      table.string('used_at');
      table.index(['user_email', 'expires_at']);
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('password_reset_tokens');

  const hasLastFailed = await knex.schema.hasColumn('users', 'last_failed_login_at');
  if (hasLastFailed) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_failed_login_at');
    });
  }

  const hasBackoffUntil = await knex.schema.hasColumn('users', 'login_backoff_until');
  if (hasBackoffUntil) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('login_backoff_until');
    });
  }

  const hasFailedCount = await knex.schema.hasColumn('users', 'failed_login_count');
  if (hasFailedCount) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('failed_login_count');
    });
  }
}
