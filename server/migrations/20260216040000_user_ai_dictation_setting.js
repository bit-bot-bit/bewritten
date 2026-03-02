export async function up(knex) {
  const hasTable = await knex.schema.hasTable('user_settings');
  if (hasTable) {
    const hasColumn = await knex.schema.hasColumn('user_settings', 'ai_dictation');
    if (!hasColumn) {
      await knex.schema.alterTable('user_settings', (table) => {
        table.boolean('ai_dictation').notNullable().defaultTo(false);
      });
    }
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('user_settings');
  if (hasTable) {
    const hasColumn = await knex.schema.hasColumn('user_settings', 'ai_dictation');
    if (hasColumn) {
      await knex.schema.alterTable('user_settings', (table) => {
        table.dropColumn('ai_dictation');
      });
    }
  }
}
