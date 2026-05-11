type UpdateDoc = Record<string, Record<string, unknown>>;

const OPERATOR_KEYS = new Set(['$set', '$setOnInsert', '$inc', '$push', '$pull', '$unset', '$addToSet']);

function hasOperator(update: Record<string, unknown>) {
  return Object.keys(update).some((key) => OPERATOR_KEYS.has(key));
}

export function normalizeUpdate(update: Record<string, unknown>): UpdateDoc {
  if (hasOperator(update)) return update as UpdateDoc;
  return { $set: update };
}

export function buildSafeUpsert(setFields: Record<string, unknown>, setOnInsertFields: Record<string, unknown> = {}) {
  const cleanedSet = { ...setFields };
  const cleanedInsert = { ...setOnInsertFields };

  for (const key of Object.keys(cleanedSet)) {
    delete cleanedInsert[key];
  }

  const update: UpdateDoc = {};
  if (Object.keys(cleanedSet).length > 0) update.$set = cleanedSet;
  if (Object.keys(cleanedInsert).length > 0) update.$setOnInsert = cleanedInsert;
  return update;
}
