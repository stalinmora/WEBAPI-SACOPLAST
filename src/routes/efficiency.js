import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// OBTENER REGISTROS DE EFICIENCIA
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT er.*, 
             e.nombre_operador as employee_name,
             e.empleado_identificacion,
             e.cargo,
             t.description as task_description,
             a.name as area_name
      FROM efficiency_records er
      INNER JOIN employees e ON er.employee_id = e.id
      INNER JOIN tasks t ON er.task_id = t.id
      INNER JOIN areas a ON t.area_id = a.id
      WHERE er.status = 'active'
      ORDER BY er.record_date DESC, e.nombre_operador
    `);
    res.json({
      success: true,
      records: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// CREAR REGISTRO DE EFICIENCIA
router.post('/', async (req, res) => {
  const { employee_id, record_date, task_id, hours_worked, expected_production, actual_production } = req.body;

  try {
    // Validar entrada
    if (!employee_id || !record_date || !task_id || !hours_worked) {
      return res.status(400).json({ message: 'Empleado, Fecha, Tarea y Horas trabajadas son requeridos' });
    }

    if (hours_worked <= 0) {
      return res.status(400).json({ message: 'Las horas trabajadas deben ser mayores a 0' });
    }

    // Verificar si el empleado existe
    const employeeCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no válido' });
    }

    // Verificar si la tarea existe
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [task_id]);
    if (taskCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Tarea no válida' });
    }

    // Calcular horas totales trabajadas por el empleado en esa fecha
    const existingHoursResult = await pool.query(`
      SELECT SUM(hours_worked) as total_hours 
      FROM efficiency_records 
      WHERE employee_id = $1 AND record_date = $2 AND status = 'active'
    `, [employee_id, record_date]);

    const existingHours = parseFloat(existingHoursResult.rows[0].total_hours) || 0;
    const newTotalHours = existingHours + hours_worked;

    // Validar que no exceda las 12 horas totales
    if (newTotalHours > 12) {
      return res.status(400).json({ 
        message: `El empleado ya tiene ${existingHours} horas registradas. Al sumar ${hours_worked} horas más, excedería el límite de 12 horas por día.` 
      });
    }

    // Calcular eficiencia
    const efficiency_percentage = expected_production && actual_production 
      ? parseFloat(((actual_production / expected_production) * 100).toFixed(2))
      : 0;

    // Crear registro
    const result = await pool.query(`
      INSERT INTO efficiency_records (
        employee_id, record_date, task_id, hours_worked, 
        expected_production, actual_production, efficiency_percentage, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, employee_id, record_date, task_id, hours_worked,
               expected_production, actual_production, efficiency_percentage, status
    `, [
      employee_id, record_date, task_id, hours_worked,
      expected_production || 0, actual_production || 0, efficiency_percentage, 'active'
    ]);

    res.status(201).json({
      success: true,
      message: 'Registro de eficiencia creado exitosamente',
      record: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ACTUALIZAR REGISTRO DE EFICIENCIA
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { employee_id, record_date, task_id, hours_worked, expected_production, actual_production, status } = req.body;

  try {
    // Validar entrada
    if (!employee_id || !record_date || !task_id || !hours_worked) {
      return res.status(400).json({ message: 'Empleado, Fecha, Tarea y Horas trabajadas son requeridos' });
    }

    if (hours_worked <= 0) {
      return res.status(400).json({ message: 'Las horas trabajadas deben ser mayores a 0' });
    }

    // Verificar si el empleado existe
    const employeeCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no válido' });
    }

    // Verificar si la tarea existe
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [task_id]);
    if (taskCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Tarea no válida' });
    }

    // Verificar si el registro existe
    const existingRecordResult = await pool.query(
      'SELECT hours_worked FROM efficiency_records WHERE id = $1 AND status = $2',
      [id, 'active']
    );
    if (existingRecordResult.rows.length === 0) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    const existingRecord = existingRecordResult.rows[0];
    const previousHours = existingRecord.hours_worked;

    // Calcular horas totales trabajadas por el empleado en esa fecha (antes de la actualización)
    const existingHoursResult = await pool.query(`
      SELECT SUM(hours_worked) as total_hours 
      FROM efficiency_records 
      WHERE employee_id = $1 AND record_date = $2 AND status = 'active' AND id != $3
    `, [employee_id, record_date, id]);

    const existingHours = parseFloat(existingHoursResult.rows[0].total_hours) || 0;
    const newTotalHours = existingHours + hours_worked;

    // Validar que no exceda las 12 horas totales
    if (newTotalHours > 12) {
      return res.status(400).json({ 
        message: `El empleado ya tiene ${existingHours} horas registradas (excluyendo este registro). Al sumar ${hours_worked} horas, excedería el límite de 12 horas por día.` 
      });
    }

    // Calcular eficiencia
    const efficiency_percentage = expected_production && actual_production 
      ? parseFloat(((actual_production / expected_production) * 100).toFixed(2))
      : 0;

    const result = await pool.query(`
      UPDATE efficiency_records 
      SET employee_id = $1, record_date = $2, task_id = $3, hours_worked = $4,
          expected_production = $5, actual_production = $6, 
          efficiency_percentage = $7, status = $8, updated_at = NOW()
      WHERE id = $9
      RETURNING id, employee_id, record_date, task_id, hours_worked,
               expected_production, actual_production, efficiency_percentage, status
    `, [
      employee_id, record_date, task_id, hours_worked,
      expected_production || 0, actual_production || 0, efficiency_percentage,
      status || 'active', id
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    res.json({
      success: true,
      message: 'Registro de eficiencia actualizado exitosamente',
      record: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ELIMINAR REGISTRO DE EFICIENCIA (cambiar estado a inactivo)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE efficiency_records SET status = $1 WHERE id = $2 RETURNING id',
      ['inactive', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    res.json({
      success: true,
      message: 'Registro de eficiencia eliminado exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER EMPLEADOS
router.get('/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre_operador, empleado_identificacion, cargo FROM employees WHERE status = \'active\' ORDER BY nombre_operador');
    res.json({
      success: true,
      employees: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER ÁREAS
router.get('/areas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM areas WHERE status = \'active\' ORDER BY name');
    res.json({
      success: true,
      areas: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER TAREAS
router.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, a.name as area_name 
      FROM tasks t
      INNER JOIN areas a ON t.area_id = a.id
      WHERE t.status = 'active' AND a.status = 'active'
      ORDER BY a.name, t.description
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

export default router;