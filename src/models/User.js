import pool from '../config/db.js';

export const findUserByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND status = \'active\'', [email]);
  return result.rows[0];
};

export const createUser = async (name, email, password) => {
  const result = await pool.query(
    'INSERT INTO users (name, email, password, status) VALUES ($1, $2, $3, \'active\') RETURNING id, name, email, status',
    [name, email, password]
  );
  return result.rows[0];
};

// OBTENER TODOS LOS USUARIOS (incluyendo inactivos)
export const getAllUsers = async () => {
  const result = await pool.query('SELECT id, name, email, status FROM users ORDER BY id');
  return result.rows;
};

// ACTUALIZAR USUARIO
export const updateUser = async (id, name, email) => {
  const result = await pool.query(
    'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, status',
    [name, email, id]
  );
  return result.rows[0];
};

// CAMBIAR ESTADO DEL USUARIO (soft delete)
export const updateUserStatus = async (id, status) => {
  const result = await pool.query(
    'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, status',
    [status, id]
  );
  return result.rows[0];
};

// OBTENER ROL DEL USUARIO
export const getUserRole = async (userId) => {
  const result = await pool.query(
    'SELECT r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', // ✅ Corregido: era WHERE1
    [userId]
  );
  return result.rows[0]?.role_name || null;
};

// OBTENER PERMISOS DEL USUARIO
export const getUserPermissions = async (userId) => {
  const query = `
    SELECT DISTINCT p.name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = $1
  `;
  const result = await pool.query(query, [userId]);
  return result.rows.map(row => row.name);
};

// ACTUALIZAR ROL DEL USUARIO
export const updateUserRole = async (userId, roleId) => { // ✅ Corregido
  const result = await pool.query(
    'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, name, email, status, role_id',
    [roleId, userId]
  );
  return result.rows[0];
};