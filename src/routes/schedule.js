import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// OBTENER HORARIOS
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sd.id, sd.day_date, sd.shift_id, sd.group_id, sd.notes
      FROM schedule_days sd
      ORDER BY sd.day_date DESC
    `);
    res.json({
      success: true,
      days: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CREAR HORARIO
router.post('/', async (req, res) => {
  const { day_date, shift_id, group_id, notes } = req.body;

  try {
    // Validar entrada
    if (!day_date || !shift_id) {
      return res.status(400).json({ message: 'Fecha y turno son requeridos' });
    }

    // Verificar si ya existe un horario para este día y turno
    const existingSchedule = await pool.query(
      'SELECT id FROM schedule_days WHERE day_date = $1 AND shift_id = $2',
      [day_date, shift_id]
    );
    if (existingSchedule.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe un horario para este día y turno' });
    }

    // Verificar si el turno existe
    const shiftCheck = await pool.query('SELECT id FROM shifts WHERE id = $1', [shift_id]);
    if (shiftCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Turno no válido' });
    }

    // Verificar si el grupo existe (si se asigna)
    if (group_id) {
      const groupCheck = await pool.query('SELECT id FROM work_groups WHERE id = $1', [group_id]);
      if (groupCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Grupo de trabajo no válido' });
      }
    }

    // Crear horario
    const result = await pool.query(
      `INSERT INTO schedule_days (day_date, shift_id, group_id, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, day_date, shift_id, group_id, notes`,
      [day_date, shift_id, group_id || null, notes?.trim() || null]
    );

    res.status(201).json({
      success: true,
      message: 'Horario creado exitosamente',
      day: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR HORARIO
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { day_date, shift_id, group_id, notes } = req.body;

  try {
    // Validar entrada
    if (!day_date || !shift_id) {
      return res.status(400).json({ message: 'Fecha y turno son requeridos' });
    }

    // Verificar si ya existe otro horario para este día y turno (excepto el actual)
    const existingSchedule = await pool.query(
      'SELECT id FROM schedule_days WHERE day_date = $1 AND shift_id = $2 AND id != $3',
      [day_date, shift_id, id]
    );
    if (existingSchedule.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe un horario para este día y turno' });
    }

    // Verificar si el turno existe
    const shiftCheck = await pool.query('SELECT id FROM shifts WHERE id = $1', [shift_id]);
    if (shiftCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Turno no válido' });
    }

    // Verificar si el grupo existe (si se asigna)
    if (group_id) {
      const groupCheck = await pool.query('SELECT id FROM work_groups WHERE id = $1', [group_id]);
      if (groupCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Grupo de trabajo no válido' });
      }
    }

    const result = await pool.query(
      `UPDATE schedule_days 
       SET day_date = $1, shift_id = $2, group_id = $3, notes = $4
       WHERE id = $5 
       RETURNING id, day_date, shift_id, group_id, notes`,
      [day_date, shift_id, group_id || null, notes?.trim() || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Horario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Horario actualizado exitosamente',
      day: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR HORARIO
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM schedule_days WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Horario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Horario eliminado exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER HORARIOS POR MES (para calendario)
router.get('/calendar', async (req, res) => {
  const { year, month } = req.query;

  try {
    if (!year || !month) {
      return res.status(400).json({ message: 'Año y mes son requeridos' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Último día del mes

    const result = await pool.query(`
      SELECT sd.id, sd.day_date, sd.shift_id, sd.group_id, sd.notes
      FROM schedule_days sd
      WHERE sd.day_date >= $1 AND sd.day_date <= $2
      ORDER BY sd.day_date ASC
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    res.json({
      success: true,
      schedules: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER EXCEPCIONES POR MES (actualizado sin grupo)
router.get('/exceptions', async (req, res) => {
  const { year, month } = req.query;

  try {
    if (!year || !month) {
      return res.status(400).json({ message: 'Año y mes son requeridos' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Último día del mes

    const result = await pool.query(`
      SELECT se.id, se.original_employee_id, se.exception_date, 
             se.shift_id, se.reason
      FROM schedule_exceptions se
      WHERE se.exception_date >= $1 AND se.exception_date <= $2
      ORDER BY se.exception_date ASC
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    res.json({
      success: true,
      exceptions: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CREAR EXCEPCIÓN (versión sin grupo)
router.post('/exceptions', async (req, res) => {
  const { original_employee_id, exception_date, shift_id, reason } = req.body;

  try {
    // Validar entrada
    if (!original_employee_id || !exception_date || !shift_id) {
      return res.status(400).json({ message: 'Empleado, Fecha y Turno Nuevo son requeridos' });
    }

    // Verificar si ya existe una excepción para este empleado, fecha y turno
    const existingException = await pool.query(
      'SELECT id FROM schedule_exceptions WHERE original_employee_id = $1 AND exception_date = $2 AND shift_id = $3',
      [original_employee_id, exception_date, shift_id]
    );
    if (existingException.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe una excepción para este empleado, fecha y turno' });
    }

    // Verificar si el empleado existe
    const employeeCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [original_employee_id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no válido' });
    }

    // Verificar si el turno existe
    const shiftCheck = await pool.query('SELECT id FROM shifts WHERE id = $1', [shift_id]);
    if (shiftCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Turno no válido' });
    }

    // Crear excepción
    const result = await pool.query(
      `INSERT INTO schedule_exceptions (
         original_employee_id, exception_date, shift_id, reason
       ) VALUES ($1, $2, $3, $4) 
       RETURNING id, original_employee_id, exception_date, shift_id, reason`,
      [original_employee_id, exception_date, shift_id, reason?.trim() || null]
    );

    res.status(201).json({
      success: true,
      message: 'Excepción de horario creada exitosamente',
      exception: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR EXCEPCIÓN (versión sin grupo)
router.put('/exceptions/:id', async (req, res) => {
  const { id } = req.params;
  const { original_employee_id, exception_date, shift_id, reason } = req.body;

  try {
    // Validar entrada
    if (!original_employee_id || !exception_date || !shift_id) {
      return res.status(400).json({ message: 'Empleado, Fecha y Turno Nuevo son requeridos' });
    }

    // Verificar si ya existe otra excepción para este empleado, fecha y turno (excepto la actual)
    const existingException = await pool.query(
      'SELECT id FROM schedule_exceptions WHERE original_employee_id = $1 AND exception_date = $2 AND shift_id = $3 AND id != $4',
      [original_employee_id, exception_date, shift_id, id]
    );
    if (existingException.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe otra excepción para este empleado, fecha y turno' });
    }

    // Verificar si el empleado existe
    const employeeCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [original_employee_id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no válido' });
    }

    // Verificar si el turno existe
    const shiftCheck = await pool.query('SELECT id FROM shifts WHERE id = $1', [shift_id]);
    if (shiftCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Turno no válido' });
    }

    const result = await pool.query(
      `UPDATE schedule_exceptions 
       SET original_employee_id = $1, exception_date = $2, shift_id = $3, reason = $4
       WHERE id = $5 
       RETURNING id, original_employee_id, exception_date, shift_id, reason`,
      [original_employee_id, exception_date, shift_id, reason?.trim() || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Excepción no encontrada' });
    }

    res.json({
      success: true,
      message: 'Excepción de horario actualizada exitosamente',
      exception: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR EXCEPCIÓN
router.delete('/exceptions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM schedule_exceptions WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Excepción no encontrada' });
    }

    res.json({
      success: true,
      message: 'Excepción de horario eliminada exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER TURNOS
router.get('/shifts', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, start_time, end_time FROM shifts ORDER BY name');
    res.json({
      success: true,
      shifts: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER GRUPOS DE TRABAJO
router.get('/groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM work_groups ORDER BY name');
    res.json({
      success: true,
      groups: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER EMPLEADOS
router.get('/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre_operador, empleado_identificacion, cargo FROM employees ORDER BY nombre_operador');
    res.json({
      success: true,
      employees: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;