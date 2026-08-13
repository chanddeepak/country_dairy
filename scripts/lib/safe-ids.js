/**
 * A guard for `deleteMany({ where: { id: { in: ... } } })`.
 *
 * Prisma treats `{ in: undefined }` as "no filter" and deletes the whole
 * table. A test whose cleanup references a key that does not exist on its
 * bookkeeping object — `made.users` when the object only has `orders` — will
 * therefore wipe every row rather than none.
 *
 * That is not hypothetical: it emptied the User table of this project's
 * development database, and everything that cascades from it.
 *
 * Wrap every id list in this. An empty array is fine and deletes nothing;
 * anything that is not an array stops the run before it touches data.
 */
function only(list, label = 'id list') {
  if (list === undefined || list === null) {
    throw new Error(
      `Refusing to delete: ${label} is ${list}. ` +
        'Prisma would read that as "no filter" and remove every row. ' +
        'Check the property name on the bookkeeping object.',
    );
  }

  if (!Array.isArray(list)) {
    throw new Error(`Refusing to delete: ${label} is ${typeof list}, expected an array.`);
  }

  if (list.some((id) => typeof id !== 'string' || !id)) {
    throw new Error(`Refusing to delete: ${label} contains an empty or non-string id.`);
  }

  return list;
}

module.exports = { only };
