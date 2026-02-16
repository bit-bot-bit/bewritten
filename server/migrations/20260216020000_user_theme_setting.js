export async function up(knex) {
  const hasTable = await knex.schema.hasTable('user_settings');
  if (!hasTable) return;

  const hasThemeColumn = await knex.schema.hasColumn('user_settings', 'theme_id');
  if (!hasThemeColumn) {
    await knex.schema.alterTable('user_settings', (table) => {
      table.string('theme_id').notNullable().defaultTo('nexus');
    });
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('user_settings');
  if (!hasTable) return;

  const hasThemeColumn = await knex.schema.hasColumn('user_settings', 'theme_id');
  if (hasThemeColumn) {
    await knex.schema.alterTable('user_settings', (table) => {
      table.dropColumn('theme_id');
    });
  }
}
