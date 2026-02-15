/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Users
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.string('email').primary();
      table.string('password_hash');
      table.string('role').notNullable().defaultTo('user');
      table.integer('locked').notNullable().defaultTo(0); // 0 = false, 1 = true
      table.integer('must_change_password').notNullable().defaultTo(0);
      table.string('created_at').notNullable();
      table.string('updated_at').notNullable();
    });
  } else {
    // Check for columns added later in original code
    const hasRole = await knex.schema.hasColumn('users', 'role');
    if (!hasRole) await knex.schema.alterTable('users', (t) => t.string('role').notNullable().defaultTo('user'));

    const hasLocked = await knex.schema.hasColumn('users', 'locked');
    if (!hasLocked) await knex.schema.alterTable('users', (t) => t.integer('locked').notNullable().defaultTo(0));

    const hasMustChange = await knex.schema.hasColumn('users', 'must_change_password');
    if (!hasMustChange) await knex.schema.alterTable('users', (t) => t.integer('must_change_password').notNullable().defaultTo(0));
  }

  // Sessions
  if (!(await knex.schema.hasTable('sessions'))) {
    await knex.schema.createTable('sessions', (table) => {
      table.string('token_hash').primary();
      table.string('user_email').notNullable().references('email').inTable('users').onDelete('CASCADE');
      table.string('created_at').notNullable();
      table.string('last_seen_at').notNullable();
      table.string('expires_at').notNullable();
      table.index(['user_email', 'expires_at']);
    });
  }

  // OAuth Accounts
  if (!(await knex.schema.hasTable('oauth_accounts'))) {
    await knex.schema.createTable('oauth_accounts', (table) => {
      table.string('provider').notNullable();
      table.string('provider_user_id').notNullable();
      table.string('user_email').notNullable().references('email').inTable('users').onDelete('CASCADE');
      table.string('display_name');
      table.string('created_at').notNullable();
      table.string('updated_at').notNullable();
      table.primary(['provider', 'provider_user_id']);
    });
  }

  // OAuth States
  if (!(await knex.schema.hasTable('oauth_states'))) {
    await knex.schema.createTable('oauth_states', (table) => {
      table.string('state').primary();
      table.string('provider').notNullable();
      table.string('code_verifier');
      table.string('return_to');
      table.string('created_at').notNullable();
      table.string('expires_at').notNullable();
      table.index('expires_at');
    });
  }

  // System Settings
  if (!(await knex.schema.hasTable('system_settings'))) {
    await knex.schema.createTable('system_settings', (table) => {
      table.string('key').primary();
      table.string('value').notNullable();
      table.string('updated_at').notNullable();
    });
    // Seed initial setting
    await knex('system_settings').insert({
        key: 'registration_enabled',
        value: 'true',
        updated_at: new Date().toISOString()
    }).onConflict('key').ignore();
  }

  // Stories
  if (!(await knex.schema.hasTable('stories'))) {
    await knex.schema.createTable('stories', (table) => {
      table.string('id').primary();
      table.string('user_email').notNullable().references('email').inTable('users').onDelete('CASCADE');
      table.string('title').notNullable();
      table.text('payload_json').notNullable(); // text for larger JSON
      table.string('payload_hash');
      table.integer('version').notNullable().defaultTo(1);
      table.string('created_at').notNullable();
      table.string('updated_at').notNullable();
      table.index(['user_email', 'updated_at']);
    });
  } else {
    const hasHash = await knex.schema.hasColumn('stories', 'payload_hash');
    if (!hasHash) await knex.schema.alterTable('stories', (t) => t.string('payload_hash'));

    const hasVersion = await knex.schema.hasColumn('stories', 'version');
    if (!hasVersion) await knex.schema.alterTable('stories', (t) => t.integer('version').notNullable().defaultTo(1));
  }

  // Story Versions
  if (!(await knex.schema.hasTable('story_versions'))) {
    await knex.schema.createTable('story_versions', (table) => {
      table.increments('id');
      table.string('story_id').notNullable();
      table.string('user_email').notNullable();
      table.integer('version').notNullable();
      table.string('payload_hash').notNullable();
      table.text('payload_json').notNullable();
      table.string('created_at').notNullable();
      table.index(['story_id', 'version']);
    });
  }

  // AI Runs
  if (!(await knex.schema.hasTable('ai_runs'))) {
    await knex.schema.createTable('ai_runs', (table) => {
      table.increments('id');
      table.string('story_id');
      table.string('actor_email');
      table.string('task').notNullable();
      table.string('model');
      table.string('status').notNullable();
      table.string('error_message');
      table.string('created_at').notNullable();
    });
  }

  // User Settings
  if (!(await knex.schema.hasTable('user_settings'))) {
    await knex.schema.createTable('user_settings', (table) => {
      table.string('user_email').primary().references('email').inTable('users').onDelete('CASCADE');
      table.string('ai_target').notNullable().defaultTo('gemini');
      table.string('ai_api_key');
      table.string('ai_model');
      table.string('ai_base_url');
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
  // Order matters due to foreign keys
  await knex.schema.dropTableIfExists('user_settings');
  await knex.schema.dropTableIfExists('ai_runs');
  await knex.schema.dropTableIfExists('story_versions');
  await knex.schema.dropTableIfExists('stories');
  await knex.schema.dropTableIfExists('system_settings');
  await knex.schema.dropTableIfExists('oauth_states');
  await knex.schema.dropTableIfExists('oauth_accounts');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
}
