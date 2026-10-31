/**
 * Map a Mongoose user document to a public user object
 * @param {any} doc
 * @returns {import('@radiology/contracts').UserPublic}
 */
export function toPublicUser(doc) {
  return {
    id: doc._id ? doc._id.toString() : doc.id,
    email: doc.email,
    displayName: doc.displayName,
    role: doc.role,
    language: doc.language,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}
