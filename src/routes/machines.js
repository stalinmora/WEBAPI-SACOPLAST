import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// CREAR TIPO DE MÁQUINA
router.post('/types', async (req, res) => { // ✅ Corregido
  const { name, description } = req.body;

  try {
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Nombre del tipo es requerido' });
    }

    // Verificar si ya existe
    const existingType = await pool.query('SELECT id FROM machine_types WHERE name = $1', [name.trim()]);
    if (existingType.rows.length > 0) {
      return res.status(400).json({ message: 'El tipo de máquina ya existe' });
    }

    // Crear tipo
    const result = await pool.query(
      'INSERT INTO machine_types (name, description) VALUES ($1, $2) RETURNING id, name, description',
      [name.trim(), description?.trim() || null]
    );

    res.status(201).json({
      success: true,
      message: 'Tipo de máquina creado exitosamente',
      type: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER TIPOS DE MÁQUINAS
router.get('/types', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM machine_types ORDER BY name');
    res.json({
      success: true,
      types: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR TIPO DE MÁQUINA
router.put('/types/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Nombre del tipo es requerido' });
    }

    const result = await pool.query(
      'UPDATE machine_types SET name = $1, description = $2 WHERE id = $3 RETURNING id, name, description',
      [name.trim(), description?.trim() || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Tipo de máquina no encontrado' });
    }

    res.json({
      success: true,
      message: 'Tipo de máquina actualizado exitosamente',
      type: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR TIPO DE MÁQUINA (soft delete: solo si no tiene máquinas asociadas)
router.delete('/types/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si hay máquinas asociadas
    const machinesCheck = await pool.query('SELECT COUNT(*) as count FROM machines WHERE type_id = $1', [id]);
    if (parseInt(machinesCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'No se puede eliminar el tipo porque tiene máquinas asociadas' });
    }

    const result = await pool.query('DELETE FROM machine_types WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Tipo de máquina no encontrado' });
    }

    res.json({
      success: true,
      message: 'Tipo de máquina eliminado exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CREAR MÁQUINA
router.post('/', async (req, res) => {
  const { name, type_id } = req.body;

  try {
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Nombre de la máquina es requerido' });
    }

    // Verificar si el tipo existe
    if (type_id) {
      const typeCheck = await pool.query('SELECT id FROM machine_types WHERE id = $1', [type_id]);
      if (typeCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Tipo de máquina no válido' });
      }
    }

    // Crear máquina
    const result = await pool.query(
      'INSERT INTO machines (name, type_id) VALUES ($1, $2) RETURNING id, name, type_id',
      [name.trim(), type_id || null]
    );

    res.status(201).json({
      success: true,
      message: 'Máquina creada exitosamente',
      machine: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER MÁQUINAS
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.name, mt.name as type_name, m.status
      FROM machines m
      LEFT JOIN machine_types mt ON m.type_id = mt.id
      ORDER BY m.name
    `);
    res.json({
      success: true,
      machines: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CAMBIAR ESTADO DE MÁQUINA
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE machines SET status = $1 WHERE id = $2 RETURNING id, name, status',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Máquina no encontrada' });
    }

    res.json({
      success: true,
      message: `Máquina ${status === 'active' ? 'activada' : 'desactivada'} exitosamente`,
      machine: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR MÁQUINA (soft delete: solo cambia estado)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE machines SET status = $1 WHERE id = $2 RETURNING id',
      ['inactive', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Máquina no encontrada' });
    }

    res.json({
      success: true,
      message: 'Máquina desactivada exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;