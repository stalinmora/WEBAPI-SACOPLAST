import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// GENERAR REPORTE DE DIAS Y HORARIOS TRABAJADOS
router.post('/work-schedule', async (req, res) => {
  const { employee_id, group_id, start_date, end_date } = req.body;

  try {
    // Validar fechas
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Fecha inicio y fin son requeridas' });
    }

    // Consulta para obtener horarios regulares
    const regularQuery = `
      SELECT 
        e.nombre_operador as employee_name,
        wg.name as group_name,
        sd.day_date as date,
        s.name as shift_name,
        s.start_time as start_time,
        s.end_time as end_time,
        'regular' as type,
        NULL as reason,
        0 as hours_worked,
        0 as expected_production,
        0 as actual_production,
        0 as efficiency_percentage
      FROM schedule_days sd
      INNER JOIN work_groups wg ON sd.group_id = wg.id
      INNER JOIN employees e ON e.id IN (
        SELECT id FROM employees WHERE id IN (
          SELECT employee_id FROM employee_groups WHERE group_id = wg.id
        )
      )
      INNER JOIN shifts s ON sd.shift_id = s.id
      WHERE sd.day_date BETWEEN $1 AND $2
      ${employee_id ? 'AND e.id = $3' : ''}
      ${group_id ? 'AND wg.id = ' + (employee_id ? '$4' : '$3') : ''}
      ORDER BY sd.day_date, s.start_time
    `;

    // Consulta para obtener excepciones
    const exceptionQuery = `
      SELECT 
        e.nombre_operador as employee_name,
        wg.name as group_name,
        se.exception_date as date,
        s.name as shift_name,
        s.start_time as start_time,
        s.end_time as end_time,
        'exception' as type,
        se.reason as reason,
        0 as hours_worked,
        0 as expected_production,
        0 as actual_production,
        0 as efficiency_percentage
      FROM schedule_exceptions se
      INNER JOIN work_groups wg ON se.original_group_id = wg.id
      INNER JOIN employees e ON se.original_employee_id = e.id
      INNER JOIN shifts s ON se.shift_id = s.id
      WHERE se.exception_date BETWEEN $1 AND $2
      ${employee_id ? 'AND e.id = $3' : ''}
      ${group_id ? 'AND wg.id = ' + (employee_id ? '$4' : '$3') : ''}
      ORDER BY se.exception_date, s.start_time
    `;

    // Consulta para obtener registros de eficiencia (días trabajados con datos completos)
    const efficiencyQuery = `
      SELECT 
        e.nombre_operador as employee_name,
        wg.name as group_name,
        er.record_date as date,
        t.description as task_description,
        NULL as shift_name,
        NULL as start_time,
        NULL as end_time,
        'efficiency' as type,
        CONCAT('Tarea: ', t.description) as reason,
        er.hours_worked,
        er.expected_production,
        er.actual_production,
        COALESCE(er.efficiency_percentage, 0) as efficiency_percentage
      FROM efficiency_records er
      INNER JOIN employees e ON er.employee_id = e.id
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.status = 'active'
      LEFT JOIN work_groups wg ON eg.group_id = wg.id AND wg.status = 'active'
      WHERE er.record_date BETWEEN $1 AND $2
      ${employee_id ? 'AND e.id = $3' : ''}
      ${group_id ? 'AND wg.id = ' + (employee_id ? '$4' : '$3') : ''}
      ORDER BY er.record_date
    `;

    const params = [start_date, end_date];
    if (employee_id) {
      params.push(employee_id);
    }
    if (group_id) {
      const paramIndex = employee_id ? 4 : 3;
      params.push(group_id);
    }

    const [regularResult, exceptionResult, efficiencyResult] = await Promise.all([
      pool.query(regularQuery, [...params]),
      pool.query(exceptionQuery, [...params]),
      pool.query(efficiencyQuery, [...params])
    ]);

    // Combinar resultados
    const combinedResults = [
      ...regularResult.rows.map(row => ({
        ...row,
        is_exception: false,
        is_efficiency: false
      })),
      ...exceptionResult.rows.map(row => ({
        ...row,
        is_exception: true,
        is_efficiency: false
      })),
      ...efficiencyResult.rows.map(row => ({
        ...row,
        is_exception: false,
        is_efficiency: true
      }))
    ].sort((a, b) => {
      // Ordenar por fecha y hora de inicio
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // Si es el mismo día, priorizar por tipo: regular > exception > efficiency
      if (a.type === 'regular' && b.type !== 'regular') return -1;
      if (b.type === 'regular' && a.type !== 'regular') return 1;
      if (a.type === 'exception' && b.type === 'efficiency') return -1;
      if (b.type === 'exception' && a.type === 'efficiency') return 1;
      
      return 0;
    });

    res.json({
      success: true,
      reports: combinedResults,
      summary: {
        total_regular: regularResult.rows.length,
        total_exceptions: exceptionResult.rows.length,
        total_efficiencies: efficiencyResult.rows.length,
        total_records: combinedResults.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GENERAR REPORTE GLOBAL DE HORAS Y EFICIENCIA
router.post('/global-work-schedule', async (req, res) => {
  const { start_date, end_date } = req.body;

  try {
    // Validar fechas
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Fecha inicio y fin son requeridas' });
    }

    // Consulta para obtener registros de eficiencia con horas y eficiencia
    const efficiencyQuery = `
      SELECT 
        e.id as employee_id,
        e.nombre_operador as employee_name,
        e.cargo,
        er.record_date as date,
        er.hours_worked,
        er.efficiency_percentage
      FROM efficiency_records er
      INNER JOIN employees e ON er.employee_id = e.id
      WHERE er.record_date BETWEEN $1 AND $2
      ORDER BY e.nombre_operador, er.record_date
    `;

    const result = await pool.query(efficiencyQuery, [start_date, end_date]);

    res.json({
      success: true,
      reports: result.rows,
      summary: {
        total_records: result.rows.length
      }
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

// OBTENER GRUPOS
router.get('/groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM work_groups ORDER BY name');
    res.json({
      success: true,
      groups: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;