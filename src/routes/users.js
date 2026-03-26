import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { findUserByEmail, createUser, updateUser, updateUserStatus, getAllUsers, getUserRole, getUserPermissions, updateUserRole } from '../models/User.js';

const router = express.Router();

// CREAR USUARIO
router.post('/', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(name, email, hashedPassword);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: { id: user.id, name: user.name, email: user.email }, // ✅ Corregido
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER TODOS LOS USUARIOS
router.get('/', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER USUARIOS CON ROLES
router.get('/with-roles', async (req, res) => { // ✅ Corregido
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `);
    res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER ROLES
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM roles ORDER BY id');
    res.json({
      success: true,
      roles: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR USUARIO
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  try {
    const updatedUser = await updateUser(id, name, email);

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CAMBIAR ESTADO DEL USUARIO (soft delete)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updatedUser = await updateUserStatus(id, status);

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      message: `Usuario ${status === 'active' ? 'activado' : 'desactivado'} exitosamente`,
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ASIGNAR ROL A USUARIO
router.put('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { roleId } = req.body;

  try {
    const result = await pool.query(
      'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, name, email, role_id',
      [roleId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Rol asignado exitosamente',
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER ROLES CON SUS PERMISOS
router.get('/:id/permissions', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT p.name
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.id = $1
    `, [id]);

    res.json({
      success: true,
      permissions: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ASIGNAR PERMISO A ROL
router.post('/:id/permissions', async (req, res) => {
  const { id } = req.params;
  const { permissionName } = req.body;

  try {
    // Primero obtener ID del permiso
    const permResult = await pool.query('SELECT id FROM permissions WHERE name = $1', [permissionName]);
    if (permResult.rows.length === 0) {
      return res.status(404).json({ message: 'Permiso no encontrado' });
    }

    const permissionId = permResult.rows[0].id;

    // Asignar permiso al rol
    await pool.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
      [id, permissionId]
    );

    res.json({
      success: true,
      message: 'Permiso asignado exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// QUITAR PERMISO DE ROL
router.delete('/:id/permissions', async (req, res) => {
  const { id } = req.params;
  const { permissionName } = req.body;

  try {
    // Obtener ID del permiso
    const permResult = await pool.query('SELECT id FROM permissions WHERE name = $1', [permissionName]);
    if (permResult.rows.length === 0) {
      return res.status(404).json({ message: 'Permiso no encontrado' });
    }

    const permissionId = permResult.rows[0].id;

    // Quitar permiso del rol
    const result = await pool.query(
      'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
      [id, permissionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Asociación no encontrada' });
    }

    res.json({
      success: true,
      message: 'Permiso removido exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER TODOS LOS ROLES
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM roles ORDER BY id');
    res.json({
      success: true,
      roles: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER PERMISOS EXISTENTES
router.get('/permissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM permissions ORDER BY name');
    res.json({
      success: true,
      permissions: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CREAR ROL
router.post('/roles', async (req, res) => {
  const { name } = req.body;

  try {
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Nombre del rol es requerido y debe ser una cadena válida' });
    }

    // Verificar si el rol ya existe
    const existingRole = await pool.query('SELECT id FROM roles WHERE name = $1', [name.trim()]);
    if (existingRole.rows.length > 0) {
      return res.status(400).json({ message: 'El rol ya existe' });
    }

    // Crear el rol
    const result = await pool.query(
      'INSERT INTO roles (name) VALUES ($1) RETURNING id, name',
      [name.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      role: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;