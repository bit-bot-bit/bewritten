function nowIso() {
  return new Date().toISOString();
}

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(String(raw || ''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export async function up(knex) {
  const row = await knex('system_settings').select('value').where('key', 'monetization_task_costs').first();
  if (!row?.value) return;

  const current = safeParse(row.value, {});
  const next = {
    ...current,
    'story-insights': Math.max(18, Number(current['story-insights'] || 0)),
    'story-review': Math.max(20, Number(current['story-review'] || 0)),
  };

  await knex('system_settings')
    .where('key', 'monetization_task_costs')
    .update({ value: JSON.stringify(next), updated_at: nowIso() });
}

export async function down(_knex) {}
