import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// CREAR ÁREA
router.post('/areas', async (req, res) => {
  const { name, description } = req.body;

  try {
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Nombre del área es requerido' });
    }

    // Verificar si ya existe
    const existingArea = await pool.query('SELECT id FROM areas WHERE name = $1', [name.trim()]);
    if (existingArea.rows.length > 0) {
      return res.status(400).json({ message: 'El área ya existe' });
    }

    // Crear área
    const result = await pool.query(
      'INSERT INTO areas (name, description) VALUES ($1, $2) RETURNING id, name, description',
      [name.trim(), description?.trim() || null]
    );

    res.status(201).json({
      success: true,
      message: 'Área creada exitosamente',
      area: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER ÁREAS
router.get('/areas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM areas ORDER BY name');
    res.json({
      success: true,
      areas: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR ÁREA
router.put('/areas/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Nombre del área es requerido' });
    }

    const result = await pool.query(
      'UPDATE areas SET name = $1, description = $2 WHERE id = $3 RETURNING id, name, description',
      [name.trim(), description?.trim() || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Área no encontrada' });
    }

    res.json({
      success: true,
      message: 'Área actualizada exitosamente',
      area: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR ÁREA (soft delete: solo si no tiene tareas asociadas)
router.delete('/areas/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si hay tareas asociadas
    const tasksCheck = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE area_id = $1', [id]);
    if (parseInt(tasksCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'No se puede eliminar el área porque tiene tareas asociadas' });
    }

    const result = await pool.query('DELETE FROM areas WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Área no encontrada' });
    }

    res.json({
      success: true,
      message: 'Área eliminada exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CREAR TAREA
router.post('/', async (req, res) => {
  const { area_id, description, specification, target_per_minute, target_per_hour, target_per_shift, status, real_hours_worked } = req.body;

  try {
    // Validar entrada
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'Descripción de la tarea es requerida' });
    }

    if (area_id) {
      // Verificar si el área existe
      const areaCheck = await pool.query('SELECT id FROM areas WHERE id = $1', [area_id]);
      if (areaCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Área no válida' });
      }
    }

    // Validar que real_hours_worked no supere 12
    if (real_hours_worked && parseFloat(real_hours_worked) > 12) {
      return res.status(400).json({ message: 'Las horas reales trabajadas no pueden superar las 12 horas' });
    }

    // Crear tarea
    const result = await pool.query(
      `INSERT INTO tasks (area_id, description, specification, target_per_minute, target_per_hour, target_per_shift, status, real_hours_worked) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, area_id, description, specification, target_per_minute, target_per_hour, target_per_shift, status, real_hours_worked`,
      [
        area_id || null,
        description.trim(),
        specification?.trim() || null,
        target_per_minute || null,
        target_per_hour || null,
        target_per_shift || null,
        status || 'active',
        real_hours_worked ? parseFloat(real_hours_worked) : 0.00 // Valor predeterminado 0.00
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Tarea creada exitosamente',
      task: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER TAREAS
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.area_id, t.description, t.specification, t.target_per_minute, t.target_per_hour, t.target_per_shift, t.status, t.real_hours_worked
      FROM tasks t
      ORDER BY t.description
    `);
    res.json({
      success: true,
      tasks: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR TAREA
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { area_id, description, specification, target_per_minute, target_per_hour, target_per_shift, status, real_hours_worked } = req.body;

  try {
    // Validar entrada
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'Descripción de la tarea es requerida' });
    }

    if (area_id) {
      // Verificar si el área existe
      const areaCheck = await pool.query('SELECT id FROM areas WHERE id = $1', [area_id]);
      if (areaCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Área no válida' });
      }
    }

    // Validar que real_hours_worked no supere 12
    if (real_hours_worked !== undefined && parseFloat(real_hours_worked) > 12) {
      return res.status(400).json({ message: 'Las horas reales trabajadas no pueden superar las 12 horas' });
    }

    const result = await pool.query(
      `UPDATE tasks 
       SET area_id = $1, description = $2, specification = $3, target_per_minute = $4, target_per_hour = $5, target_per_shift = $6, status = $7, real_hours_worked = $8
       WHERE id = $9 
       RETURNING id, area_id, description, specification, target_per_minute, target_per_hour, target_per_shift, status, real_hours_worked`,
      [
        area_id || null,
        description.trim(),
        specification?.trim() || null,
        target_per_minute || null,
        target_per_hour || null,
        target_per_shift || null,
        status || 'active',
        real_hours_worked !== undefined ? parseFloat(real_hours_worked) : 0.00, // Valor predeterminado 0.00
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    res.json({
      success: true,
      message: 'Tarea actualizada exitosamente',
      task: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CAMBIAR ESTADO DE TAREA
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING id, description, status',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    res.json({
      success: true,
      message: `Tarea ${status === 'active' ? 'activada' : 'desactivada'} exitosamente`,
      task: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR TAREA (soft delete: solo cambia estado)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING id',
      ['inactive', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    res.json({
      success: true,
      message: 'Tarea desactivada exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;