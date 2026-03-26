import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// OBTENER ASIGNACIONES
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT eg.id, eg.employee_id, eg.group_id, eg.assigned_at, eg.status
      FROM employee_groups eg
      WHERE eg.status = 'active'
      ORDER BY eg.assigned_at DESC
    `);
    res.json({
      success: true,
      assignments: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ASIGNAR EMPLEADO A GRUPO
router.post('/', async (req, res) => {
  const { employee_id, group_id } = req.body;

  try {
    // Validar entrada
    if (!employee_id || !group_id) {
      return res.status(400).json({ message: 'Empleado y Grupo son requeridos' });
    }

    // Verificar si ya existe la asignación
    const existingAssignment = await pool.query(
      'SELECT id FROM employee_groups WHERE employee_id = $1 AND group_id = $2 AND status = $3',
      [employee_id, group_id, 'active']
    );
    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({ message: 'El empleado ya está asignado a este grupo' });
    }

    // Verificar si el empleado ya está asignado a otro grupo
    const existingEmployeeAssignment = await pool.query(
      'SELECT id FROM employee_groups WHERE employee_id = $1 AND status = $2',
      [employee_id, 'active']
    );
    if (existingEmployeeAssignment.rows.length > 0) {
      return res.status(400).json({ message: 'El empleado ya está asignado a otro grupo. Libere primero al empleado.' });
    }

    // Verificar si el empleado existe
    const employeeCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no válido' });
    }

    // Verificar si el grupo existe
    const groupCheck = await pool.query('SELECT id FROM work_groups WHERE id = $1', [group_id]);
    if (groupCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Grupo no válido' });
    }

    // Crear asignación
    const result = await pool.query(
      `INSERT INTO employee_groups (employee_id, group_id, status) 
       VALUES ($1, $2, $3) 
       RETURNING id, employee_id, group_id, assigned_at`,
      [employee_id, group_id, 'active']
    );

    res.status(201).json({
      success: true,
      message: 'Empleado asignado al grupo exitosamente',
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// REMOVER ASIGNACIÓN
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE employee_groups SET status = $1 WHERE id = $2 RETURNING id',
      ['inactive', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    res.json({
      success: true,
      message: 'Asignación removida exitosamente',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// OBTENER EMPLEADOS DISPONIBLES (que no estén asignados a ningún grupo)
router.get('/employees', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.nombre_operador, e.empleado_identificacion, e.cargo, e.employee_type
      FROM employees e
      LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.status = 'active'
      WHERE eg.employee_id IS NULL
      ORDER BY e.nombre_operador
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

// OBTENER EMPLEADOS ASIGNADOS (que sí estén asignados a algún grupo)
router.get('/employees-assigned', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.nombre_operador, e.empleado_identificacion, e.cargo, e.employee_type, eg.group_id, wg.name as group_name
      FROM employees e
      INNER JOIN employee_groups eg ON e.id = eg.employee_id AND eg.status = 'active'
      INNER JOIN work_groups wg ON eg.group_id = wg.id
      ORDER BY e.nombre_operador
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

// OBTENER GRUPOS
router.get('/groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM work_groups WHERE status = \'active\' ORDER BY name');
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