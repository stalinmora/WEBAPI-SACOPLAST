import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// OBTENER REGISTROS DE EFICIENCIA
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT er.id, er.employee_id, er.task_id, er.record_date, er.hours_worked, 
             er.expected_production, er.actual_production, er.efficiency_percentage, er.notes
      FROM efficiency_records er
      ORDER BY er.record_date DESC, er.created_at DESC
      LIMIT 50
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

// REGISTRAR EFICIENCIA
router.post('/', async (req, res) => {
  const { employee_id, record_date, task_id, hours_worked, expected_production, actual_production, efficiency_percentage, notes } = req.body;

  try {
    // Validar entrada
    if (!employee_id || !record_date || !task_id) {
      return res.status(400).json({ message: 'Empleado, Fecha y Tarea son requeridos' });
    }

    if (hours_worked <= 0) {
      return res.status(400).json({ message: 'Las horas trabajadas deben ser mayores a 0' });
    }

    // Calcular horas totales trabajadas por el empleado en ese día
    const totalHoursResult = await pool.query(
      'SELECT SUM(hours_worked) as total_hours FROM efficiency_records WHERE employee_id = $1 AND record_date = $2',
      [employee_id, record_date]
    );
    
    const existingHours = parseFloat(totalHoursResult.rows[0].total_hours || 0);
    const totalHours = existingHours + hours_worked;

    if (totalHours > 12) {
      return res.status(400).json({ 
        message: `El empleado ya tiene ${existingHours} horas registradas. Al sumar ${hours_worked} horas más, excedería el límite de 12 horas por día.` 
      });
    }

    // Verificar si ya existe un registro para este empleado en esta fecha
    const existingRecord = await pool.query(
      'SELECT id FROM efficiency_records WHERE employee_id = $1 AND record_date = $2',
      [employee_id, record_date]
    );
    if (existingRecord.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe un registro de eficiencia para este empleado en esta fecha' });
    }

    // Verificar si el empleado existe
    const employeeCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no válido' });
    }

    // Verificar si la tarea existe
    if (task_id) {
      const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [task_id]);
      if (taskCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Tarea no válida' });
      }
    }

    // Crear registro de eficiencia
    const result = await pool.query(
      `INSERT INTO efficiency_records (
         employee_id, record_date, task_id, hours_worked, 
         expected_production, actual_production, efficiency_percentage, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, employee_id, record_date, hours_worked, 
                 expected_production, actual_production, efficiency_percentage`,
      [
        employee_id, record_date, task_id, hours_worked,
        expected_production || null, actual_production || null, efficiency_percentage || null, notes?.trim() || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Registro de eficiencia guardado exitosamente',
      record: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER EMPLEADOS
router.get('/employees', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre_operador, empleado_identificacion, cargo, employee_type
      FROM employees
      ORDER BY nombre_operador
    `);
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

// OBTENER TAREAS
router.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, area_id, description, target_per_hour, target_per_shift, specification
      FROM tasks
      WHERE status = 'active'
      ORDER BY description
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