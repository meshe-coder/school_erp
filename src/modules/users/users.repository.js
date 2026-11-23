const db = require('../../config/db');

const publicColumns = `
  id,
  username,
  email,
  role,
  is_active,
  must_change_password,
  last_login_at,
  created_by,
  created_at,
  updated_at
`;

async function findByUsername(username, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT ${publicColumns}, password_hash
       FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

async function findByEmail(email, client) {
  if (!email) return null;
  const executor = client || db;
  const result = await executor.query(
    `SELECT ${publicColumns}
       FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT ${publicColumns}
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByUsernameForLogin(username, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, username, email, password_hash, role, is_active,
            must_change_password, last_login_at
       FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

async function findCredentialsById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    'SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

async function createUser({ username, email, passwordHash, role, createdBy }, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO users (
       username, email, password_hash, role,
       is_active, must_change_password, created_by
     )
     VALUES ($1, $2, $3, $4, TRUE, TRUE, $5)
     RETURNING ${publicColumns}`,
    [username, email || null, passwordHash, role, createdBy]
  );
  return result.rows[0];
}

async function listUsers({ role, isActive, search, page, limit }, client) {
  const executor = client || db;
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    conditions.push(`is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const searchIndex = params.length;
    conditions.push(`(username ILIKE $${searchIndex} OR COALESCE(email, '') ILIKE $${searchIndex})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  const limitIndex = params.length;
  params.push((page - 1) * limit);
  const offsetIndex = params.length;

  const dataResult = await executor.query(
    `SELECT ${publicColumns}
       FROM users
       ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const countResult = await executor.query(
    `SELECT COUNT(*)::INTEGER AS total
       FROM users
       ${whereClause}`,
    countParams
  );

  return {
    users: dataResult.rows,
    pagination: { page, limit, total: countResult.rows[0].total },
  };
}

async function updateUser(id, { email, role, isActive }, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  if (email !== undefined) {
    params.push(email);
    assignments.push(`email = $${params.length}`);
  }
  if (role !== undefined) {
    params.push(role);
    assignments.push(`role = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    assignments.push(`is_active = $${params.length}`);
  }

  assignments.push('updated_at = NOW()');
  params.push(id);

  const result = await executor.query(
    `UPDATE users
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING ${publicColumns}`,
    params
  );
  return result.rows[0] || null;
}

async function updatePassword(id, passwordHash, client) {
  const executor = client || db;
  const result = await executor.query(
    `UPDATE users
        SET password_hash = $1,
            must_change_password = TRUE,
            updated_at = NOW()
      WHERE id = $2
      RETURNING ${publicColumns}`,
    [passwordHash, id]
  );
  return result.rows[0] || null;
}

async function updatePasswordChanged(id, passwordHash, client) {
  const executor = client || db;
  const result = await executor.query(
    `UPDATE users
        SET password_hash = $1,
            must_change_password = FALSE,
            updated_at = NOW()
      WHERE id = $2
      RETURNING ${publicColumns}`,
    [passwordHash, id]
  );
  return result.rows[0] || null;
}

async function updateLastLogin(id, client) {
  const executor = client || db;
  await executor.query(
    'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );
}

async function deleteUserSessions(id, client) {
  const executor = client || db;
  await executor.query(
    `DELETE FROM session
      WHERE sess->'passport'->>'user' = $1`,
    [String(id)]
  );
}

module.exports = {
  findByUsername,
  findByEmail,
  findById,
  findByUsernameForLogin,
  findCredentialsById,
  createUser,
  listUsers,
  updateUser,
  updatePassword,
  updatePasswordChanged,
  updateLastLogin,
  deleteUserSessions,
};
